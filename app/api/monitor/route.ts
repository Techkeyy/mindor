import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import { clusterApiUrl } from '@solana/web3.js'
import BN from 'bn.js'

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl('mainnet-beta'),
  { commitment: 'confirmed' }
)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mindor.xyz'

type MonitoredPosition = {
  positionAddress: string
  poolAddress: string
  lowerBinId: number
  upperBinId: number
  chatId: number
  registeredAt: number
  lastAlertedBin: number | null
  lastAlertedFees: number
}

// In-memory store (persists across warm invocations on Vercel)
const positions = new Map<string, MonitoredPosition>()

async function sendTelegram(chatId: number, text: string) {
  if (!BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
  } catch (e) {
    console.error('[monitor] telegram send failed:', e)
  }
}

// POST — register a position for monitoring
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'register') {
      const { positionAddress, poolAddress, lowerBinId, upperBinId, chatId } = body
      if (!positionAddress || !poolAddress || lowerBinId == null || upperBinId == null || !chatId) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      const key = `${chatId}:${positionAddress}`
      positions.set(key, {
        positionAddress,
        poolAddress,
        lowerBinId: Number(lowerBinId),
        upperBinId: Number(upperBinId),
        chatId: Number(chatId),
        registeredAt: Date.now(),
        lastAlertedBin: null,
        lastAlertedFees: 0,
      })

      console.log(`[monitor] registered position ${positionAddress.slice(0, 8)}... for chat ${chatId}`)
      return NextResponse.json({ ok: true, monitored: positions.size })
    }

    if (action === 'unregister') {
      const { positionAddress, chatId } = body
      const key = `${chatId}:${positionAddress}`
      positions.delete(key)
      return NextResponse.json({ ok: true, monitored: positions.size })
    }

    if (action === 'list') {
      const { chatId } = body
      const userPositions = Array.from(positions.values()).filter(p => p.chatId === chatId)
      return NextResponse.json({ positions: userPositions.map(p => ({
        positionAddress: p.positionAddress,
        poolAddress: p.poolAddress,
        lowerBinId: p.lowerBinId,
        upperBinId: p.upperBinId,
      })) })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[monitor] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — cron endpoint: check all positions and send alerts
export async function GET() {
  if (positions.size === 0) {
    return NextResponse.json({ ok: true, checked: 0 })
  }

  let checked = 0
  let alerted = 0
  const EXIT_BIN_THRESHOLD = 2 // alert when within 2 bins of exit
  const FEE_ALERT_THRESHOLD = 0.50 // alert when unclaimed fees > $0.50
  const FEE_ALERT_COOLDOWN = 3600000 // 1 hour between fee alerts

  for (const [key, pos] of positions) {
    try {
      checked++
      const DLMM = (await import('@meteora-ag/dlmm')).default
      const poolPubkey = new PublicKey(pos.poolAddress)
      const dlmmPool = await DLMM.create(connection, poolPubkey)
      const activeBin = await dlmmPool.getActiveBin()
      const activeBinId = activeBin.binId

      // Check bin exit proximity
      const distanceToLower = activeBinId - pos.lowerBinId
      const distanceToUpper = pos.upperBinId - activeBinId
      const nearExit = distanceToLower <= EXIT_BIN_THRESHOLD || distanceToUpper <= EXIT_BIN_THRESHOLD

      if (nearExit && pos.lastAlertedBin !== activeBinId) {
        const direction = distanceToLower <= EXIT_BIN_THRESHOLD ? 'below' : 'above'
        const exitBin = direction === 'below' ? pos.lowerBinId : pos.upperBinId
        const binsRemaining = direction === 'below' ? distanceToLower : distanceToUpper

        await sendTelegram(pos.chatId,
          `⚠️ <b>Position Alert — Mindor</b>\n\n` +
          `<b>Pool:</b> <code>${pos.poolAddress.slice(0, 8)}...</code>\n` +
          `<b>Status:</b> ${binsRemaining} bin(s) from exiting ${direction}\n` +
          `<b>Active bin:</b> ${activeBinId}\n` +
          `<b>Your range:</b> ${pos.lowerBinId}–${pos.upperBinId}\n\n` +
          `<i>Your position earns zero fees outside this range. Consider adjusting.</i>\n\n` +
          `<a href="${BASE_URL}/app">Open Mindor →</a>`
        )

        pos.lastAlertedBin = activeBinId
        alerted++
        console.log(`[monitor] alerted chat ${pos.chatId}: bin ${activeBinId} near exit (${direction})`)
      }

      // Reset alert if price moves back into safe range
      if (!nearExit && pos.lastAlertedBin !== null) {
        await sendTelegram(pos.chatId,
          `✅ <b>Position Safe — Mindor</b>\n\n` +
          `<b>Pool:</b> <code>${pos.poolAddress.slice(0, 8)}...</code>\n` +
          `<b>Active bin:</b> ${activeBinId} — back within your range (${pos.lowerBinId}–${pos.upperBinId})\n\n` +
          `<i>Your position is earning fees again.</i>`
        )
        pos.lastAlertedBin = null
        alerted++
      }

      // Check unclaimed fees
      try {
        const positionPubkey = new PublicKey(pos.positionAddress)
        const lbPosition = await dlmmPool.getPosition(positionPubkey)
        const pd = lbPosition.positionData
        if (pd) {
          const feeX = (pd.feeX?.toNumber() ?? 0) / 1e9
          const feeY = (pd.feeY?.toNumber() ?? 0) / 1e6
          const totalFees = (feeX * 150) + feeY // rough SOL + USDC estimate

          const now = Date.now()
          if (totalFees >= FEE_ALERT_THRESHOLD && (now - pos.lastAlertedFees) > FEE_ALERT_COOLDOWN) {
            await sendTelegram(pos.chatId,
              `💰 <b>Fees Accumulated — Mindor</b>\n\n` +
              `<b>Unclaimed fees:</b> ~$${totalFees.toFixed(2)}\n` +
              `<b>Breakdown:</b> ${feeX.toFixed(6)} SOL + ${feeY.toFixed(4)} USDC\n\n` +
              `<i>Claim to compound your earnings.</i>\n\n` +
              `<a href="${BASE_URL}/app">Claim now →</a>`
            )
            pos.lastAlertedFees = now
            alerted++
            console.log(`[monitor] fee alert chat ${pos.chatId}: $${totalFees.toFixed(2)}`)
          }
        }
      } catch (feeErr) {
        // Fee check is best-effort — don't fail the whole check
        console.warn('[monitor] fee check failed for', pos.positionAddress.slice(0, 8))
      }

    } catch (err: any) {
      console.error(`[monitor] check failed for ${key}:`, err.message)
      // Remove stale positions that fail consistently (pool may be closed)
      if (err.message?.includes('Invalid') || err.message?.includes('not found')) {
        positions.delete(key)
        console.log(`[monitor] removed stale position ${key}`)
      }
    }
  }

  return NextResponse.json({ ok: true, checked, alerted, monitored: positions.size })
}
