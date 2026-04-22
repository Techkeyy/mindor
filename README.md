# Mindor — Intent to Execution

> DeFi LP simulation and execution platform on Solana

**"Describe your yield goal. See exactly what happens. Execute."**

## What is Mindor?

Mindor is an AI-powered DeFi liquidity provision platform 
that transforms natural language intent into on-chain LP 
positions on Solana — with full simulation before any 
capital moves.

## Live Demo

🌐 **https://mindor-git-main-techkeyys-projects.vercel.app**

## How It Works

1. **Intent** — Type your goal in plain English
   ("$2k, low risk, stable yield")
   
2. **Simulation** — Mindor fetches live pool data from 
   DefiLlama, runs IL and fee projections across 
   all scenarios
   
3. **Execution** — Connect Phantom wallet, 
   review the transaction, confirm on Solana

## Features

- 🧠 **AI Intent Parsing** — Groq (Llama 3.3 70B) 
  extracts capital, risk profile, duration from 
  natural language
- 📊 **Live Pool Data** — 486+ real Solana LP pools 
  from DefiLlama (updated hourly)
- 📈 **IL Scenario Analysis** — Bear/base/bull case 
  impermanent loss visualization
- ⏱ **Time-based Projections** — 7D/30D/90D/365D 
  fee earnings
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
- **LPAgent.io Sidetrack** — LP data integration 
  and simulation layer

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
LPAGENT_API_KEY=

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3001
