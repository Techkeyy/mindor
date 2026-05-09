"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PositionPnL } from "@/lib/solana";

export type Position = {
  id: string;
  tokenA: string;
  tokenB: string;
  protocol: string;
  feeApr: number;
  signature: string;
  explorerUrl: string;
  timestamp: Date;
  capitalUSD: number;
  poolAddress?: string;
  positionAddress?: string;
  lowerBinId?: number;
  upperBinId?: number;
  pnl?: PositionPnL | null;
  pnlLoading?: boolean;
};

type PositionsPanelProps = {
  positions: Position[];
  onWithdraw?: (position: Position) => void;
  onRefreshPnl?: (position: Position) => void;
  onDismiss?: (position: Position) => void;
  onClaimFees?: (position: Position) => void;
  onMonitor?: (position: Position) => void;
};

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const compact = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : currency(n);

const since = (d: Date) => {
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function PositionsPanel({
  positions,
  onWithdraw,
  onRefreshPnl,
  onDismiss,
  onClaimFees,
  onMonitor,
}: PositionsPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (positions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        margin: "12px 24px 16px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "var(--text-muted)",
            fontFamily: "monospace",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22C55E",
              boxShadow: "0 0 8px #22C55E",
            }}
          />
          LIVE POSITIONS
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--accent-primary)",
            fontFamily: "monospace",
          }}
        >
          {positions.length} active
        </div>
      </div>

      {/* Positions list */}
      <AnimatePresence>
        {positions.map((pos) => {
          const pnl = pos.pnl;
          const isOpen = expanded.has(pos.id);
          const pnlColor =
            !pnl || pnl.pnl === 0
              ? "var(--text-muted)"
              : pnl.pnl > 0
                ? "#22C55E"
                : "#EF4444";

          return (
            <motion.div
              key={pos.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                borderBottom: "1px solid var(--border-subtle)",
                cursor: "pointer",
              }}
              onClick={() => toggle(pos.id)}
            >
              {/* Collapsed row */}
              <div
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {/* Left: pair + protocol */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      marginBottom: 3,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {pos.tokenA}/{pos.tokenB}
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--bg-surface)",
                        color: "var(--text-muted)",
                        letterSpacing: "0.1em",
                        fontFamily: "monospace",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {pos.protocol.toUpperCase()}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      fontFamily: "monospace",
                    }}
                  >
                    {pos.signature.slice(0, 8)}...{pos.signature.slice(-4)} · {since(new Date(pos.timestamp))}
                  </div>
                </div>

                {/* Center: P&L */}
                <div style={{ textAlign: "right", minWidth: 100 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: pnlColor,
                      fontFamily: "monospace",
                    }}
                  >
                    {pos.pnlLoading
                      ? "..."
                      : pnl
                        ? `${pnl.pnl >= 0 ? "+" : ""}${currency(pnl.pnl)}`
                        : "—"}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {pnl && !pos.pnlLoading
                      ? `${pnl.roi >= 0 ? "+" : ""}${pnl.roi.toFixed(2)}%`
                      : pos.pnlLoading ? "loading" : "tap for details"}
                  </div>
                </div>

                {/* Right: APR + expand indicator */}
                <div style={{ textAlign: "right", minWidth: 60 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--accent-primary)",
                      fontFamily: "monospace",
                    }}
                  >
                    {pos.feeApr.toFixed(1)}%
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--text-muted)",
                      fontFamily: "monospace",
                      transform: isOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                      display: "inline-block",
                    }}
                  >
                    ▼
                  </div>
                </div>
              </div>

              {/* Expanded detail panel */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      style={{
                        padding: "0 16px 16px",
                        borderTop: "1px solid var(--border-subtle)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {/* P&L breakdown grid */}
                      {pnl && !pos.pnlLoading && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            paddingTop: 12,
                          }}
                        >
                          <Stat
                            label="Current Value"
                            value={currency(pnl.currentValue)}
                            color="var(--text-primary)"
                          />
                          <Stat
                            label="Unclaimed Fees"
                            value={currency(pnl.unclaimedFees)}
                            color="#FBBF24"
                          />
                          <Stat
                            label="Deposited"
                            value={currency(pnl.depositedValue)}
                            color="var(--text-secondary)"
                          />
                          <Stat
                            label="ROI"
                            value={`${pnl.roi >= 0 ? "+" : ""}${pnl.roi.toFixed(2)}%`}
                            color={pnlColor}
                          />
                          {pnl.depositedX > 0 && (
                            <Stat
                              label={`Deposited ${pnl.symbolX}`}
                              value={`${pnl.depositedX.toFixed(4)} ${pnl.symbolX}`}
                              color="var(--text-muted)"
                              small
                            />
                          )}
                          {pnl.depositedY > 0 && (
                            <Stat
                              label={`Deposited ${pnl.symbolY}`}
                              value={`${pnl.depositedY.toFixed(4)} ${pnl.symbolY}`}
                              color="var(--text-muted)"
                              small
                            />
                          )}
                        </div>
                      )}

                      {/* Loading state */}
                      {pos.pnlLoading && (
                        <div
                          style={{
                            paddingTop: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <LoadingDots />
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Fetching on-chain data...
                          </span>
                        </div>
                      )}

                      {/* No P&L data yet */}
                      {!pnl && !pos.pnlLoading && (
                        <div
                          style={{
                            paddingTop: 12,
                            fontSize: 11,
                            color: "var(--text-muted)",
                            fontFamily: "monospace",
                          }}
                        >
                          Click refresh to load on-chain P&amp;L data
                        </div>
                      )}

                      {/* Error */}
                      {pnl?.error && !pos.pnlLoading && (
                        <div
                          style={{
                            paddingTop: 8,
                            fontSize: 10,
                            color: "#EF4444",
                            fontFamily: "monospace",
                          }}
                        >
                          ⚠ {pnl.error}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          paddingTop: 4,
                        }}
                      >
                        {/* Refresh P&L */}
                        {onRefreshPnl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRefreshPnl(pos);
                            }}
                            disabled={pos.pnlLoading}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 6,
                              border: "1px solid var(--border-active)",
                              background: "transparent",
                              color: "var(--accent-primary)",
                              fontSize: 10,
                              fontFamily: "monospace",
                              letterSpacing: "0.1em",
                              cursor: pos.pnlLoading ? "not-allowed" : "pointer",
                              opacity: pos.pnlLoading ? 0.5 : 1,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {pos.pnlLoading ? <LoadingDots /> : "⟳"}
                            REFRESH P&L
                          </button>
                        )}

                        {/* Explorer */}
                        <a
                          href={pos.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 6,
                            border: "1px solid var(--border-subtle)",
                            background: "transparent",
                            color: "var(--text-muted)",
                            fontSize: 10,
                            fontFamily: "monospace",
                            letterSpacing: "0.1em",
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          ↗ EXPLORER
                        </a>

                        {/* Monitor */}
                        {onMonitor && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMonitor(pos);
                            }}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 6,
                              border: "1px solid #FBBF24",
                              background: "transparent",
                              color: "#FBBF24",
                              fontSize: 10,
                              fontFamily: "monospace",
                              letterSpacing: "0.1em",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            🔔 MONITOR
                          </button>
                        )}

                        {/* Claim Fees */}
                        {onClaimFees && pos.pnl && pos.pnl.unclaimedFees > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onClaimFees(pos);
                            }}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 6,
                              border: "1px solid #FBBF24",
                              background: "transparent",
                              color: "#FBBF24",
                              fontSize: 10,
                              fontFamily: "monospace",
                              letterSpacing: "0.1em",
                              cursor: "pointer",
                            }}
                          >
                            CLAIM ${pos.pnl.unclaimedFees.toFixed(2)}
                          </button>
                        )}

                        {/* Withdraw */}
                        {onWithdraw && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onWithdraw(pos);
                            }}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 6,
                              border: "1px solid var(--accent-danger)",
                              background: "transparent",
                              color: "var(--accent-danger)",
                              fontSize: 10,
                              fontFamily: "monospace",
                              letterSpacing: "0.1em",
                              cursor: "pointer",
                            }}
                          >
                            WITHDRAW
                          </button>
                        )}

                        {/* Dismiss (remove from dashboard only — no on-chain tx) */}
                        {onDismiss && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismiss(pos);
                            }}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 6,
                              border: "1px solid var(--border-subtle)",
                              background: "transparent",
                              color: "var(--text-muted)",
                              fontSize: 10,
                              fontFamily: "monospace",
                              letterSpacing: "0.1em",
                              cursor: "pointer",
                              marginLeft: "auto",
                            }}
                          >
                            DISMISS
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Portfolio summary — totals across all positions with P&L data */}
      {(() => {
        const withPnl = positions.filter(p => p.pnl && !p.pnlLoading && !p.pnl.error);
        if (withPnl.length === 0) return null;
        const totalDeposited = withPnl.reduce((s, p) => s + p.pnl!.depositedValue, 0);
        const totalCurrent = withPnl.reduce((s, p) => s + p.pnl!.currentValue, 0);
        const totalFees = withPnl.reduce((s, p) => s + p.pnl!.unclaimedFees + p.pnl!.claimedFees, 0);
        const totalPnl = withPnl.reduce((s, p) => s + p.pnl!.pnl, 0);
        const pnlColor = totalPnl >= 0 ? "#22C55E" : "#EF4444";
        return (
          <div style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border-active)",
            display: "flex",
            alignItems: "center",
            gap: 24,
            background: "var(--bg-surface)",
            flexWrap: "wrap",
          }}>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-muted)", fontFamily: "monospace" }}>
              PORTFOLIO
            </div>
            <Sum label="Deposited" value={currency(totalDeposited)} />
            <Sum label="Current" value={currency(totalCurrent)} />
            <Sum label="Fees" value={currency(totalFees)} color="#FBBF24" />
            <Sum label="P&L" value={`${totalPnl >= 0 ? "+" : ""}${currency(totalPnl)}`} color={pnlColor} bold />
          </div>
        );
      })()}
    </motion.div>
  );
}

// Helper: stat row
function Stat({
  label,
  value,
  color,
  small,
}: {
  label: string;
  value: string;
  color: string;
  small?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", fontFamily: "monospace" }}>
        {label}
      </div>
      <div style={{ fontSize: small ? 11 : 14, fontWeight: 700, color, fontFamily: "monospace" }}>
        {value}
      </div>
    </div>
  );
}

// Animated loading dots
function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "var(--accent-primary)",
          }}
        />
      ))}
    </span>
  );
}

// Compact summary stat for the portfolio bar
function Sum({
  label,
  value,
  color = "var(--text-primary)",
  bold,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: bold ? 800 : 600, color, fontFamily: "monospace" }}>
        {value}
      </span>
    </div>
  );
}
