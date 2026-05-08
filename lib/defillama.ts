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

// ============================================================
// Pool address lookup — maps (protocol, tokenA, tokenB) →
// real on-chain Solana pool addresses.
// DefiLlama returns UUIDs, not chain addresses, so we maintain
// this mapping for pools we support execution on.
// ============================================================
const KNOWN_POOL_ADDRESSES: Record<string, string> = {
  // Meteora DLMM
  'meteora:sol:usdc': '5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6',
  'meteora:usdc:usdt': '9cQNX7kx5mGwMBGB8V3JVKB7WguwQSjB3ekjg1Z1s5Dm',
  'meteora:sol:jto': '2po1ynXQhLL2XJ2AxfyYjK9nGTUFCpc9sqny4x7BG9Av',
  // Orca Whirlpool
  'orca:sol:usdc': 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4pcryoy2e7q',
  'orca:usdc:usdt': '4fuUiYxTgzQ6g8dPDE5FjsoT7Gvm82KEWgrYQ5hny7rS',
}

function lookupPoolAddress(project: string, tokenA: string, tokenB: string): string {
  const key = `${project.toLowerCase()}:${tokenA.toLowerCase()}:${tokenB.toLowerCase()}`
  return KNOWN_POOL_ADDRESSES[key] ?? ''
}

/** Validate if a string looks like a Solana base58 address */
export function isValidPoolAddress(addr: string): boolean {
  // Solana addresses are base58, 32-44 characters
  if (!addr || addr.length < 32 || addr.length > 44) return false
  // Base58 charset — no 0, O, I, l
  const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/
  return BASE58.test(addr)
}

/** Determine which protocol a pool address belongs to */
export function getPoolProtocol(addr: string): 'meteora' | 'orca' | 'unknown' {
  for (const [key, address] of Object.entries(KNOWN_POOL_ADDRESSES)) {
    if (address === addr) {
      return key.startsWith('meteora:') ? 'meteora' : 'orca'
    }
  }
  return 'unknown'
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
  const STABLES = ['USDC', 'USDT', 'DAI', 'FRAX', 'TUSD', 'BUSD', 'USDH', 'USDP', 'GUSD', 'LUSD', 'USD']
  const hasTwoStables = STABLES.filter(stable => s.includes(stable)).length >= 2
  if (hasTwoStables) return 'low'
  if (STABLES.some(stable => s.includes(stable))) return 'medium'
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
  // Try known address lookup first, fall back to DefiLlama UUID
  const address = lookupPoolAddress(p.project, tokenA, tokenB) || p.pool
  return {
    address,
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
    address: '5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6',
    tokenA: 'SOL', tokenB: 'USDC',
    protocol: 'Meteora',
    feeApr: 28.4, volume24h: 4200000, tvl: 18000000,
    ilRisk: 'medium', netApr: 21.3
  },
  {
    address: '4fuUiYxTgzQ6g8dPDE5FjsoT7Gvm82KEWgrYQ5hny7rS',
    tokenA: 'USDC', tokenB: 'USDT',
    protocol: 'Orca',
    feeApr: 8.2, volume24h: 980000, tvl: 42000000,
    ilRisk: 'low', netApr: 7.9
  },
  {
    address: '2po1ynXQhLL2XJ2AxfyYjK9nGTUFCpc9sqny4x7BG9Av',
    tokenA: 'SOL', tokenB: 'JTO',
    protocol: 'Meteora',
    feeApr: 67.3, volume24h: 1100000, tvl: 3200000,
    ilRisk: 'high', netApr: 44.1
  },
  {
    address: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4pcryoy2e7q',
    tokenA: 'SOL', tokenB: 'USDC',
    protocol: 'Orca',
    feeApr: 19.7, volume24h: 2800000, tvl: 9500000,
    ilRisk: 'medium', netApr: 15.2
  },
  {
    address: '9cQNX7kx5mGwMBGB8V3JVKB7WguwQSjB3ekjg1Z1s5Dm',
    tokenA: 'USDC', tokenB: 'USDT',
    protocol: 'Meteora',
    feeApr: 6.8, volume24h: 750000, tvl: 31000000,
    ilRisk: 'low', netApr: 6.6
  }
]

/** Fetch real Solana LP pools from DefiLlama — no API key required */
export async function fetchTopPools(
  riskProfile: RiskProfile
): Promise<Pool[]> {
  try {
    const res = await fetch('https://yields.llama.fi/pools')
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

/** Fetch pool detail — enriches with placeholder history for now.
 *  TODO: Replace hardcoded/mock data with real on-chain fee history. */
export async function fetchPoolDetail(
  poolAddress: string
): Promise<PoolDetail> {
  const pools = await fetchTopPools('high')
  const base = pools.find(p => p.address === poolAddress)
    ?? FALLBACK_POOLS[0]

  // Deterministic mock fee history from seed (avoids random jitter on every call)
  const seed = poolAddress.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const mockRandom = (i: number) => {
    const x = Math.sin(seed + i) * 10000
    return x - Math.floor(x)
  }

  return {
    ...base,
    feeHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 86400000)
        .toISOString().split('T')[0],
      fees: base.feeApr * 0.8 + mockRandom(i) * base.feeApr * 0.4
    })),
    // TODO: Fetch real price range from an oracle
    priceRange: { min: 120, max: 180, current: 148 }
  }
}
