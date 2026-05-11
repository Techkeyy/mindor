# Mindor

> Type your yield goal. See the numbers. Execute on Solana.  

[![Deploy](https://img.shields.io/badge/vercel-deployed-black)](https://mindor-seven.vercel.app)
[![Chain](https://img.shields.io/badge/Solana-mainnet-blue)](https://explorer.solana.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## The Problem

DeFi LP pays 28%+ APR, yet 95% of people who know about it never deposit a cent.  
They face five decisions before a single satoshi moves: which DEX, which pool, what bin range, how to split capital, and how to monitor the position so it does not exit range. Most people quit at step one.

Existing tools answer *one* of these questions. None answers all five in sequence.

---

## The Solution

Mindor reduces five decisions to one sentence. A user types `$2 high yield` and receives three ranked strategies with fee projections, impermanent loss scenarios, and one-click execution through Phantom. After execution, the position appears in a live P&L dashboard. A Telegram bot sends alerts when the position approaches its bin-range boundary or accumulates meaningful fees.

No other Solana LP product connects natural-language intent to on-chain execution and automated monitoring in a single interface.

---

## Demo

The landing page and application dashboard run at [mindor-seven.vercel.app](https://mindor-seven.vercel.app).

A Telegram bot mirrors the simulation engine at [@mindorr_bot](https://t.me/mindorr_bot).

*Screenshots and recordings are not yet in the repository. See the deployed app for the current UI.*

---

## What Mindor Does (End to End)

```
You:    "$2 high yield"
Mindor: 3 strategies found. SOL/USDC on Meteora at 28.4% APR. Execute?
You:    Click. Sign in Phantom.
Mindor: Position opened. P&L live. Monitoring active.
```

| Stage | What happens |
|---|---|
| **Intent → Simulation** | Parses natural language with DeepSeek, fetches live pools from DefiLlama, ranks three strategies by fee APR and IL exposure |
| **Execute** | Opens a Meteora DLMM position on Solana mainnet via Phantom. Calculates deposit split, handles SOL wrapping, confirms the transaction |
| **Monitor** | Checks active bin versus position range. Sends Telegram alerts on exit risk and fee thresholds via a daily Vercel cron job |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                 Next.js Frontend (PWA)                    │
│  Landing Page    Intent Terminal    Simulation Results    │
│  Execution Modal    Positions Panel    P&L Dashboard      │
└──────────┬───────────────────────┬───────────────────────┘
           │                       │
  ┌────────▼───────┐     ┌────────▼────────┐
  │ /api/parse-intent│     │ /api/fetch-pools │
  │ (DeepSeek)       │     │ (DefiLlama)      │
  └────────┬────────┘     └────────┬─────────┘
           │                       │
  ┌────────▼───────────────────────▼─────────────────────┐
  │              /api/mindor/simulate                     │
  │   Combines intent + pools → ranked strategies +      │
  │   fee projections + IL scenarios                     │
  └────────────────────────┬─────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
  ┌────────▼──────┐  ┌─────▼──────┐  ┌─────▼──────────┐
  │ Phantom Wallet │  │ Meteora    │  │ /api/monitor    │
  │ (client-side)  │  │ DLMM (RPC) │  │ (Vercel cron)   │
  └────────────────┘  └────────────┘  └────────┬────────┘
                                               │
                                        ┌──────▼──────┐
                                        │ @mindorr_bot │
                                        │ (Telegram)   │
                                        └──────────────┘
```

```mermaid
flowchart TD
    A[User types intent] --> B[/api/parse-intent<br/>DeepSeek NLP]
    B --> C[/api/fetch-pools<br/>DefiLlama API]
    C --> D[rankStrategies<br/>Conservative / Balanced / Aggressive]
    D --> E[Simulation results<br/>Fee projections + IL scenarios]
    E --> F{User clicks Execute?}
    F -->|Yes| G[ExecutionModal<br/>Phantom connect + confirm]
    G --> H[executeLPPosition<br/>Meteora DLMM SDK]
    H --> I[Position live on-chain]
    I --> J[handleRefreshPnl<br/>Auto P&L fetch]
    J --> K[PositionsPanel<br/>Live dashboard]
    K --> L[/api/monitor<br/>Daily bin-range check]
    L --> M[Telegram alert]
```

---

## Tech Stack

| Dependency | Why |
|---|---|
| **Next.js 16** | App Router for server-side API routes and client-side PWA in one project. No separate backend process |
| **@meteora-ag/dlmm** | Direct on-chain LP execution on Meteora DLMM pools. Handles bin strategy, position creation, fee claiming |
| **@solana/web3.js** | Core Solana primitives: connection, transactions, keypairs, Phantom signing |
| **DeepSeek** (`openai` SDK) | Parses free-text intent into structured `{capitalUSD, riskProfile, durationDays, summary}`. OpenAI-compatible endpoint keeps migration trivial |
| **DefiLlama API** | Free, no-auth pool data for Solana. Returns APRs, TVL, volume for filtering and ranking |
| **Phantom** | Browser-native Solana wallet. `signTransaction`, `signAllTransactions` — no adapter library needed |
| **Framer Motion** | Declarative animations for modal transitions, message bubbles, loading states |
| **Recharts** | IL scenario charts. Composable, tree-shakeable, zero-config for React |
| **Vercel** | Serverless deployment with built-in cron for `/api/monitor`. GitHub-push auto-deploy |
| **Telegram Bot API** | Simulation access and position alerts outside the browser |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Phantom browser extension (for execution)
- DeepSeek API key (for intent parsing)

### Install and Run

```bash
git clone https://github.com/Techkeyy/mindor.git
cd mindor
pnpm install
pnpm approve-builds sharp protobufjs bigint-buffer  # native deps for DLMM SDK
```

Create `.env.local`:

```env
DEEPSEEK_API_KEY=sk-...              # Required — DeepSeek API key for intent parsing
NEXT_PUBLIC_APP_URL=http://localhost:3000
TELEGRAM_BOT_TOKEN=                  # Optional — enables Telegram bot and monitoring alerts
NEXT_PUBLIC_SOLANA_RPC=             # Optional — defaults to public mainnet-beta RPC
```

```bash
pnpm dev
# → http://localhost:3000 (landing)
# → http://localhost:3000/app (dashboard)
```

### Deploy

```bash
vercel --prod
```

Set the same environment variables in the Vercel project settings. The Vercel cron job (`vercel.json`) requires no additional configuration — it runs `/api/monitor` daily at midnight UTC on the Hobby plan.

---

## Usage

### Web App

1. Go to `/app`, type an intent like `$500 low risk stable yield`, press Enter
2. Click a strategy card to see full simulation data
3. Click **Execute** → Connect Phantom → Confirm the transaction
4. Expand the position in the live panel to see P&L, claim fees, withdraw, or enable monitoring

### API

```bash
# Full simulation with intent parsing
curl -X POST https://mindor-seven.vercel.app/api/mindor/simulate \
  -H "Content-Type: application/json" \
  -d '{"intent": "$2000, low risk, stable yield"}'

# Returns strategies, fee projections, IL scenarios, and parsed intent
```

```bash
# Pools-only endpoint (skip intent parsing)
curl -X POST https://mindor-seven.vercel.app/api/fetch-pools \
  -H "Content-Type: application/json" \
  -d '{"riskProfile": "medium", "capitalUSD": 5000}'
```

### Telegram Bot

Send any intent string to [@mindorr_bot](https://t.me/mindorr_bot):

```
$2 high yield
```

The bot returns three ranked strategies with fee estimates. Click a position's MONITOR button in the web app to register for Telegram exit-warning and fee-accumulation alerts.

---

## Hackathon Context

### What was built

A full-stack Solana DeFi product in ~48 hours: Next.js 16 frontend, five API routes, on-chain LP execution via Meteora DLMM SDK, Phantom wallet integration, P&L dashboard with on-chain position reading, Telegram bot with simulation engine and monitoring, and a marketing landing page.

### Key decisions under time pressure

- **Meteora only.** Orca pool addresses exist in the lookup table but execution is not implemented. Concentrated-liquidity execution is protocol-specific and there was not enough time to ship a second SDK integration.
- **Constant-product IL math.** `simulateIL` uses the Uniswap V2 formula `2√r/(1+r) - 1`. Meteora DLMM bins have materially different IL profiles. The UI shows an amber disclaimer on every strategy card. Replacing this with per-bin IL simulation requires the full DLMM pool state, which was deprioritized in favor of working execution.
- **Hardcoded confidence scores.** `rankStrategies` returns 88/74/61 for Conservative/Balanced/Aggressive. These are not computed from data; they are fixed labels. A proper scoring function would weight TVL, volume consistency, and historical APR stability.
- **In-memory monitor store.** Position registrations live in a JavaScript `Map` and vanish on cold starts. Vercel Hobby plan limits cron to once daily. A production monitor would use a database and run every 5–15 minutes.
- **Mock pool detail.** `fetchPoolDetail` generates deterministic fake fee history from a seeded pseudo-random function. Real on-chain fee history requires indexing past DLMM events.
- **No slippage. No multi-bin strategies.** The execution modal uses a fixed ±5 bin range around the active bin (Spot strategy, type 0). Curve and bid-ask strategies are not exposed.

### What went right

- Intent → simulation → execution → monitoring pipeline works end to end on Solana mainnet with real money
- The P&L dashboard reads live on-chain position data and tracks fees, deposited amounts, and ROI
- The Telegram deep-link monitoring flow survived a 64-byte parameter limit by deriving pool/bin data on-chain from just the position address
- DefiLlama fallback pools ensure the app degrades gracefully when the API is unavailable

---

## Roadmap

- [ ] **DLMM-accurate IL simulation** — replace constant-product math with per-bin IL using real `getBinArray` data
- [ ] **Computed confidence scores** — score strategies on TVL depth, volume consistency, and historical fee stability instead of hardcoding 88/74/61
- [ ] **Orca execution** — implement `@orca-so/whirlpools-sdk` integration for Whirlpool pools
- [ ] **Persistent monitor store** — move position registrations from in-memory Map to a database (Upstash Redis or Vercel KV) with 5-minute cron on Pro plan
- [ ] **Multi-bin strategies** — expose Curve and Bid-Ask strategy types in the execution modal, not just Spot

---

## Contributing

This is a hackathon project. Issues and PRs tracking the roadmap items above are welcome. Before opening a PR:

1. Read the audit checklist at `references/solana-dapp-audit-checklist.md` (in the `solana-defi-execution` skill bundle)
2. Run `pnpm build` locally and verify zero new errors
3. Test execution on Solana devnet before touching mainnet path

---

## License

MIT © Techkeyy
