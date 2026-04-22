# Mindor — Intent to Execution

> DeFi LP simulation and execution platform for Solana

**Live:** https://mindor-git-main-techkeyys-projects.vercel.app

## What It Does

Mindor is a simulation-first DeFi platform. You describe 
your investment goal in plain English. Mindor:

1. **Parses your intent** via Groq AI (Llama 3.3 70B)
2. **Fetches live pool data** from DefiLlama 
   (486+ real Solana pools)
3. **Simulates outcomes** — fee projections, 
   IL scenarios, best/worst case
4. **Executes on Solana** — one click, 
   Phantom wallet, atomic transaction

## Tracks

- **100xDevs Frontier Track** — Full-stack Solana 
  application with AI, blockchain execution, 
  and real DeFi data
- **LPAgent.io Sidetrack** — LP data intelligence 
  API integration

## Tech Stack

- **Frontend:** Next.js 14, Framer Motion, Recharts
- **AI:** Groq (Llama 3.3 70B) for intent parsing
- **Data:** DefiLlama Yields API (live, no API key)
- **Blockchain:** Solana, Phantom Wallet
- **Bot:** Telegram webhook integration
- **Deploy:** Vercel

## Public API

Any AI agent can call Mindor's simulation layer:

```bash
curl -X POST https://mindor-git-main-techkeyys-projects.vercel.app/api/mindor/simulate \
  -H "Content-Type: application/json" \
  -d '{"intent": "2000 dollars low risk stable yield"}'
```

Returns strategies, fee projections, and IL scenarios 
for any natural language LP intent.

## Architecture

```
User Intent (NL)
	↓
  Groq LLM Parser
	↓
DefiLlama Pool Fetch (486+ Solana pools)
	↓
Simulation Engine (fee math + IL curves)
	↓
Visual Strategy Cards (3 ranked options)
	↓
Phantom Wallet → Solana Execution
	↓
Position Confirmed
```

## Telegram Bot

Send your intent to @MindorSimBot on Telegram.
Get strategy simulations back in seconds.

## Local Development

```bash
npm install
cp .env.local.example .env.local
# Add your API keys
npm run dev
```

## Environment Variables

```
GROQ_API_KEY=
TELEGRAM_BOT_TOKEN=
NEXT_PUBLIC_SOLANA_RPC=
NEXT_PUBLIC_APP_URL=
```
