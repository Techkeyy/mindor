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

// DefiLlama raw pool shape (partial)
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

/** Classify IL risk based on token pair symbol */
function classifyILRisk(symbol: string): 'low' | 'medium' | 'high' {
  const s = symbol.toUpperCase()
  if (s.includes('USDC') && s.includes('USDT')) return 'low'
  if (s.includes('USDC') || s.includes('USDT') || s.includes('DAI'))
    return 'medium'
  return 'high'
}

/** Parse tokenA and tokenB from DefiLlama symbol like "SOL-USDC" */
function parseTokens(symbol: string): { tokenA: string; tokenB: string } {
  const parts = symbol.split('-')
  return {
    tokenA: parts[0] ?? symbol,
    tokenB: parts[1] ?? 'USDC'
  }
}

/** Map DefiLlama pool to Mindor Pool type */
function mapPool(p: LlamaPool): Pool {
  const { tokenA, tokenB } = parseTokens(p.symbol)
  const ilRisk = classifyILRisk(p.symbol)
  const ilPenalty = ilRisk === 'low' ? 0.3 : ilRisk === 'medium' ? 4 : 12
  return {
    address: p.pool,
    tokenA,
    tokenB,
    protocol: p.project.charAt(0).toUpperCase() + p.project.slice(1),
    feeApr: Math.round((p.apyBase ?? p.apy ?? 0) * 10) / 10,
    volume24h: Math.round(p.volumeUsd1d ?? 0),
    tvl: Math.round(p.tvlUsd ?? 0),
    ilRisk,
    netApr: Math.round(((p.apyBase ?? p.apy ?? 0) - ilPenalty) * 10) / 10
  }
}

const FALLBACK_POOLS: Pool[] = [
  {
    address: 'fallback-meteora-sol-usdc',
    tokenA: 'SOL', tokenB: 'USDC',
    protocol: 'Meteora',
    feeApr: 28.4, volume24h: 4200000, tvl: 18000000,
    ilRisk: 'medium', netApr: 21.3
  },
  {
    address: 'fallback-orca-usdc-usdt',
    tokenA: 'USDC', tokenB: 'USDT',
    protocol: 'Orca',
    feeApr: 8.2, volume24h: 980000, tvl: 42000000,
    ilRisk: 'low', netApr: 7.9
  },
  {
    address: 'fallback-meteora-sol-jto',
    tokenA: 'SOL', tokenB: 'JTO',
    protocol: 'Meteora',
    feeApr: 67.3, volume24h: 1100000, tvl: 3200000,
    ilRisk: 'high', netApr: 44.1
  },
  {
    address: 'fallback-orca-sol-usdc',
    tokenA: 'SOL', tokenB: 'USDC',
    protocol: 'Orca',
    feeApr: 19.7, volume24h: 2800000, tvl: 9500000,
    ilRisk: 'medium', netApr: 15.2
  },
  {
    address: 'fallback-meteora-usdc-usdt',
    tokenA: 'USDC', tokenB: 'USDT',
    protocol: 'Meteora',
    feeApr: 6.8, volume24h: 750000, tvl: 31000000,
    ilRisk: 'low', netApr: 6.6
  }
]

/** Fetch real Solana LP pools from DefiLlama - no API key required */
export async function fetchTopPools(
  riskProfile: RiskProfile
): Promise<Pool[]> {
  try {
    const res = await fetch('https://yields.llama.fi/pools', {
      next: { revalidate: 3600 } // cache 1 hour
    })
    if (!res.ok) throw new Error(`DefiLlama error: ${res.status}`)

    const { data }: { data: LlamaPool[] } = await res.json()

    // Filter: Solana only, Meteora or Orca, min $100k TVL,
    // positive APY, valid symbol with hyphen
    const solana = data.filter(p =>
      p.chain === 'Solana' &&
      ['meteora', 'orca'].includes(p.project.toLowerCase()) &&
      p.tvlUsd > 100000 &&
      (p.apyBase ?? p.apy ?? 0) > 0 &&
      p.symbol.includes('-')
    )

    const mapped = solana.map(mapPool)

    // Apply risk filter
    const filtered = {
      low: mapped.filter(p => p.ilRisk === 'low'),
      medium: mapped.filter(p => p.ilRisk !== 'high'),
      high: mapped
    }[riskProfile]

    // Sort by netApr descending, take top 10
    const result = filtered
      .sort((a, b) => b.netApr - a.netApr)
      .slice(0, 10)

    // If DefiLlama returns nothing for this filter, use fallback
    return result.length > 0 ? result : FALLBACK_POOLS

  } catch (err) {
    console.error('DefiLlama fetch failed, using fallback:', err)
    return FALLBACK_POOLS
  }
}

/** Fetch pool detail - enriches with mock history for now */
export async function fetchPoolDetail(
  poolAddress: string
): Promise<PoolDetail> {
  const pools = await fetchTopPools('high')
  const base = pools.find(p => p.address === poolAddress)
    ?? FALLBACK_POOLS[0]
  return {
    ...base,
    feeHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 86400000)
        .toISOString().split('T')[0],
      fees: base.feeApr * 0.8 + Math.random() * base.feeApr * 0.4
    })),
    priceRange: { min: 120, max: 180, current: 148 }
  }
}
