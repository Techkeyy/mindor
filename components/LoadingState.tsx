"use client";
import { motion } from "framer-motion";

export default function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
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
              borderRadius: "50%",
              background: "var(--accent-primary)",
            }}
          />
        ))}
      </div>
      <div style={{
        fontFamily: "monospace",
        fontSize: 11,
        letterSpacing: "0.2em",
        color: "var(--text-muted)",
      }}>
        ANALYZING INTENT...
      </div>
    </motion.div>
  );
}
