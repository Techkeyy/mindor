# Mindor - Intent to Execution

The first AI-powered DeFi LP simulation and 
execution platform on Solana.

## Live Demo
https://mindor-seven.vercel.app

## Telegram Bot
https://t.me/mindorr_bot

## What It Does

Type your investment goal in plain English.
Mindor simulates every outcome before your 
capital moves, then executes on Solana mainnet.

Intent to Simulation to Execution.

## Stack
- AI: Groq Llama 3.3 70b intent parsing
- Data: DefiLlama live Solana pool data
- Execution: Meteora DLMM on Solana Mainnet
- Frontend: Next.js 16 + Framer Motion + Recharts
- Bot: Telegram @mindorr_bot

## Features
- Natural language intent parsing
- Live fee projections 1D/7D/30D/1Y
- IL scenario analysis charts
- Real on-chain LP execution via Phantom wallet
- Persistent on-chain position tracking
- Public simulation API for AI agents
- Telegram bot integration

## Public Simulation API

POST /api/mindor/simulate
Body: { "intent": "2k low risk", "capitalUSD": 2000 }

Any AI agent can call this endpoint directly.

## Built For
100xDevs Frontier Hackathon
- 🤖 **Telegram Bot** — @MindorSimBot for 
  on-the-go simulations
- 🔌 **Open API** — Any AI agent can call 
  Mindor's simulation layer

## Public API
POST /api/mindor/simulate

```json
{
  "intent": "$2000, low risk, stable yield",
  "capitalUSD": 2000,
  "riskProfile": "low",
  "durationDays": 30
}
```

Returns 3 ranked strategies with full fee projections 
and IL analysis. No API key required.

## Tech Stack

- **Frontend** — Next.js 14, Framer Motion, Recharts
- **AI** — Groq API (Llama 3.3 70B)
- **Data** — DefiLlama Yields API (free, no key)
- **Blockchain** — Solana, Phantom Wallet
- **Bot** — Telegram Bot API
- **Deploy** — Vercel

## Hackathon Tracks

- **100xDevs Frontier Track** — Full-stack AI + 
  Blockchain application


## Architecture
User Intent (NL)
↓
Groq LLM Parser
↓
DefiLlama Pool Fetch (486+ Solana pools)
↓
Simulation Engine (IL math, fee projections)
↓
Strategy Ranking (Conservative/Balanced/Aggressive)
↓
Visual Simulation (charts, scenarios, projections)
↓
Solana Execution (Phantom wallet, on-chain tx)

## Environment Variables
GROQ_API_KEY=
TELEGRAM_BOT_TOKEN=
NEXT_PUBLIC_SOLANA_RPC=
NEXT_PUBLIC_APP_URL=

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3001
