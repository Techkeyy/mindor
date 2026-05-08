"use client";
import { motion } from "framer-motion";

export default function EmptyState() {
  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      opacity: 0.6,
    }}>
      <div style={{
        width: 64, height: 64,
        borderRadius: "50%",
        border: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center",
        justifyContent: "center",
        color: "var(--text-secondary)",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <div style={{
        fontFamily: "monospace",
        fontSize: 11,
        letterSpacing: "0.2em",
        color: "var(--text-secondary)",
        textAlign: "center",
        lineHeight: 1.8,
      }}>
        TYPE YOUR INTENT<br />TO BEGIN SIMULATION
      </div>
    </div>
  );
}
