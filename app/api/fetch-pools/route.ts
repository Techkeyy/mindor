import { NextRequest, NextResponse } from 'next/server'
import { fetchTopPools } from '@/lib/defillama'
import { rankStrategies } from '@/lib/simulation'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { riskProfile = 'medium' } = body
    const rawCapital = Number(body.capitalUSD ?? 1000)
    const capitalUSD = Math.max(1000, rawCapital)

    const pools = await fetchTopPools(riskProfile)
    const strategies = rankStrategies(pools, capitalUSD)

    return NextResponse.json({
      pools,
      strategies,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('fetch-pools error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch pools' },
      { status: 500 }
    )
  }
}
