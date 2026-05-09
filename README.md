# Mindor

> Natural language → Solana LP execution → Monitor. Type what you want. Click execute. Get alerts.

[![Deploy](https://img.shields.io/badge/vercel-deployed-black)](https://mindor-seven.vercel.app)
[![Solana](https://img.shields.io/badge/Solana-mainnet-blue)](https://explorer.solana.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## The Problem

95% of people who know about DeFi have never provided liquidity. Not because they don't want the 28%+ APR — because the barrier is insane:

- Research which pools exist across 5+ DEXes
- Understand impermanent loss math for each pool type
- Configure bin ranges correctly (Meteora DLMM)
- Calculate gas, rent, and deposit splits manually
- Monitor positions post-execution so they don't exit range

Most people give up at step one. Mindor collapses all of this into a single sentence.

---

## What Mindor Does

```
You: "$2 high yield"
Mindor: 3 strategies found. SOL/USDC on Meteora at 28.4% APR. Execute?
You: Click. Sign in Phantom.
Mindor: Position opened. Monitoring enabled. P&L tracking live.
```

**Three stages, one product:**

| Stage | What happens |
|---|---|
| **Intent → Simulation** | Parses natural language, fetches live DefiLlama pools, ranks strategies by fee APR and IL risk |
| **Execute** | Opens real Meteora DLMM positions on Solana mainnet via Phantom wallet |
| **Monitor** | Tracks bin ranges, sends Telegram alerts for exit risk and fee accumulation |

---

## Features

- 🔮 **Natural language intent** — "$500 low risk" or "max yield 2k aggressive" — just type
- 📊 **Live simulation** — DefiLlama pool data, Meteora DLMM fee APR, IL scenario analysis
- ⚡ **On-chain execution** — Real `initializePositionAndAddLiquidityByStrategy` via Phantom
- 💰 **P&L dashboard** — On-chain position value, unclaimed fees, ROI tracking
- 🔔 **Position monitoring** — Telegram alerts when your LP nears exit range or fees accumulate
- 🤖 **Telegram bot** — Full simulation engine accessible via @mindorr_bot
- 📱 **Mobile-first PWA** — Works on desktop and phone, dark theme

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Chain** | Solana mainnet |
| **LP Protocol** | Meteora DLMM (`@meteora-ag/dlmm`) |
| **Pool Discovery** | DefiLlama API |
| **Intent Parsing** | DeepSeek API |
| **Frontend** | Next.js 16 (App Router) + Framer Motion + Recharts |
| **Backend** | Next.js API routes (Vercel serverless) |
| **Wallet** | Phantom browser extension |
| **Monitoring** | Vercel Cron Jobs + Telegram Bot API |
| **Deployment** | Vercel |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend (PWA)                  │
│  Intent Terminal → Simulation Results → Execution Modal      │
│  Positions Panel → P&L Dashboard → Monitor Button            │
└────────────┬──────────────────────────┬─────────────────────┘
             │                          │
    ┌────────▼────────┐       ┌────────▼────────┐
    │  /api/parse-intent │       │  /api/fetch-pools │
    │  (DeepSeek NLP)    │       │  (DefiLlama API)  │
    └───────────────────┘       └───────────────────┘
             │                          │
    ┌────────▼──────────────────────────▼─────────────────────┐
    │                  /api/mindor/simulate                     │
    │  Combines intent + pools → ranked strategies + IL math   │
    └──────────────────────────────────────────────────────────┘
             │
    ┌────────▼────────┐       ┌────────────────────────────┐
    │  Phantom Wallet  │       │  Meteora DLMM (on-chain)    │
    │  (client-side)   │──────▶│  initializePosition         │
    │                  │       │  addLiquidityByStrategy      │
    └──────────────────┘       └────────────────────────────┘
                                         │
    ┌────────────────────────────────────▼───────────────────┐
    │                  /api/monitor (cron)                     │
    │  Checks active bin vs position range → Telegram alerts   │
    │  Checks unclaimed fees → compound alerts                 │
    └─────────────────────────────────────────────────────────┘
                                         │
                                  ┌──────▼──────┐
                                  │  @mindorr_bot │
                                  │  (Telegram)   │
                                  └───────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Phantom wallet browser extension
- Telegram account (for monitoring alerts)

### Local Development

```bash
git clone https://github.com/Techkeyy/mindor.git
cd mindor
pnpm install
cp .env.local.example .env.local
# Edit .env.local with your API keys
pnpm dev
```

### Environment Variables

```env
# Required
DEEPSEEK_API_KEY=sk-...              # DeepSeek API for intent parsing
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional
NEXT_PUBLIC_SOLANA_RPC=              # Custom RPC (defaults to public mainnet)
TELEGRAM_BOT_TOKEN=                  # For Telegram bot + monitoring alerts
TELEGRAM_WEBHOOK_SECRET=             # Webhook validation secret
```

### Deploy

```bash
vercel --prod
```

Set the same environment variables in your Vercel project dashboard.

---

## Commands

### Web App

| Action | How |
|---|---|
| Simulate | Type your intent (e.g., "$500 low risk") → Enter |
| Execute | Click a strategy card → Connect Phantom → Confirm |
| Monitor | Click 🔔 MONITOR on a position → Enter Telegram chat ID |
| View P&L | Click a position → Expand → Click REFRESH P&L |
| Claim Fees | Expand position → Click CLAIM |
| Withdraw | Expand position → Click WITHDRAW |

### Telegram Bot (@mindorr_bot)

| Command | Description |
|---|---|
| `/start` | Welcome message + your chat ID |
| `/help` | All commands |
| `/chatid` | Show your chat ID for monitoring |
| `/monitor [address] [pool] [lower] [upper]` | Register a position for alerts |
| `$2 high yield` | Run a simulation |

---

## Monitoring Alerts

After registering a position, you'll receive Telegram messages for:

| Alert | Trigger |
|---|---|
| ⚠ **Exit warning** | Active bin within 2 bins of your position range |
| ✅ **Safe return** | Price moves back into your range |
| 💰 **Fees accumulated** | Unclaimed fees exceed $0.50 |

Checks run daily via Vercel Cron (hourly on Pro plan). Trigger manually:
```bash
curl https://mindor-seven.vercel.app/api/monitor
```

---

## Known Limitations

- **IL estimates**: Uses constant-product AMM math. Meteora DLMM concentrated-liquidity bins have different IL characteristics. Treat IL numbers as directional only.
- **Execution**: Meteora DLMM pools only (Orca coming soon). Spot strategy only (type 0).
- **Monitoring**: Daily cron on Vercel Hobby plan. Upgrade to Pro for sub-hour checks.
- **Chains**: Solana mainnet only.

---

## License

MIT © Techkeyy
