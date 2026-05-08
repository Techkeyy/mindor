"use client";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { StrategyCard as StrategyCardType, FeeSimulation } from "@/lib/simulation";

const STRATEGY_COLORS: Record<string, string> = {
  Conservative: "#2DD4BF",
  Balanced: "#7C3AED",
  Aggressive: "#F87171",
};

type StrategyCardProps = {
  strategy: StrategyCardType;
  feeSim: FeeSimulation;
  selected: boolean;
  onSelect: () => void;
  delay: number;
};

export default function StrategyCardComponent({
  strategy,
  feeSim,
  selected,
  onSelect,
  delay,
}: StrategyCardProps) {
  const color = STRATEGY_COLORS[strategy.label];
  const feeData = feeSim.feesByDay;
  const daily = feeSim.dailyFees;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      onClick={onSelect}
      style={{
        background: selected ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: `1px solid ${selected ? color : "var(--border-subtle)"}`,
        borderRadius: 16,
        padding: "20px 20px 16px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: selected
          ? `0 0 24px ${color}22, 0 4px 24px rgba(0,0,0,0.3)`
          : "0 2px 8px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.25em", color, fontFamily: "monospace", marginBottom: 6, fontWeight: 600 }}>
            {strategy.label.toUpperCase()}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {strategy.pool.tokenA}
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/</span>
            {strategy.pool.tokenB}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontFamily: "monospace", letterSpacing: "0.05em" }}>
            {strategy.pool.protocol}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 38, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1, letterSpacing: "-0.03em", textShadow: selected ? `0 0 20px ${color}66` : "none" }}>
            {strategy.pool.feeApr.toFixed(1)}
            <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 2 }}>%</span>
          </div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", fontFamily: "monospace", marginTop: 2 }}>
            FEE APR
          </div>
        </div>
      </div>

      <div style={{ height: 52, marginLeft: -4, marginRight: -4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={feeData}>
            <defs>
              <linearGradient id={`grad-${strategy.rank}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="cumulative" stroke={color} strokeWidth={2} fill={`url(#grad-${strategy.rank})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {[
          { label: "1D", value: daily },
          { label: "7D", value: daily * 7 },
          { label: "30D", value: strategy.projectedMonthlyFees },
          { label: "1Y", value: strategy.projectedMonthlyFees * 12 },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "var(--bg-base)", borderRadius: 8, padding: "7px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 3 }}>
              {label}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>
              ${value < 0.01 ? value.toFixed(4) : value < 1 ? value.toFixed(3) : value.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4, borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: strategy.pool.ilRisk === "low" ? "#22C55E" : strategy.pool.ilRisk === "medium" ? "#FBBF24" : "#F87171" }} />
          <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "monospace" }}>
            IL: {strategy.projectedILRisk}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 48, height: 3, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${strategy.confidenceScore}%` }}
              transition={{ duration: 0.8, delay: delay + 0.3 }}
              style={{ height: "100%", background: color, borderRadius: 2 }}
            />
          </div>
          <span style={{ fontSize: 10, color, fontFamily: "monospace", fontWeight: 600 }}>
            {strategy.confidenceScore}%
          </span>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {strategy.recommendation}
      </div>
    </motion.div>
  );
}
