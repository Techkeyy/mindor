"use client";
import { motion } from "framer-motion";
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { StrategyCard as StrategyCardType } from "@/lib/simulation";
import { simulateIL } from "@/lib/simulation";

const STRATEGY_COLORS: Record<string, string> = {
  Conservative: "#2DD4BF",
  Balanced: "#7C3AED",
  Aggressive: "#F87171",
};

type ILChartProps = {
  strategy: StrategyCardType;
  capitalUSD: number;
};

export default function ILChart({ strategy, capitalUSD }: ILChartProps) {
  const ilResult = simulateIL(strategy.pool, capitalUSD);
  const color = STRATEGY_COLORS[strategy.label];

  const scenarios = [
    { label: "-50%", change: -50 },
    { label: "-30%", change: -30 },
    { label: "-20%", change: -20 },
    { label: "-10%", change: -10 },
    { label: "0%", change: 0 },
    { label: "+10%", change: 10 },
    { label: "+20%", change: 20 },
    { label: "+50%", change: 50 },
  ];

  const calcIL = (changePct: number) => {
    const r = 1 + changePct / 100;
    const il = Math.abs((2 * Math.sqrt(r) / (1 + r)) - 1);
    return Math.round(il * capitalUSD * 100) / 100;
  };

  const fees30d = ilResult.netPnl > 0
    ? ilResult.netPnl + ilResult.ilLoss
    : (capitalUSD * (strategy.pool.feeApr / 100)) / 365 * 30;

  const data = scenarios.map(s => ({
    label: s.label,
    ilLoss: calcIL(s.change),
    netPnl: Math.round((fees30d - calcIL(s.change)) * 100) / 100,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: 20,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 4 }}>
            IL SCENARIO ANALYSIS
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {strategy.pool.tokenA}/{strategy.pool.tokenB} - ${capitalUSD.toLocaleString()} capital
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: "monospace" }}>
          {[
            ["7D", fees30d / 30 * 7],
            ["30D", fees30d],
            ["1Y", fees30d * 12],
          ].map(([period, amount]) => (
            <div key={String(period)} style={{ border: `1px solid ${color}44`, borderRadius: 6, padding: "4px 10px", color }}>
              {period}: ${Number(amount).toFixed(2)}
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="ilGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "monospace" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12, fontFamily: "monospace" }} />
            <Area type="monotone" dataKey="ilLoss" stroke="#F87171" strokeWidth={1.5} fill="url(#ilGrad)" dot={false} name="ilLoss" />
            <Line type="monotone" dataKey="netPnl" stroke={color} strokeWidth={2} dot={false} name="netPnl" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, fontFamily: "monospace" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 16, height: 2, background: "#F87171" }} />
          <span style={{ color: "var(--text-muted)" }}>IL Loss</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 16, height: 2, background: color }} />
          <span style={{ color: "var(--text-muted)" }}>Net PnL (fees - IL)</span>
        </div>
      </div>
    </motion.div>
  );
}
