import { NextRequest, NextResponse } from 'next/server'
import { fetchTopPools } from '@/lib/lpagent'
import { rankStrategies } from '@/lib/simulation'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      riskProfile = 'medium',
      capitalUSD = 1000,
    } = body

    console.log('[fetch-pools] request:', {
      riskProfile, capitalUSD
    })

    const pools = await fetchTopPools(riskProfile)

    console.log('[fetch-pools] pools count:', pools.length)

    if (!pools || pools.length === 0) {
      return NextResponse.json(
        {
          error: 'No live pools available right now. Try a different risk profile.',
          pools: [],
          strategies: []
        },
        { status: 200 }
      )
    }

    const strategies = rankStrategies(pools, capitalUSD)

    console.log('[fetch-pools] strategies count:',
      strategies.length)

    if (!strategies || strategies.length === 0) {
      return NextResponse.json(
        { error: 'No strategies generated' },
        { status: 500 }
      )
    }

    const response = {
      pools,
      strategies,
      timestamp: new Date().toISOString()
    }

    console.log('[fetch-pools] returning response with',
      response.strategies.length, 'strategies')

    return NextResponse.json(response)
  } catch (err) {
    console.error('[fetch-pools] error:', err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
