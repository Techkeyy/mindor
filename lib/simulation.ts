export type FeeSimulation = {
  dailyFees: number
  weeklyFees: number
  monthlyFees: number
  totalFees: number
  feesByDay: { day: number; cumulative: number }[]
}

export type ILSimulation = {
  ilLoss: number
  ilPercent: number
  netPnl: number
  scenarios: {
    bearCase: number
    baseCase: number
    bullCase: number
  }
}

export type StrategyCard = {
  rank: 1 | 2 | 3
  label: 'Conservative' | 'Balanced' | 'Aggressive'
  pool: import('./lpagent').Pool
  projectedMonthlyFees: number
  projectedILRisk: string
  confidenceScore: number
  recommendation: string
}

import { FALLBACK_POOLS } from './lpagent'

/** Calculate fee projections for a pool and capital amount */
export function simulateFees(
  pool: import('./lpagent').Pool,
  capitalUSD: number,
  days: number = 30
): FeeSimulation {
  const dailyFees = capitalUSD * (pool.feeApr / 100) / 365
  let cumulative = 0
  const feesByDay = Array.from({ length: days }, (_, i) => {
    cumulative += dailyFees
    return { day: i + 1, cumulative: Math.round(cumulative * 100) / 100 }
  })
  return {
    dailyFees: Math.round(dailyFees * 100) / 100,
    weeklyFees: Math.round(dailyFees * 7 * 100) / 100,
    monthlyFees: Math.round(dailyFees * 30 * 100) / 100,
    totalFees: Math.round(dailyFees * days * 100) / 100,
    feesByDay
  }
}

/** Simulate impermanent loss across price scenarios */
export function simulateIL(
  pool: import('./lpagent').Pool,
  capitalUSD: number,
  priceChangePercent: number = -30
): ILSimulation {
  // Stablecoin pairs have near-zero IL
  const stables = [
    'USDC', 'USDT', 'DAI', 'FRAX',
    'CASH', 'USDH', 'USDS', 'SYRUP'
  ]
  const tokens = [pool.tokenA, pool.tokenB]
  const isStablePair = tokens.every(t =>
    stables.some(s =>
      t.toUpperCase().includes(s)
    )
  )

  if (isStablePair) {
    return {
      ilLoss: 0,
      ilPercent: 0,
      netPnl: simulateFees(pool, capitalUSD, 30)
        .monthlyFees,
      scenarios: {
        bearCase: 0,
        baseCase: 0,
        bullCase: 0,
      }
    }
  }

  const calcIL = (changePct: number) => {
    const r = 1 + changePct / 100
    const il = (2 * Math.sqrt(r) / (1 + r)) - 1
    return Math.abs(il * capitalUSD)
  }
  const ilLoss = calcIL(priceChangePercent)
  const fees30d = simulateFees(pool, capitalUSD, 30).totalFees
  return {
    ilLoss: Math.round(ilLoss * 100) / 100,
    ilPercent: Math.round((ilLoss / capitalUSD) * 10000) / 100,
    netPnl: Math.round((fees30d - ilLoss) * 100) / 100,
    scenarios: {
      bearCase: Math.round(calcIL(-50) * 100) / 100,
      baseCase: Math.round(calcIL(-20) * 100) / 100,
      bullCase: Math.round(calcIL(50) * 100) / 100
    }
  }
}

/** Rank pools into 3 strategies: Conservative, Balanced, Aggressive */
export function rankStrategies(
  pools: import('./lpagent').Pool[],
  capitalUSD: number
): StrategyCard[] {
  if (!pools || pools.length === 0) {
    console.error('[rankStrategies] no pools provided')
    return buildFallbackStrategies(capitalUSD)
  }

  try {

    // Conservative: MUST be low ilRisk,
    // then highest netApr
    const conservativePools = pools
      .filter(p => p.ilRisk === 'low')
      .sort((a, b) => b.netApr - a.netApr)

    // Balanced: medium ilRisk preferred,
    // fallback to low, never high
    const balancedPools = pools
      .filter(p => p.ilRisk === 'medium')
      .sort((a, b) => b.netApr - a.netApr)

    // Aggressive: highest raw feeApr, any risk
    const aggressivePools = [...pools]
      .sort((a, b) => b.feeApr - a.feeApr)

    // Ensure all 3 are different pools
    const conservative = conservativePools[0]
      ?? pools.sort((a, b) => a.feeApr - b.feeApr)[0]

    const balanced = balancedPools
      .find(p => p.address !== conservative.address)
      ?? pools.find(p =>
        p.address !== conservative.address
      )
      ?? pools[1]

    const aggressive = aggressivePools
      .find(p =>
        p.address !== conservative.address &&
        p.address !== balanced.address
      )
      ?? pools[2]

    if (!conservative || !balanced || !aggressive) {
      console.error('[rankStrategies] incomplete live selection')
      return buildFallbackStrategies(capitalUSD)
    }

    const makeCard = (
      rank: 1 | 2 | 3,
      label: 'Conservative' | 'Balanced' | 'Aggressive',
      pool: import('./lpagent').Pool
    ): StrategyCard => {
      const fees = simulateFees(pool, capitalUSD, 30)
      const il = simulateIL(pool, capitalUSD)
      return {
        rank, label, pool,
        projectedMonthlyFees: fees.monthlyFees,
        projectedILRisk: il.scenarios.bearCase === 0
          ? '~$0 (stable pair)'
          : il.scenarios.bearCase < 1
          ? '<$1 worst case'
          : `~$${il.scenarios.bearCase.toFixed(0)} worst`,
        confidenceScore:
          label === 'Conservative' ? 88 :
          label === 'Balanced' ? 74 : 61,
        recommendation:
          label === 'Conservative'
            ? `Low-volatility ${pool.tokenA}/${pool.tokenB} on ${pool.protocol} — stable fees, minimal IL exposure.`
            : label === 'Balanced'
            ? `${pool.tokenA}/${pool.tokenB} on ${pool.protocol} offers strong fee APR with manageable IL risk.`
            : `High-yield ${pool.tokenA}/${pool.tokenB} on ${pool.protocol} — maximum fees, accept higher IL risk.`
      }
    }

    const strategies = [
      makeCard(1, 'Conservative', conservative),
      makeCard(2, 'Balanced', balanced),
      makeCard(3, 'Aggressive', aggressive),
    ]

    if (strategies.length !== 3) {
      console.error('[rankStrategies] invalid strategy count:',
        strategies.length)
      return []
    }

    return strategies
  } catch (err) {
    console.error('[rankStrategies] error:', err)
    return buildFallbackStrategies(capitalUSD)
  }
}

function buildFallbackStrategies(capitalUSD: number): StrategyCard[] {
  return FALLBACK_POOLS.slice(0, 3).map((pool, index) => {
    const label = index === 0
      ? 'Conservative'
      : index === 1
        ? 'Balanced'
        : 'Aggressive'
    const fees = simulateFees(pool, capitalUSD, 30)
    const il = simulateIL(pool, capitalUSD)
    return {
      rank: (index + 1) as 1 | 2 | 3,
      label,
      pool,
      projectedMonthlyFees: fees.monthlyFees,
      projectedILRisk: il.scenarios.bearCase === 0
        ? '~$0 (stable pair)'
        : il.scenarios.bearCase < 1
        ? '<$1 worst case'
        : `~$${il.scenarios.bearCase.toFixed(0)} worst`,
      confidenceScore: index === 0 ? 88 : index === 1 ? 74 : 61,
      recommendation:
        label === 'Conservative'
          ? `Low-volatility ${pool.tokenA}/${pool.tokenB} on ${pool.protocol} — stable fees, minimal IL exposure.`
          : label === 'Balanced'
          ? `${pool.tokenA}/${pool.tokenB} on ${pool.protocol} offers strong fee APR with manageable IL risk.`
          : `High-yield ${pool.tokenA}/${pool.tokenB} on ${pool.protocol} — maximum fees, accept higher IL risk.`
    } as StrategyCard
  })
}
