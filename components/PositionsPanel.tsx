"use client";
import { motion } from "framer-motion";

type Position = {
  id: string;
  tokenA: string;
  tokenB: string;
  protocol: string;
  feeApr: number;
  signature: string;
  explorerUrl: string;
  timestamp: Date;
  capitalUSD: number;
};

type PositionsPanelProps = {
  positions: Position[];
  onWithdraw?: (position: Position) => void;
};

export default function PositionsPanel({ positions, onWithdraw }: PositionsPanelProps) {
  if (positions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        margin: "0 24px 16px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          color: "var(--text-muted)",
          fontFamily: "monospace",
        }}>
          OPEN POSITIONS
        </div>
        <div style={{
          fontSize: 10,
          color: "var(--accent-primary)",
          fontFamily: "monospace",
        }}>
          {positions.length} active
        </div>
      </div>
      <div style={{ maxHeight: 200, overflowY: "auto" }}>
        {positions.map(pos => (
          <div key={pos.id} style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 2,
              }}>
                {pos.tokenA}/{pos.tokenB}
              </div>
              <div style={{
                fontSize: 10,
                color: "var(--text-muted)",
                fontFamily: "monospace",
              }}>
                {pos.protocol} - ${pos.capitalUSD.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--accent-primary)",
                fontFamily: "monospace",
              }}>
                {pos.feeApr.toFixed(1)}% APR
              </div>
              <a
                href={pos.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  fontFamily: "monospace",
                  textDecoration: "none",
                }}
              >
                {pos.signature.slice(0, 8)}...{pos.signature.slice(-4)}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
              {onWithdraw && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWithdraw(pos); }}
                  style={{
                    marginTop: 4,
                    padding: "2px 8px",
                    background: "transparent",
                    border: "1px solid var(--accent-danger)",
                    borderRadius: 4,
                    color: "var(--accent-danger)",
                    fontSize: 9,
                    fontFamily: "monospace",
                    cursor: "pointer",
                    letterSpacing: "0.1em",
                  }}
                >
                  CLOSE
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
