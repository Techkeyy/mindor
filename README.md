# Mindor — Intent to Execution

> AI-powered DeFi LP simulation and execution on Solana.
> Describe your yield goal in plain English — Mindor simulates,
> then executes a real LP position on-chain.

**Live:** https://mindor-seven.vercel.app  
**Telegram:** https://t.me/mindorr_bot  
**Hackathon:** 100xDevs Frontier Track · Colosseum Solana Frontier

---

## What It Does

```
"$2k, low risk, stable yield"  →  Pools found  →  Simulated  →  Executed on-chain
          (DeepSeek)               (DefiLlama)    (IL + fees)    (Meteora DLMM)
```

1. **Intent Parsing** — DeepSeek extracts capital, risk, and duration from natural language
2. **Pool Discovery** — DefiLlama API finds the best Meteora DLMM pools on Solana
3. **Simulation** — Fee projections (1D/7D/30D/1Y) + impermanent loss scenarios + net PnL
4. **On-Chain Execution** — Opens a real LP position via Phantom wallet + Meteora DLMM
5. **P&L Dashboard** — Live position tracking with current value, unclaimed fees, ROI

---

## Features

- **Natural Language Intent** — "I want safe yield on $5K" → executes on-chain
- **Live Pool Data** — Real-time Meteora DLMM pools from DefiLlama (SOL-USDC, USDC-USDT, SOL-JTO)
- **Impermanent Loss Analysis** — IL scenarios at -50% to +50% price movement, with fee offset
- **On-Chain Execution** — Opens LP positions on Solana mainnet via Phantom wallet + Meteora DLMM
- **Position Dashboard** — Expandable cards showing current value, unclaimed fees, ROI %
- **Fee Claiming** — Claim swap fees directly from your LP positions without closing them
- **Multi-Pool Scanning** — Scans all supported Meteora pools for your positions
- **Position Persistence** — Positions survive refreshes and reconnects (localStorage + on-chain)
- **Portfolio Summary** — Total deposited, current value, fees earned, net P&L across all positions
- **Mobile Responsive** — Panels stack vertically on small screens
- **0% Platform Fees** — Mindor takes no cut. Revenue from Meteora referral program (future)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React, Framer Motion |
| AI | DeepSeek API (deepseek-chat) |
| Blockchain | Solana Web3.js, Meteora DLMM SDK, Phantom Wallet |
| Data | DefiLlama API, CoinGecko API |
| Styling | CSS-in-JS (inline), Recharts (IL charts) |
| Deployment | Vercel |

---

## Getting Started

```bash
pnpm install
cp .env.example .env.local   # add your DEEPSEEK_API_KEY
pnpm dev                      # http://localhost:3000
```

Required env vars:
- `DEEPSEEK_API_KEY` — DeepSeek API key for intent parsing
- `NEXT_PUBLIC_SOLANA_RPC` — (optional) Custom Solana RPC URL
- `NEXT_PUBLIC_APP_URL` — (optional) Your deployment URL

---

## Screenshots

<!-- TODO: Add screenshots of the working product -->
- Landing page
- Intent terminal + simulation results
- P&L dashboard with live positions
- Execution flow (wallet connect → confirm → tx confirmed)

---

## Architecture

```
app/
├── page.tsx              # Landing page
├── app/page.tsx          # Main app (terminal + dashboard)
├── api/
│   ├── parse-intent/     # DeepSeek NLP → structured intent
│   └── fetch-pools/      # DefiLlama → simulated strategies
lib/
├── solana.ts             # Wallet, DLMM execution, P&L, fee claiming
├── defillama.ts          # Pool discovery, address lookup, IL classification
└── simulation.ts         # Fee simulation, IL math, strategy ranking
components/
├── PositionsPanel.tsx    # P&L dashboard + portfolio summary
├── SimulationResults.tsx # Strategy cards + IL chart
├── ExecutionModal.tsx    # Wallet connect → confirm → execute flow
├── ILChart.tsx           # Recharts area chart for IL scenarios
└── StrategyCard.tsx      # Individual pool strategy card
```

