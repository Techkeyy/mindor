'use client'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from 'recharts'
import {
  connectWallet,
  executeLPPosition,
  getBalance,
  type WalletAdapter,
  type ExecutionResult,
} from '@/lib/solana'

// Types
type RiskProfile = 'low' | 'medium' | 'high'

type Pool = {
  address: string
  tokenA: string
  tokenB: string
  protocol: string
  feeApr: number
  volume24h: number
  tvl: number
  ilRisk: 'low' | 'medium' | 'high'
  netApr: number
}

type StrategyCard = {
  rank: 1 | 2 | 3
  label: 'Conservative' | 'Balanced' | 'Aggressive'
  pool: Pool
  projectedMonthlyFees: number
  projectedILRisk: string
  confidenceScore: number
  recommendation: string
}

type SimResult = {
  pools: Pool[]
  strategies: StrategyCard[]
  timestamp: string
  intent: {
    capitalUSD: number
    riskProfile: RiskProfile
    durationDays: number
    summary: string
  }
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

// Constants
const STRATEGY_COLORS = {
  Conservative: '#2DD4BF',
  Balanced: '#7C3AED',
  Aggressive: '#F87171',
}

const RISK_LABELS = {
  low: { label: 'LOW RISK', color: '#2DD4BF' },
  medium: { label: 'MED RISK', color: '#FBBF24' },
  high: { label: 'HIGH RISK', color: '#F87171' },
}

// Helper: generate fee chart data
function makeFeeData(monthlyFee: number, days = 30) {
  let cum = 0
  return Array.from({ length: days }, (_, i) => {
    cum += monthlyFee / 30
    return { day: i + 1, fees: Math.round(cum * 100) / 100 }
  })
}

// Sub-components

function EmptyState() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      opacity: 0.6,
    }}>
      <div style={{
        width: 64, height: 64,
        borderRadius: '50%',
        border: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <div style={{
        fontFamily: 'monospace',
        fontSize: 11,
        letterSpacing: '0.2em',
        color: 'var(--text-secondary)',
        textAlign: 'center',
        lineHeight: 1.8,
      }}>
        TYPE YOUR INTENT<br />TO BEGIN SIMULATION
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ opacity: [0.2, 1, 0.2], y: [0, -8, 0] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
            }}
            style={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: 'var(--accent-primary)',
            }}
          />
        ))}
      </div>
      <div style={{
        fontFamily: 'monospace',
        fontSize: 11,
        letterSpacing: '0.2em',
        color: 'var(--text-muted)',
      }}>
        ANALYZING INTENT...
      </div>
    </motion.div>
  )
}

function StrategyCardComponent({
  strategy,
  selected,
  onSelect,
  delay,
}: {
  strategy: StrategyCard
  selected: boolean
  onSelect: () => void
  delay: number
}) {
  const color = STRATEGY_COLORS[strategy.label]
  const feeData = makeFeeData(strategy.projectedMonthlyFees)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      onClick={onSelect}
      style={{
        background: selected
          ? 'var(--bg-elevated)'
          : 'var(--bg-surface)',
        border: `1px solid ${selected ? color : 'var(--border-subtle)'}`,
        borderRadius: 16,
        padding: 20,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: selected
          ? `0 0 20px ${color}22`
          : 'none',
      }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
      }}>
        <div>
          <div style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: color,
            fontFamily: 'monospace',
            marginBottom: 4,
          }}>
            {strategy.label.toUpperCase()}
          </div>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}>
            {strategy.pool.tokenA}/{strategy.pool.tokenB}
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginTop: 2,
          }}>
            {strategy.pool.protocol}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 22,
            fontWeight: 800,
            color: color,
            fontFamily: 'monospace',
          }}>
            {strategy.pool.feeApr.toFixed(1)}%
          </div>
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
          }}>
            FEE APR
          </div>
        </div>
      </div>

      {/* Mini fee chart */}
      <div style={{ height: 48, marginBottom: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={feeData}>
            <defs>
              <linearGradient
                id={`grad-${strategy.rank}`}
                x1="0" y1="0" x2="0" y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={color}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={color}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="fees"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#grad-${strategy.rank})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats: 4 time period projections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginBottom: 12,
      }}>
        {[
          {
            label: '7D FEES',
            value: `$${((strategy.projectedMonthlyFees / 30) * 7).toFixed(2)}`
          },
          {
            label: '30D FEES',
            value: `$${strategy.projectedMonthlyFees.toFixed(2)}`
          },
          {
            label: '90D FEES',
            value: `$${(strategy.projectedMonthlyFees * 3).toFixed(2)}`
          },
          {
            label: '365D FEES',
            value: `$${(strategy.projectedMonthlyFees * 12).toFixed(2)}`
          },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--bg-base)',
            borderRadius: 8,
            padding: '8px 10px',
          }}>
            <div style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              marginBottom: 2,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* IL Risk row below the grid */}
      <div style={{
        background: 'var(--bg-base)',
        borderRadius: 8,
        padding: '8px 10px',
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontSize: 10,
          color: 'var(--text-secondary)',
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
        }}>
          IL RISK (worst case)
        </div>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: strategy.pool.ilRisk === 'low'
            ? '#22C55E'
            : strategy.pool.ilRisk === 'medium'
            ? '#FBBF24'
            : '#F87171',
          fontFamily: 'monospace',
        }}>
          {strategy.projectedILRisk}
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <span style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            letterSpacing: '0.1em',
          }}>
            CONFIDENCE
          </span>
          <span style={{
            fontSize: 10,
            color: color,
            fontFamily: 'monospace',
          }}>
            {strategy.confidenceScore}%
          </span>
        </div>
        <div style={{
          height: 3,
          background: 'var(--border-subtle)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${strategy.confidenceScore}%`
            }}
            transition={{ duration: 0.8, delay: delay + 0.3 }}
            style={{
              height: '100%',
              background: color,
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* Recommendation */}
      <div style={{
        fontSize: 12,
        color: 'var(--text-primary)',
        lineHeight: 1.5,
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: 10,
      }}>
        {strategy.recommendation}
      </div>
    </motion.div>
  )
}

function ILChart({
  strategy,
  capitalUSD,
}: {
  strategy: StrategyCard
  capitalUSD: number
}) {
  const scenarios = [
    { label: '-50%', change: -50 },
    { label: '-30%', change: -30 },
    { label: '-20%', change: -20 },
    { label: '-10%', change: -10 },
    { label: '0%', change: 0 },
    { label: '+10%', change: 10 },
    { label: '+20%', change: 20 },
    { label: '+50%', change: 50 },
  ]

  const calcIL = (changePct: number) => {
    const r = 1 + changePct / 100
    const il = Math.abs((2 * Math.sqrt(r) / (1 + r)) - 1)
    return Math.round(il * capitalUSD * 100) / 100
  }

  const fees30d = (capitalUSD * (strategy.pool.feeApr / 100)) / 365 * 30

  const data = scenarios.map(s => ({
    label: s.label,
    ilLoss: calcIL(s.change),
    netPnl: Math.round(
      (fees30d - calcIL(s.change)) * 100
    ) / 100,
  }))

  const color = STRATEGY_COLORS[strategy.label]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16,
        padding: 20,
        flexShrink: 0,
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <div>
          <div style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
            marginBottom: 4,
          }}>
            IL SCENARIO ANALYSIS
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}>
            {strategy.pool.tokenA}/{strategy.pool.tokenB} 
            - ${capitalUSD.toLocaleString()} capital
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: 12,
          fontSize: 11,
          fontFamily: 'monospace',
        }}>
          {[
            ['7D', fees30d / 30 * 7],
            ['30D', fees30d],
            ['1Y', fees30d * 12],
          ].map(([period, amount]) => (
            <div key={String(period)} style={{
              border: `1px solid ${color}44`,
              borderRadius: 6,
              padding: '4px 10px',
              color: color,
            }}>
              {period}: ${Number(amount).toFixed(2)}
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient 
                id="ilGrad" x1="0" y1="0" 
                x2="0" y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={color}
                  stopOpacity={0.25}
                />
                <stop
                  offset="95%"
                  stopColor={color}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{
                fontSize: 10,
                fill: 'var(--text-muted)',
                fontFamily: 'monospace',
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                fontSize: 12,
                fontFamily: 'monospace',
              }}
            />
            <Area
              type="monotone"
              dataKey="ilLoss"
              stroke="#F87171"
              strokeWidth={1.5}
              fill="url(#ilGrad)"
              dot={false}
              name="ilLoss"
            />
            <Line
              type="monotone"
              dataKey="netPnl"
              stroke={color}
              strokeWidth={2}
              dot={false}
              name="netPnl"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{
        display: 'flex',
        gap: 16,
        marginTop: 12,
        fontSize: 11,
        fontFamily: 'monospace',
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{
            width: 16, height: 2,
            background: '#F87171',
          }} />
          <span style={{ color: 'var(--text-muted)' }}>
            IL Loss
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{
            width: 16, height: 2,
            background: color,
          }} />
          <span style={{ color: 'var(--text-muted)' }}>
            Net PnL (fees - IL)
          </span>
        </div>
      </div>
    </motion.div>
  )
}

function ExecutionModal({
  strategy,
  capitalUSD,
  onClose,
  onConfirm,
}: {
  strategy: StrategyCard
  capitalUSD: number
  onClose: () => void
  onConfirm: () => void
}) {
    const [step, setStep] = useState<'preview' | 'connecting' | 'confirm' | 'executing' | 'success' | 'error'>('preview')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [txResult, setTxResult] = useState<ExecutionResult | null>(null)
  const [walletAdapter, setWalletAdapter] = useState<WalletAdapter | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const color = STRATEGY_COLORS[strategy.label]

  const handleConnect = async () => {
    setStep('connecting')
    setErrorMsg('')

    const { wallet, address, error } =
      await connectWallet()

    if (error || !wallet || !address) {
      setErrorMsg(
        error ?? 'Failed to connect wallet'
      )
      setStep('preview')
      return
    }

    const balance = await getBalance(address)
    setWalletAdapter(wallet)
    setWalletAddress(address)
    setWalletBalance(balance)
    setStep('confirm')
  }

  const handleConfirm = async () => {
    if (!walletAdapter) return
    setStep('executing')

    const result = await executeLPPosition(
      walletAdapter,
      strategy.pool.address,
      capitalUSD,
    )

    setTxResult(result)

    if (result.success) {
      setStep('success')
    } else {
      setErrorMsg(result.error ?? 'Transaction failed')
      setStep('error')
    }
  }

  useEffect(() => {
    if (step !== 'success' || !txResult?.success) return

    const timeout = window.setTimeout(() => {
      onConfirm()
    }, 3500)

    return () => window.clearTimeout(timeout)
  }, [step, txResult, onConfirm])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 11, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          background: 'var(--bg-elevated)',
          border: `1px solid ${color}44`,
          borderRadius: 20,
          padding: 32,
          width: 480,
          maxWidth: '90vw',
          boxShadow: `0 0 60px ${color}22`,
        }}
      >
        {step === 'preview' && (
          <>
            <div style={{
              fontSize: 10,
              letterSpacing: '0.25em',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              marginBottom: 20,
            }}>
              EXECUTION PREVIEW
            </div>
            <div style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: 6,
            }}>
              {strategy.pool.tokenA}/{strategy.pool.tokenB}
            </div>
            <div style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 24,
            }}>
              {strategy.pool.protocol} - {strategy.label}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 24,
            }}>
              {[
                ['CAPITAL', `$${capitalUSD.toLocaleString()}`],
                ['FEE APR', `${strategy.pool.feeApr.toFixed(1)}%`],
                ['7D FEES', `$${((strategy.projectedMonthlyFees / 30) * 7).toFixed(2)}`],
                ['30D FEES', `$${strategy.projectedMonthlyFees.toFixed(2)}`],
                ['1Y FEES', `$${(strategy.projectedMonthlyFees * 12).toFixed(2)}`],
                ['IL RISK', strategy.projectedILRisk],
              ].map(([label, value]) => (
                <div key={label} style={{
                  background: 'var(--bg-base)',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}>
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.15em',
                    fontFamily: 'monospace',
                    marginBottom: 4,
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              background: 'var(--bg-base)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 20,
              lineHeight: 1.6,
            }}>
              Note: You will be asked to approve this 
              transaction in your Phantom wallet. 
              Mindor never holds your private keys.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                style={{
                  flex: 2,
                  padding: '12px',
                  background: color,
                  border: 'none',
                  borderRadius: 10,
                  color: 'var(--bg-base)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                }}
              >
                CONNECT PHANTOM ›
              </button>
            </div>
          </>
        )}

        {step === 'connecting' && (
          <div style={{
            textAlign: 'center',
            padding: '40px 0',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 20,
            }}>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{
                    opacity: [0.2, 1, 0.2],
                    y: [0, -8, 0],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  style={{
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: color,
                  }}
                />
              ))}
            </div>
            <div style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}>
              CONNECTING WALLET...
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <>
            {walletAddress && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                padding: '8px 12px',
                background: 'var(--bg-base)',
                borderRadius: 8,
              }}>
                <div style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: '#22C55E',
                  boxShadow: '0 0 8px #22C55E',
                  flexShrink: 0,
                }} />
                <div style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {walletAddress.slice(0, 8)}...
                  {walletAddress.slice(-6)}
                </div>
                {walletBalance !== null && (
                  <div style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: color,
                    flexShrink: 0,
                  }}>
                    {walletBalance.toFixed(2)} SOL
                  </div>
                )}
              </div>
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}>
              <div style={{
                width: 8, height: 8,
                borderRadius: '50%',
                background: '#22C55E',
                boxShadow: '0 0 8px #22C55E',
              }} />
              <div style={{
                fontSize: 10,
                letterSpacing: '0.2em',
                color: '#22C55E',
                fontFamily: 'monospace',
              }}>
                PHANTOM CONNECTED
              </div>
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 6,
            }}>
              Confirm Transaction
            </div>
            <div style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 24,
              lineHeight: 1.6,
            }}>
              Add liquidity to {strategy.pool.tokenA}/
              {strategy.pool.tokenB} pool on{' '}
              {strategy.pool.protocol} with $
              {capitalUSD.toLocaleString()} capital.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 2,
                  padding: '12px',
                  background: color,
                  border: 'none',
                  borderRadius: 10,
                  color: 'var(--bg-base)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                }}
              >
                CONFIRM IN PHANTOM ›
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: 'center', padding: '32px 0' }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                delay: 0.1,
              }}
              style={{
                fontSize: 48,
                marginBottom: 16,
              }}
            >
              OK
            </motion.div>
            <div style={{
              fontSize: 20,
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}>
              Position Opened
            </div>
            <div style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 4,
            }}>
              {strategy.pool.tokenA}/{strategy.pool.tokenB}
              {' '}on {strategy.pool.protocol}
            </div>
            <div style={{
              fontSize: 12,
              color: color,
              fontFamily: 'monospace',
            }}>
              Earning {strategy.pool.feeApr.toFixed(1)}% APR
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}

function SimulationResults({
  result,
  selectedStrategy,
  onSelectStrategy,
  onExecute,
}: {
  result: SimResult
  selectedStrategy: number
  onSelectStrategy: (i: number) => void
  onExecute: (strategy: StrategyCard) => void
}) {
  const [showModal, setShowModal] = useState(false)
  const selected = result.strategies[selectedStrategy]

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Intent summary bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          background: 'var(--bg-elevated)',
          borderRadius: 10,
          border: '1px solid var(--border-subtle)',
          flexShrink: 0,
          margin: '20px 24px 0 24px',
        }}
      >
        <div style={{
          fontSize: 10,
          letterSpacing: '0.2em',
          color: 'var(--text-muted)',
          fontFamily: 'monospace',
        }}>
          PARSED INTENT
        </div>
        <div style={{
          height: 12, width: 1,
          background: 'var(--border-subtle)',
        }} />
        <div style={{
          fontSize: 12,
          color: 'var(--accent-primary)',
          fontFamily: 'monospace',
        }}>
          ${result.intent.capitalUSD.toLocaleString()}
        </div>
        <div style={{
          fontSize: 10,
          padding: '2px 8px',
          borderRadius: 4,
          border: `1px solid ${
            RISK_LABELS[result.intent.riskProfile].color
          }`,
          color: RISK_LABELS[result.intent.riskProfile].color,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
        }}>
          {RISK_LABELS[result.intent.riskProfile].label}
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          marginLeft: 'auto',
        }}>
          {result.intent.summary}
        </div>
      </motion.div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Strategy cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          flexShrink: 0,
        }}>
          {result.strategies.map((s, i) => (
            <StrategyCardComponent
              key={s.rank}
              strategy={s}
              selected={selectedStrategy === i}
              onSelect={() => onSelectStrategy(i)}
              delay={i * 0.15}
            />
          ))}
        </div>

        <ILChart
          strategy={result.strategies[selectedStrategy]}
          capitalUSD={result.intent.capitalUSD}
        />
      </div>

      {/* Execute button */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{
            flexShrink: 0,
            padding: '0 24px 20px 24px',
          }}
        >
          <button
            onClick={() => setShowModal(true)}
            style={{
              width: '100%',
              padding: '16px',
              background: 'var(--accent-primary)',
              color: 'var(--bg-base)',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            EXECUTE {selected.label.toUpperCase()} STRATEGY
            › {selected.pool.tokenA}/{selected.pool.tokenB}
            ON {selected.pool.protocol.toUpperCase()}
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {showModal && (
          <ExecutionModal
            strategy={result.strategies[selectedStrategy]}
            capitalUSD={result.intent.capitalUSD}
            onClose={() => setShowModal(false)}
            onConfirm={() => {
              onExecute(
                result.strategies[selectedStrategy]
              )
              setShowModal(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Main Page Component
export default function AppPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState(0)
  const [executing, setExecuting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setSimResult(null)

    try {
      // Step 1: Parse intent
      const intentRes = await fetch('/api/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: text }),
      })
      const intent = await intentRes.json()

      // Step 2: Fetch pools + strategies
      const poolsRes = await fetch('/api/fetch-pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riskProfile: intent.riskProfile,
          capitalUSD: intent.capitalUSD,
        }),
      })
      const poolData = await poolsRes.json()

      // Guard against missing data
      if (!poolData || !poolData.strategies ||
          !Array.isArray(poolData.strategies)) {
        console.error('[handleSubmit] invalid poolData:',
          poolData)
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: 'Could not load pool strategies. Please try again.',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errMsg])
        setLoading(false)
        return
      }

      const result: SimResult = {
        pools: poolData.pools ?? [],
        strategies: poolData.strategies,
        timestamp: poolData.timestamp ??
          new Date().toISOString(),
        intent,
      }
      setSimResult(result)
      setSelectedStrategy(0)

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: `Found ${result.strategies.length} strategies for $${intent.capitalUSD.toLocaleString()} - ${intent.riskProfile} risk. Best match: ${result.strategies[0]?.pool?.tokenA}/${result.strategies[0]?.pool?.tokenB} on ${result.strategies[0]?.pool?.protocol} at ${result.strategies[0]?.pool?.feeApr?.toFixed(1)}% APR.`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])

    } catch (err) {
      console.error(err)
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Failed to fetch simulation data. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async (strategy: StrategyCard) => {
    setExecuting(true)
    const execMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      text: `Preparing ${strategy.label} execution - ${strategy.pool.tokenA}/${strategy.pool.tokenB} on ${strategy.pool.protocol}. Connect your Phantom wallet to proceed.`,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, execMsg])
    setTimeout(() => setExecuting(false), 2000)
  }

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: "Inter, 'JetBrains Mono', monospace",
      overflow: 'hidden',
    }}>

      {/* Top bar */}
      <div style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{
            color: 'var(--accent-primary)',
            fontSize: 11,
            letterSpacing: '0.3em',
            fontFamily: 'monospace',
            textDecoration: 'none',
          }}>
            ‹ MINDOR
          </a>
          <div style={{
            height: 12, width: 1,
            background: 'var(--border-subtle)',
          }} />
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.2em',
            fontFamily: 'monospace',
          }}>
            SIMULATION TERMINAL
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: '#22C55E',
            boxShadow: '0 0 6px #22C55E',
          }} />
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.15em',
            fontFamily: 'monospace',
          }}>
            SOLANA MAINNET
          </div>
        </div>
      </div>

      {/* Main split panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>

        {/* LEFT PANEL */}
        <div style={{
          width: 380,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
        }}>

          {/* Panel header */}
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: '0.25em',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}>
              INTENT TERMINAL
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {messages.length === 0 && (
              <div style={{
                marginTop: 40,
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  color: 'var(--text-secondary)',
                  lineHeight: 2,
                  opacity: 0.7,
                  fontFamily: 'monospace',
                }}>
                  DESCRIBE YOUR GOAL<br />
                  <span style={{
                    color: 'var(--border-active)',
                    opacity: 0.6,
                  }}>
                    &quot;$2k, low risk, stable yield&quot;
                  </span>
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user'
                      ? 'flex-end'
                      : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user'
                      ? '12px 12px 2px 12px'
                      : '12px 12px 12px 2px',
                    background: msg.role === 'user'
                      ? 'var(--accent-primary)'
                      : 'var(--bg-elevated)',
                    color: msg.role === 'user'
                      ? 'var(--bg-base)'
                      : 'var(--text-secondary)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    border: msg.role === 'assistant'
                      ? '1px solid var(--border-subtle)'
                      : 'none',
                  }}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ display: 'flex', gap: 4, padding: '4px 0' }}
              >
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{
                      opacity: [0.3, 1, 0.3],
                      y: [0, -4, 0],
                    }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                    style={{
                      width: 6, height: 6,
                      borderRadius: '50%',
                      background: 'var(--accent-primary)',
                    }}
                  />
                ))}
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: '14px 16px',
            borderTop: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
            }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder="Describe your goal..."
                rows={2}
                style={{
                  flex: 1,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: "Inter, monospace",
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
                style={{
                  width: 40, height: 40,
                  borderRadius: 10,
                  background: loading || !input.trim()
                    ? 'var(--border-subtle)'
                    : 'var(--accent-primary)',
                  border: 'none',
                  color: 'var(--bg-base)',
                  fontSize: 16,
                  cursor: loading || !input.trim()
                    ? 'not-allowed'
                    : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.2s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">`r`n                  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />`r`n                </svg>
              </button>
            </div>
            <div style={{
              marginTop: 6,
              fontSize: 10,
              color: 'var(--text-muted)',
              letterSpacing: '0.05em',
            }}>
              ENTER to send - SHIFT+ENTER for new line
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <AnimatePresence mode="wait">
            {!simResult && !loading && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ height: '100%' }}
              >
                <EmptyState />
              </motion.div>
            )}
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ height: '100%' }}
              >
                <LoadingState />
              </motion.div>
            )}
            {simResult && !loading && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ height: '100%' }}
              >
                <SimulationResults
                  result={simResult}
                  selectedStrategy={selectedStrategy}
                  onSelectStrategy={setSelectedStrategy}
                  onExecute={handleExecute}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}


