"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StrategyCard as StrategyCardType } from "@/lib/simulation";
import type { Pool } from "@/lib/defillama";
import type { ExecutionResult } from "@/lib/solana";
import { simulateFees } from "@/lib/simulation";
import StrategyCardComponent from "./StrategyCard";
import ILChart from "./ILChart";
import ExecutionModal from "./ExecutionModal";

type SimResult = {
  pools: Pool[];
  strategies: StrategyCardType[];
  timestamp: string;
  intent: {
    capitalUSD: number;
    riskProfile: "low" | "medium" | "high";
    durationDays: number;
    summary: string;
  };
};

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "LOW RISK", color: "#2DD4BF" },
  medium: { label: "MED RISK", color: "#FBBF24" },
  high: { label: "HIGH RISK", color: "#F87171" },
};

type SimulationResultsProps = {
  result: SimResult;
  selectedStrategy: number;
  onSelectStrategy: (i: number) => void;
  onExecute: (strategy: StrategyCardType, txData?: ExecutionResult, fallbackCapital?: number) => void;
};

export default function SimulationResults({
  result,
  selectedStrategy,
  onSelectStrategy,
  onExecute,
}: SimulationResultsProps) {
  const [showModal, setShowModal] = useState(false);
  const selected = result.strategies[selectedStrategy];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Intent summary bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px", background: "var(--bg-elevated)",
          borderRadius: 10, border: "1px solid var(--border-subtle)",
          flexShrink: 0, margin: "20px 24px 0 24px",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--text-muted)", fontFamily: "monospace" }}>
          PARSED INTENT
        </div>
        <div style={{ height: 12, width: 1, background: "var(--border-subtle)" }} />
        <div style={{ fontSize: 12, color: "var(--accent-primary)", fontFamily: "monospace" }}>
          ${result.intent.capitalUSD.toLocaleString()}
        </div>
        <div style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 4,
          border: `1px solid ${RISK_LABELS[result.intent.riskProfile].color}`,
          color: RISK_LABELS[result.intent.riskProfile].color,
          fontFamily: "monospace", letterSpacing: "0.1em",
        }}>
          {RISK_LABELS[result.intent.riskProfile].label}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-primary)", marginLeft: "auto" }}>
          {result.intent.summary}
        </div>
      </motion.div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Strategy cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, flexShrink: 0 }}>
          {result.strategies.map((s, i) => {
            const feeSim = simulateFees(s.pool, result.intent.capitalUSD, result.intent.durationDays);
            return (
              <StrategyCardComponent
                key={s.rank}
                strategy={s}
                feeSim={feeSim}
                selected={selectedStrategy === i}
                onSelect={() => onSelectStrategy(i)}
                delay={i * 0.15}
              />
            );
          })}
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
          style={{ flexShrink: 0, padding: "0 24px 20px 24px" }}
        >
          <button
            onClick={() => setShowModal(true)}
            style={{
              width: "100%", padding: "16px",
              background: "var(--accent-primary)", color: "var(--bg-base)",
              border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
              fontFamily: "monospace", letterSpacing: "0.1em", cursor: "pointer",
            }}
          >
            EXECUTE {selected.label.toUpperCase()} STRATEGY
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {showModal && (
          <ExecutionModal
            strategy={result.strategies[selectedStrategy]}
            capitalUSD={result.intent.capitalUSD}
            onClose={() => setShowModal(false)}
            onConfirm={(txData) => {
              onExecute(result.strategies[selectedStrategy], txData, result.intent.capitalUSD);
              setShowModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
