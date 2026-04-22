'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import Threads from '@/components/Threads'

const pageWidth = {
  maxWidth: '1200px',
  margin: '0 auto',
  paddingLeft: '24px',
  paddingRight: '24px',
}

const panelStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '16px',
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, delay },
})

export default function Home() {
  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'smooth'
    return () => {
      document.documentElement.style.scrollBehavior = previous
    }
  }, [])

  return (
    <div style={{
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: "Inter, 'JetBrains Mono', monospace"
    }}>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'rgba(19, 26, 36, 0.8)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border-subtle)', zIndex: 50 }}>
        <div style={{ color: 'var(--accent-primary)', fontSize: '11px', letterSpacing: '0.35em' }}>MINDOR</div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          {[
            ['Features', '#features'],
            ['How It Works', '#how-it-works'],
            ['API', '#api'],
            ['Telegram', '#telegram'],
          ].map(([label, href]) => (
            <a key={label} href={href} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px', letterSpacing: '0.08em' }}>{label}</a>
          ))}
        </nav>
        <a href="/app" style={{ border: '1px solid var(--border-active)', color: 'var(--accent-primary)', borderRadius: '999px', padding: '10px 14px', textDecoration: 'none', fontSize: '12px' }}>Launch App →</a>
      </header>

      <main style={{ paddingTop: '56px' }}>
        <section style={{ position: 'relative', minHeight: '100vh' }}>
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <Threads amplitude={1.05} distance={0} />
          </div>
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(180deg, rgba(8,11,18,0.55) 0%, rgba(8,11,18,0.8) 100%)' }} />
          <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 24px 64px', textAlign: 'center' }}>
            <div style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', borderRadius: '999px', padding: '8px 14px', fontSize: '10px', letterSpacing: '0.2em', background: 'rgba(19, 26, 36, 0.72)', marginBottom: '28px' }}>
              SOLANA × DEFILLAMA × AI
            </div>

            <motion.h1 {...fadeUp(0)} style={{ fontSize: 'clamp(56px, 10vw, 108px)', lineHeight: 0.92, letterSpacing: '-0.06em', margin: 0, fontWeight: 800 }}>
              <div style={{ color: 'var(--text-primary)' }}>From Intent</div>
              <div style={{ color: 'var(--accent-primary)', textShadow: 'var(--glow-teal)' }}>To Execution</div>
            </motion.h1>

            <motion.p {...fadeUp(0.2)} style={{ marginTop: '28px', maxWidth: '680px', color: 'var(--text-secondary)', fontSize: '18px', lineHeight: 1.6 }}>
              Describe your yield goal in plain English. Mindor simulates every outcome before your capital moves.
            </motion.p>

            <motion.div {...fadeUp(0.4)} style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '34px' }}>
              <a href="/app" style={{ background: 'var(--accent-primary)', color: 'var(--bg-base)', borderRadius: '12px', padding: '14px 22px', textDecoration: 'none', fontSize: '14px', fontWeight: 700, transition: 'transform 180ms ease' }}>Launch App</a>
              <a href="#api" style={{ border: '1px solid var(--border-active)', color: 'var(--accent-primary)', borderRadius: '12px', padding: '14px 22px', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>View API Docs</a>
            </motion.div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '24px' }}>
              {['Real Solana Execution', 'DefiLlama Data', 'Zero Config'].map((label) => (
                <span key={label} style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: '12px', padding: '6px 12px', borderRadius: '999px' }}>{label}</span>
              ))}
            </div>
          </div>
        </section>

        <section id="features" style={{ ...pageWidth, paddingTop: '128px', paddingBottom: '128px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.35em', marginBottom: '18px' }}>THE PROBLEM</div>
          <h2 style={{ fontSize: 'clamp(34px, 5vw, 58px)', lineHeight: 1.05, margin: 0, marginBottom: '28px' }}>LP is powerful. Nobody uses it right.</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '18px' }}>
            {[
              { icon: '❓', title: 'Which pool?', body: 'Thousands of options. No clear signal.' },
              { icon: '📉', title: 'What will happen?', body: 'Impermanent loss is invisible until it isn\'t.' },
              { icon: '⚙️', title: 'How do I execute?', body: 'Wallets, slippage, ranges — too much friction.' },
            ].map((item, index) => (
              <motion.div key={item.title} {...fadeUp(index * 0.15)} style={{ ...panelStyle, padding: '24px' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{item.icon}</div>
                <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '10px' }}>{item.title}</div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.body}</div>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="how-it-works" style={{ ...pageWidth, paddingTop: '128px', paddingBottom: '128px', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '28px', alignItems: 'start' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.35em', marginBottom: '18px' }}>THE SOLUTION</div>
            <h2 style={{ fontSize: 'clamp(34px, 5vw, 58px)', lineHeight: 1.05, margin: 0, marginBottom: '28px' }}>Intent → Simulation → Execution</h2>

            <div style={{ display: 'grid', gap: '26px' }}>
              {[
                { number: '01', title: 'Describe your goal', body: "Type anything. '$2k, low risk, stable yield.' Mindor's AI extracts your intent." },
                { number: '02', title: 'See exactly what happens', body: 'Fee projections. IL scenarios. Best and worst case. Visualized before you commit.' },
                { number: '03', title: 'Execute with one click', body: 'Mindor places your LP position on Solana. Atomic. Confirmed. Done.' },
              ].map((step, index) => (
                <motion.div key={step.number} {...fadeUp(index * 0.12)} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '18px', alignItems: 'start' }}>
                  <div style={{ color: 'var(--accent-secondary)', fontFamily: "JetBrains Mono, monospace", fontSize: '48px', lineHeight: 1, letterSpacing: '-0.06em' }}>{step.number}</div>
                  <div>
                    <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>{step.title}</div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{step.body}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(13, 17, 23, 0.96)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', fontFamily: "JetBrains Mono, monospace", fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)' }}>
            <div style={{ color: 'var(--accent-primary)', marginBottom: '12px' }}>POST /api/mindor/simulate</div>
            <div style={{ color: 'var(--text-muted)' }}>{`{`}</div>
            <div style={{ paddingLeft: '18px' }}>
              <div><span style={{ color: 'var(--accent-secondary)' }}>&quot;intent&quot;</span>: <span style={{ color: 'var(--accent-primary)' }}>&quot;2k, low risk, stables&quot;</span>,</div>
              <div><span style={{ color: 'var(--accent-secondary)' }}>&quot;capitalUSD&quot;</span>: <span style={{ color: 'var(--text-primary)' }}>2000</span></div>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>{`}`}</div>
            <div style={{ color: 'var(--text-muted)', marginTop: '18px' }}>{`// Returns in ~800ms:`}</div>
            <div style={{ color: 'var(--text-muted)' }}>{`{`}</div>
            <div style={{ paddingLeft: '18px' }}>
              <div><span style={{ color: 'var(--accent-secondary)' }}>&quot;strategies&quot;</span>: [...],</div>
              <div><span style={{ color: 'var(--accent-secondary)' }}>&quot;projectedMonthlyFees&quot;</span>: <span style={{ color: 'var(--accent-primary)' }}>&quot;$42.18&quot;</span>,</div>
              <div><span style={{ color: 'var(--accent-secondary)' }}>&quot;worstCaseIL&quot;</span>: <span style={{ color: 'var(--accent-primary)' }}>&quot;$8.40&quot;</span>,</div>
              <div><span style={{ color: 'var(--accent-secondary)' }}>&quot;recommendedPool&quot;</span>: <span style={{ color: 'var(--accent-primary)' }}>&quot;USDC-USDT / Meteora&quot;</span></div>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>{`}`}</div>
          </div>
        </section>

        <section id="telegram" style={{ ...pageWidth, paddingTop: '128px', paddingBottom: '128px', background: 'var(--bg-surface)' }}>
          <div style={{ marginBottom: '12px', color: 'var(--text-primary)', fontSize: '34px', fontWeight: 700 }}>Use Mindor from Telegram</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '28px', maxWidth: '640px' }}>Send your intent to @MindorBot. Get strategies back in seconds.</div>
          <div style={{ maxWidth: '760px', margin: '0 auto', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ ...panelStyle, maxWidth: '360px', padding: '16px 18px', background: 'var(--accent-primary)', color: 'var(--bg-base)', borderColor: 'var(--accent-primary)' }}>I have $1500, want stable yield</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ ...panelStyle, maxWidth: '520px', padding: '16px 18px', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                Found 3 strategies for you:
                <br />
                ✅ Conservative: USDC/USDT Meteora — 7.9% APR
                <br />
                ⚡ Balanced: SOL/USDC Orca — 19.7% APR
                <br />
                🔥 Aggressive: SOL/JTO Meteora — 67.3% APR
                <br />
                → View full simulation: mindor.xyz/app
              </div>
            </div>
          </div>
        </section>

        <section id="api" style={{ ...pageWidth, paddingTop: '128px', paddingBottom: '128px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.35em', marginBottom: '18px' }}>API</div>
          <h2 style={{ fontSize: 'clamp(34px, 5vw, 58px)', lineHeight: 1.05, margin: 0, marginBottom: '12px' }}>Built for agents, not just humans</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '660px', marginBottom: '28px' }}>Any AI agent can call Mindor&apos;s simulation layer directly.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' }}>
            {['POST /api/mindor/simulate', 'POST /api/mindor/execute'].map((endpoint) => (
              <div key={endpoint} style={{ ...panelStyle, borderLeft: '3px solid var(--accent-primary)', padding: '20px', fontFamily: "JetBrains Mono, monospace", fontSize: '14px' }}>{endpoint}</div>
            ))}
          </div>
        </section>

        <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '64px 24px', fontSize: '12px' }}>
          <div style={{ ...pageWidth, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '20px', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--accent-primary)', letterSpacing: '0.35em', marginBottom: '6px' }}>MINDOR</div>
              <div style={{ color: 'var(--text-secondary)' }}>Intent to Execution</div>
            </div>
            <div style={{ display: 'flex', gap: '18px', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <a href="https://github.com" style={{ color: 'inherit', textDecoration: 'none' }}>GitHub</a>
              <a href="#telegram" style={{ color: 'inherit', textDecoration: 'none' }}>Telegram</a>
              <a href="#api" style={{ color: 'inherit', textDecoration: 'none' }}>Docs</a>
            </div>
            <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>Built on Solana × DefiLlama × Claude AI</div>
          </div>
          <div style={{ ...pageWidth, marginTop: '24px', color: 'var(--text-muted)' }}>Open simulation API — call it from your agent</div>
        </footer>
      </main>
    </div>
  )
}
