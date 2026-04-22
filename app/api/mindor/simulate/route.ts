import { NextRequest, NextResponse } from 'next/server'
import { fetchTopPools } from '@/lib/lpagent'
import { rankStrategies, simulateFees, simulateIL } from '@/lib/simulation'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      intent,
      capitalUSD = 1000,
      riskProfile = 'medium',
    } = body

    let parsedRisk = riskProfile
    let parsedCapital = capitalUSD

    if (intent && typeof intent === 'string') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
      try {
        const intentRes = await fetch(`${baseUrl}/api/parse-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userMessage: intent,
          }),
        })
        const parsed = await intentRes.json()
        parsedRisk = parsed.riskProfile ?? riskProfile
        parsedCapital = parsed.capitalUSD ?? capitalUSD
      } catch {
        // Use provided values if parse fails
      }
    }

    const pools = await fetchTopPools(parsedRisk)

    if (!pools || pools.length === 0) {
      return NextResponse.json(
        { error: 'No pools available' },
        { status: 503 }
      )
    }

    const strategies = rankStrategies(
      pools,
      parsedCapital
    )

    const simulations = strategies.map(s => ({
      strategy: s,
      feeProjections: {
        daily: parseFloat(
          (parsedCapital * (s.pool.feeApr / 100) / 365)
            .toFixed(2)
        ),
        weekly: parseFloat(
          (parsedCapital * (s.pool.feeApr / 100) / 52)
            .toFixed(2)
        ),
        monthly: s.projectedMonthlyFees,
        yearly: parseFloat(
          (s.projectedMonthlyFees * 12).toFixed(2)
        ),
      },
      ilScenarios: simulateIL(s.pool, parsedCapital),
      feeChart: simulateFees(s.pool, parsedCapital, 30)
        .feesByDay,
    }))

    return NextResponse.json({
      success: true,
      input: {
        intent: intent ?? null,
        capitalUSD: parsedCapital,
        riskProfile: parsedRisk,
      },
      pools: pools.slice(0, 5),
      strategies,
      simulations,
      meta: {
        dataSource: 'DefiLlama',
        chain: 'Solana',
        protocols: ['Meteora', 'Orca-dex', 'Raydium'],
        timestamp: new Date().toISOString(),
        poolsAnalyzed: pools.length,
      }
    })
  } catch (err) {
    console.error('[simulate API] error:', err)
    return NextResponse.json(
      { error: 'Simulation failed', details: String(err) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Mindor Simulation API',
    version: '1.0.0',
    description:
      'Intent-to-simulation primitive for DeFi LP agents',
    endpoints: {
      'POST /api/mindor/simulate': {
        description:
          'Simulate LP strategies from natural language intent',
        body: {
          intent: 'string (optional) — natural language',
          capitalUSD: 'number — capital to deploy',
          riskProfile: 'low | medium | high',
        },
        returns:
          'strategies, fee projections, IL scenarios',
      }
    },
    dataSource: 'DefiLlama — 486+ live Solana pools',
    chain: 'Solana',
    github: 'https://github.com/Techkeyy/mindor',
  })
}
