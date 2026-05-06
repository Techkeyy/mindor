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
  pool: import('./defillama').Pool
  projectedMonthlyFees: number
  projectedILRisk: string
  confidenceScore: number
  recommendation: string
}

/** Calculate fee projections for a pool and capital amount */
export function simulateFees(
  pool: import('./defillama').Pool,
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
  pool: import('./defillama').Pool,
  capitalUSD: number,
  priceChangePercent: number = -30
): ILSimulation {
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
  pools: import('./defillama').Pool[],
  capitalUSD: number
): StrategyCard[] {
  const conservative = [...pools]
    .filter(p => p.ilRisk === 'low')
    .sort((a, b) => b.netApr - a.netApr)[0] ?? pools[0]

  const balanced = [...pools]
    .filter(p => p.ilRisk === 'medium')
    .sort((a, b) => b.netApr - a.netApr)[0] ?? pools[1]

  const aggressive = [...pools]
    .sort((a, b) => b.feeApr - a.feeApr)[0] ?? pools[2]

  const makeCard = (
    rank: 1 | 2 | 3,
    label: 'Conservative' | 'Balanced' | 'Aggressive',
    pool: import('./defillama').Pool
  ): StrategyCard => {
    const fees = simulateFees(pool, capitalUSD, 30)
    const il = simulateIL(pool, capitalUSD)
    return {
      rank, label, pool,
      projectedMonthlyFees: fees.monthlyFees,
      projectedILRisk: `~$${il.scenarios.bearCase} worst case`,
      confidenceScore: label === 'Conservative' ? 88 :
                       label === 'Balanced' ? 74 : 61,
      recommendation:
        label === 'Conservative'
          ? `Low-volatility ${pool.tokenA}/${pool.tokenB} pair on ${pool.protocol} — stable fees, minimal IL exposure.`
          : label === 'Balanced'
          ? `${pool.tokenA}/${pool.tokenB} on ${pool.protocol} offers strong fee APR with manageable IL risk.`
          : `High-yield ${pool.tokenA}/${pool.tokenB} on ${pool.protocol} — maximum fees, accept higher IL risk.`
    }
  }

  return [
    makeCard(1, 'Conservative', conservative),
    makeCard(2, 'Balanced', balanced),
    makeCard(3, 'Aggressive', aggressive)
  ]
}
