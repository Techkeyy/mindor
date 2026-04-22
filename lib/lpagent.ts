export type RiskProfile = 'low' | 'medium' | 'high'

export type Pool = {
  address: string
  tokenA: string
  tokenB: string
  protocol: string
  feeApr: number
  volume24h: number
  tvl: number
  ilRisk: 'low' | 'medium' | 'high'
  netApr: number
}

export type PoolDetail = Pool & {
  feeHistory: { date: string; fees: number }[]
  priceRange: { min: number; max: number; current: number }
}

export type LeaderboardEntry = {
  wallet: string
  winRate: number
  feeApr: number
  totalProfit: number
}

type LlamaPool = {
  pool: string
  symbol: string
  project: string
  chain: string
  apy: number
  apyBase: number
  tvlUsd: number
  volumeUsd1d?: number
}

const SOLANA_LP_PROJECTS = new Set([
  'meteora',
  'orca-dex',
  'orca',
  'raydium',
  'raydium-clmm',
  'raydium-concentrated-liquidity',
  'kamino',
  'kamino-lending',
  'lifinity',
  'lifinity-v2',
  'saber',
  'mercurial',
  'crema',
  'invariant',
  'dradex',
  'phoenix',
  'openbook',
])

function classifyILRisk(
  symbol: string
): 'low' | 'medium' | 'high' {
  const s = symbol.toUpperCase()

  // Pure stablecoin pairs = low risk
  const stables = [
    'USDC', 'USDT', 'DAI', 'USDH',
    'USDS', 'BUSD', 'FRAX', 'USDR',
    'UXD', 'USDP', 'TUSD', 'GUSD',
    'PAI', 'CASH'
  ]
  const tokens = s.split('-').map(t => t.trim())
  const allStable = tokens.every(t =>
    stables.some(stable => t.includes(stable))
  )
  if (allStable) return 'low'

  // One stable + one major = medium
  const majors = [
    'SOL', 'BTC', 'ETH', 'WBTC',
    'WETH', 'MSOL', 'BSOL', 'JITOSOL',
    'JSOL', 'STSOL', 'WSTETH'
  ]
  const hasStable = tokens.some(t =>
    stables.some(stable => t.includes(stable))
  )
  const hasMajor = tokens.some(t =>
    majors.some(major => t.includes(major))
  )
  if (hasStable && hasMajor) return 'medium'
  if (hasStable) return 'medium'

  // Everything else = high
  return 'high'
}

function parseTokens(
  symbol: string
): { tokenA: string; tokenB: string } {
  const parts = symbol.split('-')
  return {
    tokenA: parts[0]?.trim() ?? symbol,
    tokenB: parts[1]?.trim() ?? 'USDC',
  }
}

function mapPool(p: LlamaPool): Pool {
  const { tokenA, tokenB } = parseTokens(p.symbol)
  const ilRisk = classifyILRisk(p.symbol)
  const ilPenalty =
    ilRisk === 'low' ? 0.3 :
    ilRisk === 'medium' ? 4 : 12
  const rawApr = p.apyBase ?? p.apy ?? 0
  return {
    address: p.pool,
    tokenA,
    tokenB,
    protocol:
      p.project.charAt(0).toUpperCase() + p.project.slice(1),
    feeApr: Math.round(rawApr * 10) / 10,
    volume24h: Math.round(p.volumeUsd1d ?? 0),
    tvl: Math.round(p.tvlUsd ?? 0),
    ilRisk,
    netApr: Math.round((rawApr - ilPenalty) * 10) / 10,
  }
}

export const FALLBACK_POOLS: Pool[] = [
  {
    address: 'fallback-meteora-sol-usdc',
    tokenA: 'SOL', tokenB: 'USDC',
    protocol: 'Meteora',
    feeApr: 28.4, volume24h: 4200000, tvl: 18000000,
    ilRisk: 'medium', netApr: 21.3,
  },
  {
    address: 'fallback-orca-usdc-usdt',
    tokenA: 'USDC', tokenB: 'USDT',
    protocol: 'Orca',
    feeApr: 8.2, volume24h: 980000, tvl: 42000000,
    ilRisk: 'low', netApr: 7.9,
  },
  {
    address: 'fallback-meteora-sol-jto',
    tokenA: 'SOL', tokenB: 'JTO',
    protocol: 'Meteora',
    feeApr: 67.3, volume24h: 1100000, tvl: 3200000,
    ilRisk: 'high', netApr: 44.1,
  },
  {
    address: 'fallback-orca-sol-usdc',
    tokenA: 'SOL', tokenB: 'USDC',
    protocol: 'Orca',
    feeApr: 19.7, volume24h: 2800000, tvl: 9500000,
    ilRisk: 'medium', netApr: 15.2,
  },
  {
    address: 'fallback-meteora-usdc-usdt',
    tokenA: 'USDC', tokenB: 'USDT',
    protocol: 'Meteora',
    feeApr: 6.8, volume24h: 750000, tvl: 31000000,
    ilRisk: 'low', netApr: 6.6,
  },
]

/** Fetch real Solana LP pools from DefiLlama */
export async function fetchTopPools(
  riskProfile: RiskProfile
): Promise<Pool[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(), 8000
    )

    const res = await fetch('https://yields.llama.fi/pools', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    })
    clearTimeout(timeout)

    if (!res.ok) {
      throw new Error(`DefiLlama HTTP ${res.status}`)
    }

    const json = await res.json()
    const data: LlamaPool[] = json.data ?? []

    console.log(
      `[DefiLlama] total pools fetched: ${data.length}`
    )

    const chainSample = [...new Set(
      data.slice(0, 200).map(p => p.chain)
    )].slice(0, 20)
    console.log('[DefiLlama] sample chains:', chainSample)

    const projectSample = [...new Set(
      data.slice(0, 500).map(p => p.project)
    )].filter(p =>
      p.toLowerCase().includes('meteor') ||
      p.toLowerCase().includes('orca')
    )
    console.log('[DefiLlama] meteora/orca projects:',
      projectSample)

    const solana = data.filter(p =>
      p.chain?.toLowerCase() === 'solana' &&
      SOLANA_LP_PROJECTS.has(p.project?.toLowerCase()) &&
      p.tvlUsd > 5000 &&
      (p.apyBase ?? p.apy ?? 0) > 0 &&
      p.symbol?.includes('-')
    )

    console.log(
      `[DefiLlama] Solana pools after filter: ${solana.length}`
    )

    const mapped = solana.map(mapPool)

    const filtered = {
      low: mapped.filter(p => p.ilRisk === 'low'),
      medium: mapped.filter(p => p.ilRisk !== 'high'),
      high: mapped,
    }[riskProfile]

    if (filtered.length === 0) {
      // Try broader filter — return all Solana pools
      console.warn(
        '[DefiLlama] no pools for profile, trying all mapped pools'
      )
      const broader = mapped
        .sort((a, b) => b.netApr - a.netApr)
        .slice(0, 10)
      if (broader.length > 0) return broader

      // Last resort — return all risk levels
      console.warn(
        '[DefiLlama] using all risk levels as fallback'
      )
      return mapped
        .sort((a, b) => b.netApr - a.netApr)
        .slice(0, 10)
    }

    const result = filtered
      .sort((a, b) => b.netApr - a.netApr)
      .slice(0, 10)

    console.log(
      `[DefiLlama] returning ${result.length} live pools`
    )
    return result

  } catch (err) {
    console.error('[DefiLlama] fetch failed:', err)
    // Return empty — let caller handle
    return []
  }
}

/** Fetch pool detail */
export async function fetchPoolDetail(
  poolAddress: string
): Promise<PoolDetail> {
  const pools = await fetchTopPools('high')
  const base =
    pools.find(p => p.address === poolAddress) ??
    FALLBACK_POOLS[0]
  return {
    ...base,
    feeHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 86400000)
        .toISOString().split('T')[0],
      fees:
        base.feeApr * 0.8 +
        Math.random() * base.feeApr * 0.4,
    })),
    priceRange: { min: 120, max: 180, current: 148 },
  }
}

/** Leaderboard placeholder */
export async function fetchLeaderboard(
  limit = 10
): Promise<LeaderboardEntry[]> {
  return Array.from({ length: limit }, (_, i) => ({
    wallet:
      Math.random().toString(36).slice(2, 8) +
      '...' +
      Math.random().toString(36).slice(2, 6),
    winRate: 95 - i * 3,
    feeApr: 45 - i * 2.5,
    totalProfit: 12000 - i * 800,
  }))
}