import { NextRequest, NextResponse } from 'next/server'
import { fetchTopPools } from '@/lib/defillama'
import { rankStrategies, simulateFees, simulateIL } from '@/lib/simulation'

// Simple in-memory rate limiter — 10 requests per minute per IP
const rateMap = new Map<string, number[]>()
const RATE_WINDOW = 60_000   // 1 minute
const RATE_MAX = 10           // max requests per window

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateMap.get(ip) ?? []
  const recent = timestamps.filter(t => now - t < RATE_WINDOW)
  if (recent.length >= RATE_MAX) return false
  recent.push(now)
  rateMap.set(ip, recent)
  // Periodic cleanup — only keep recent timestamps
  if (rateMap.size > 1000) {
    for (const [key, ts] of rateMap) {
      const filtered = ts.filter(t => now - t < RATE_WINDOW)
      if (filtered.length === 0) rateMap.delete(key)
      else rateMap.set(key, filtered)
    }
  }
  return true
}

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please wait.', retryAfter: '60s' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const {
      intent,
      capitalUSD = 1000,
      riskProfile = 'medium',
      durationDays = 30
    } = body

    // If intent string provided, parse it via Groq
    let resolvedRisk = riskProfile
    let resolvedCapital = capitalUSD
    let resolvedSummary = ''

    if (intent && typeof intent === 'string') {
      try {
        const intentRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/parse-intent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userMessage: intent }),
          }
        )
        const parsed = await intentRes.json()
        resolvedRisk = parsed.riskProfile ?? riskProfile
        resolvedCapital = parsed.capitalUSD ?? capitalUSD
        resolvedSummary = parsed.summary ?? ''
      } catch {
        // Use defaults if parsing fails
      }
    }

    const pools = await fetchTopPools(resolvedRisk)
    const strategies = rankStrategies(pools, resolvedCapital)

    // Enrich each strategy with full simulation data
    const enriched = strategies.map(s => {
      const fees = simulateFees(
        s.pool, resolvedCapital, durationDays
      )
      const il = simulateIL(s.pool, resolvedCapital)
      return {
        ...s,
        simulation: {
          fees: {
            daily: fees.dailyFees,
            weekly: fees.weeklyFees,
            monthly: fees.monthlyFees,
            annual: fees.monthlyFees * 12,
            byDay: fees.feesByDay,
          },
          impermanentLoss: {
            bearCase: il.scenarios.bearCase,
            baseCase: il.scenarios.baseCase,
            bullCase: il.scenarios.bullCase,
            netPnl30d: il.netPnl,
          },
        },
      }
    })

    return NextResponse.json({
      success: true,
      intent: {
        raw: intent ?? null,
        summary: resolvedSummary,
        capitalUSD: resolvedCapital,
        riskProfile: resolvedRisk,
        durationDays,
      },
      strategies: enriched,
      meta: {
        poolsAnalyzed: pools.length,
        dataSource: 'DefiLlama',
        chain: 'Solana',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    })

  } catch (err) {
    console.error('[mindor/simulate] error:', err)
    return NextResponse.json(
      {
        success: false,
        error: 'Simulation failed',
        message: String(err)
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Mindor Simulation API',
    version: '1.0.0',
    description:
      'Intent-to-simulation primitive for DeFi LP on Solana',
    endpoints: {
      simulate: 'POST /api/mindor/simulate',
      fetchPools: 'POST /api/fetch-pools',
      parseIntent: 'POST /api/parse-intent',
    },
    example: {
      request: {
        intent: '$2000, low risk, stable yield',
        capitalUSD: 2000,
        riskProfile: 'low',
        durationDays: 30,
      },
      response: {
        success: true,
        strategies: '[ 3 ranked strategies with full simulation data ]',
        meta: {
          poolsAnalyzed: 6,
          dataSource: 'DefiLlama',
          chain: 'Solana',
        },
      },
    },
  })
}
