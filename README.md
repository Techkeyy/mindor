# Mindor - Intent to Execution

> The first AI-powered DeFi LP simulation and 
> execution platform on Solana.

**Live Demo:** https://mindor-seven.vercel.app  
**Telegram Bot:** https://t.me/mindorr_bot

---

## What It Does

Type your investment goal in plain English.
Mindor parses your intent with AI, fetches live 
pool data, simulates every outcome, then executes 
a real LP position on Solana mainnet — all in one flow.

**Intent → Simulation → Execution**

---

## The Problem

DeFi liquidity provision is one of the best yield 
opportunities in crypto. But almost nobody does it 
well because:

- Thousands of pools with no clear signal
- Impermanent loss is invisible until it hits
- Execution requires technical knowledge

Mindor solves all three in a single interface.

---

## Features

- **AI Intent Parsing** — Groq Llama 3.3 70b
- **Live Pool Data** — 486+ Solana pools via DefiLlama
- **Simulation** — Fee projections (1D/7D/30D/1Y) + IL analysis
- **Real Execution** — Meteora DLMM on Solana Mainnet
- **Persistent Positions** — On-chain position loading
- **Telegram Bot** — @mindorr_bot for mobile access
- **Public API** — Any AI agent can call the simulation layer

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| AI/LLM | Groq (Llama 3.3 70b) |
| LP Data | DefiLlama Yields API |
| Blockchain | Solana Web3.js + Meteora DLMM SDK |
| Wallet | Phantom |
| Animations | Framer Motion |
| Charts | Recharts |
| Deployment | Vercel |

---

## Public Simulation API

Any AI agent can call Mindor's simulation layer:

POST /api/mindor/simulate
Content-Type: application/json

{
  "intent": "2k low risk stable yield",
  "capitalUSD": 2000
}

Returns strategies, fee projections, and IL analysis.
No API key required.

---

## Telegram Bot

Send your intent to @mindorr_bot on Telegram.
Receive simulation results in seconds with a 
deep link back to execute on-chain.

---

## Architecture

User Intent (Natural Language)
       |
  Groq AI Parser
       |
  DefiLlama Pool Fetch (486+ pools)
       |
  Simulation Engine (Fee math + IL curves)
       |
  Strategy Cards (Conservative/Balanced/Aggressive)
       |
  Phantom Wallet Connect
       |
  Meteora DLMM addLiquidity (Solana Mainnet)
       |
  On-chain Position Confirmed

---

## Roadmap

- Position management (remove liquidity, claim fees)
- Delegated execution via Squads Protocol
- Autonomous rebalancing agent
- Multi-protocol support (Orca, Raydium)
- LPAgent.io integration for deeper analytics

---

## Built For

100xDevs Frontier Hackathon
