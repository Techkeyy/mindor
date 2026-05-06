# Mindor — Intent to Execution

> The first AI-powered DeFi LP simulation and 
> execution platform on Solana.

## What It Does

Describe your yield goal in plain English.
Mindor simulates every outcome before your 
capital moves — then executes on-chain.

**Intent → Simulation → Execution**

## Live Demo

https://mindor-seven.vercel.app

## Tech Stack

- **AI**: Groq (Llama 3.3 70b) for intent parsing
- **Data**: DefiLlama live pool data (486+ Solana pools)
- **Execution**: Meteora DLMM on Solana Mainnet
- **Frontend**: Next.js 16 + Framer Motion
- **Bot**: Telegram bot for mobile access

## Features

- Natural language intent parsing
- Live fee projections (1D/7D/30D/1Y)
- IL scenario analysis with dual charts
- Real on-chain LP execution via Phantom
- Persistent position tracking
- Public simulation API for agents
- Telegram bot integration

## Public API

Any AI agent can call the simulation layer:

POST /api/mindor/simulate
{
  "intent": "2k, low risk, stables",
  "capitalUSD": 2000
}

## Hackathon

Built for 100xDevs Frontier Hackathon
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
