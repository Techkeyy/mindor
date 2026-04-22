import { NextRequest, NextResponse } from 'next/server'
import { fetchTopPools } from '@/lib/lpagent'
import { rankStrategies } from '@/lib/simulation'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
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
    const body = await req.json()
    const message = body?.message
    if (!message) {
      return NextResponse.json({ ok: true })
    }

    const chatId: number = message.chat.id
    const text: string = message.text ?? ''
    const firstName: string =
      message.from?.first_name ?? 'there'

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
        `I'll find the best Solana LP pools for you. ⚡`
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /help command
    if (text === '/help') {
      await sendMessage(chatId,
        `<b>Mindor Bot Commands</b>\n\n` +
        `/start — Introduction\n` +
        `/help — Show this message\n\n` +
        `<b>How to use:</b>\n` +
        `Just describe your investment goal in ` +
        `plain English and I'll simulate the best ` +
        `LP strategies for you.\n\n` +
        `<b>Example inputs:</b>\n` +
        `• "$5000 low risk stablecoins"\n` +
        `• "aggressive yield 10k"\n` +
        `• "2000 dollars balanced approach"`
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
