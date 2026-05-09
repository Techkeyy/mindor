import { NextRequest, NextResponse } from 'next/server'
import { fetchTopPools } from '@/lib/defillama'
import { rankStrategies } from '@/lib/simulation'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL
  ?? 'https://mindor.xyz'

async function sendMessage(
  chatId: number,
  text: string,
  parseMode: string = 'HTML'
) {
  if (!BOT_TOKEN) return
  await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    }
  )
}

/**
 * Parse the user's intent by calling the internal parse-intent API.
 */
async function parseIntentViaGroq(
  userMessage: string
): Promise<{
  capitalUSD: number
  riskProfile: 'low' | 'medium' | 'high'
  durationDays: number
  summary: string
}> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/parse-intent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage }),
      }
    )
    return await res.json()
  } catch {
    return {
      capitalUSD: 1000,
      riskProfile: 'medium',
      durationDays: 30,
      summary: 'Balanced deployment',
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify the request is from Telegram via secret token header
    if (SECRET_TOKEN) {
      const headerToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
      if (headerToken !== SECRET_TOKEN) {
        console.error('[telegram] missing or invalid secret token, rejecting request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const message = body?.message
    if (!message) {
      return NextResponse.json({ ok: true })
    }

    const chatId: number = message.chat.id
    const text: string = message.text ?? ''
    const firstName: string =
      message.from?.first_name ?? 'there'

    // Handle /start with deep-link monitoring parameter
    if (text.startsWith('/start mon_')) {
      const payload = text.slice(12) // everything after "/start mon_"
      const parts = payload.split('_')
      const positionAddress = parts[0]
      const poolAddress = parts[1] || ''
      const lowerBinId = parseInt(parts[2]) || 0
      const upperBinId = parseInt(parts[3]) || 0

      if (positionAddress && positionAddress.length > 30) {
        try {
          const monRes = await fetch(`${BASE_URL}/api/monitor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'register',
              positionAddress,
              poolAddress,
              lowerBinId,
              upperBinId,
              chatId,
            }),
          })
          const monData = await monRes.json()
          if (monData.ok) {
            await sendMessage(chatId,
              `✅ <b>Monitoring enabled!</b>\n\n` +
              `Position: <code>${positionAddress.slice(0, 12)}...</code>\n\n` +
              `You'll receive alerts for:\n` +
              `• ⚠ Bin exit proximity\n` +
              `• 💰 Fee accumulation\n\n` +
              `<i>Alerts arrive here automatically.</i>`
            )
          } else {
            await sendMessage(chatId, `❌ Registration failed: ${monData.error || 'unknown'}`)
          }
        } catch (e: any) {
          await sendMessage(chatId, `❌ Error: ${e.message}`)
        }
        return NextResponse.json({ ok: true })
      }
    }

    // Handle /start command
    if (text === '/start') {
      await sendMessage(chatId,
        `👋 <b>Welcome to Mindor, ${firstName}!</b>\n\n` +
        `I simulate DeFi LP strategies before ` +
        `your capital moves.\n\n` +
        `Just tell me your goal. Examples:\n` +
        `• <i>"$2000, low risk, stable yield"</i>\n` +
        `• <i>"5k aggressive, max APR"</i>\n` +
        `• <i>"1000 dollars medium risk"</i>\n\n` +
        `I'll find the best Solana LP pools for you. ⚡\n\n` +
        `<b>🔔 Position Monitoring:</b>\n` +
        `After opening a position on the web app, ` +
        `click 🔔 MONITOR and enter your chat ID: ` +
        `<code>${chatId}</code>\n` +
        `Or type /chatid to see it again.`
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /chatid command
    if (text === '/chatid') {
      await sendMessage(chatId,
        `<b>Your Chat ID</b>\n\n` +
        `<code>${chatId}</code>\n\n` +
        `Use this in the Mindor web app when ` +
        `clicking 🔔 MONITOR on a position.\n\n` +
        `<a href="${BASE_URL}/app">Open Mindor →</a>`
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /monitor command — paste your position address to register
    if (text.startsWith('/monitor') && text.length > 10) {
      const args = text.slice(9).trim().split(/\s+/)
      const positionAddress = args[0]
      if (positionAddress && positionAddress.length > 30) {
        try {
          const monRes = await fetch(`${BASE_URL}/api/monitor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'register',
              positionAddress,
              poolAddress: args[1] || '',
              lowerBinId: parseInt(args[2]) || 0,
              upperBinId: parseInt(args[3]) || 0,
              chatId,
            }),
          })
          const monData = await monRes.json()
          if (monData.ok) {
            await sendMessage(chatId,
              `✅ <b>Monitoring enabled!</b>\n\n` +
              `Position: <code>${positionAddress.slice(0, 12)}...</code>\n\n` +
              `You'll receive alerts for:\n` +
              `• ⚠ Bin exit proximity\n` +
              `• 💰 Fee accumulation\n\n` +
              `<i>Checks run every 15 minutes.</i>`
            )
          } else {
            await sendMessage(chatId, `❌ Registration failed: ${monData.error || 'unknown'}`)
          }
        } catch (e: any) {
          await sendMessage(chatId, `❌ Error: ${e.message}`)
        }
      } else {
        await sendMessage(chatId, 
          `<b>📋 Monitor Registration</b>\n\n` +
          `Use: <code>/monitor [positionAddress] [poolAddress] [lowerBin] [upperBin]</code>\n\n` +
          `Example: <code>/monitor 5rCf1DM... 0xPool 100 200</code>\n\n` +
          `<i>Find these values in the Mindor web app after opening a position.</i>\n` +
          `<a href="${BASE_URL}/app">Open Mindor →</a>`
        )
      }
      return NextResponse.json({ ok: true })
    }

    // Handle /help command
    if (text === '/help') {
      await sendMessage(chatId,
        `<b>Mindor Bot Commands</b>\n\n` +
        `/start — Introduction\n` +
        `/help — Show this message\n` +
        `/chatid — Show your chat ID for monitoring\n` +
        `/monitor — Register a position for alerts\n\n` +
        `<b>How to use:</b>\n` +
        `Just describe your investment goal in ` +
        `plain English and I'll simulate the best ` +
        `LP strategies for you.\n\n` +
        `<b>Example inputs:</b>\n` +
        `• "$5000 low risk stablecoins"\n` +
        `• "aggressive yield 10k"\n` +
        `• "2000 dollars balanced approach"\n\n` +
        `<b>🔔 Monitoring:</b>\n` +
        `After opening a position on the web app, ` +
        `click 🔔 MONITOR and enter your chat ID, ` +
        `or use /monitor command here directly.\n` +
        `<a href="${BASE_URL}/app">Open Mindor →</a>`
      )
      return NextResponse.json({ ok: true })
    }

    // Skip non-text or empty messages
    if (!text || text.startsWith('/')) {
      return NextResponse.json({ ok: true })
    }

    // Send typing indicator
    if (BOT_TOKEN) {
      await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            action: 'typing',
          }),
        }
      )
    }

    // Parse intent
    const intent = await parseIntentViaGroq(text)

    // Fetch live pools
    const pools = await fetchTopPools(intent.riskProfile)

    if (!pools || pools.length === 0) {
      await sendMessage(chatId,
        `⚠️ No live pools found for your criteria.\n` +
        `Try adjusting your risk preference.`
      )
      return NextResponse.json({ ok: true })
    }

    // Generate strategies
    const strategies = rankStrategies(
      pools,
      intent.capitalUSD
    )

    if (!strategies || strategies.length === 0) {
      await sendMessage(chatId,
        `⚠️ Could not generate strategies. ` +
        `Please try again.`
      )
      return NextResponse.json({ ok: true })
    }

    // Build response message
    const riskEmoji = {
      low: '🟢', medium: '🟡', high: '🔴'
    }[intent.riskProfile]

    const lines = [
      `<b>🧠 Mindor Simulation</b>`,
      ``,
      `<b>Intent:</b> ${intent.summary}`,
      `<b>Capital:</b> $${intent.capitalUSD.toLocaleString()}`,
      `<b>Risk:</b> ${riskEmoji} ${intent.riskProfile.toUpperCase()}`,
      ``,
      `<b>📊 Top 3 Strategies:</b>`,
      ``,
    ]

    strategies.forEach((s, i) => {
      const emoji = ['✅', '⚡', '🔥'][i]
      lines.push(
        `${emoji} <b>${s.label}</b>: ` +
        `${s.pool.tokenA}/${s.pool.tokenB} ` +
        `on ${s.pool.protocol}\n` +
        `   └ ${s.pool.feeApr.toFixed(1)}% APR\n` +
        `   └ 7d: $${((s.projectedMonthlyFees / 30) * 7)
          .toFixed(2)} · ` +
        `30d: $${s.projectedMonthlyFees.toFixed(2)} · ` +
        `1y: $${(s.projectedMonthlyFees * 12).toFixed(2)}`
      )
    })

    lines.push(``)
    lines.push(
      `🔗 <a href="${BASE_URL}/app">` +
      `View full simulation →</a>`
    )

    await sendMessage(chatId, lines.join('\n'))
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[telegram webhook] error:', err)
    return NextResponse.json({ ok: true })
  }
}

// GET handler for webhook verification
export async function GET() {
  return NextResponse.json({
    status: 'Mindor Telegram Bot active'
  })
}
