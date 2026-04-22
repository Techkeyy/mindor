const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL

async function setupWebhook() {
  if (!BOT_TOKEN || !WEBHOOK_URL) {
    console.error(
      'Missing TELEGRAM_BOT_TOKEN or ' +
      'NEXT_PUBLIC_APP_URL in .env.local'
    )
    process.exit(1)
  }

  const url =
    `https://api.telegram.org/bot${BOT_TOKEN}` +
    `/setWebhook`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: `${WEBHOOK_URL}/api/telegram`,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  })

  const data = await res.json()
  console.log('Webhook setup result:', data)
}

setupWebhook()
