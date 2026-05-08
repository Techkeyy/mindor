"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { StrategyCard as StrategyCardType } from "@/lib/simulation";
import { connectWallet, executeLPPosition, getBalance, type WalletAdapter, type ExecutionResult } from "@/lib/solana";

const STRATEGY_COLORS: Record<string, string> = {
  Conservative: "#2DD4BF",
  Balanced: "#7C3AED",
  Aggressive: "#F87171",
};

type ExecutionModalProps = {
  strategy: StrategyCardType;
  capitalUSD: number;
  onClose: () => void;
  onConfirm: (txData?: ExecutionResult) => void;
};

export default function ExecutionModal({
  strategy,
  capitalUSD,
  onClose,
  onConfirm,
}: ExecutionModalProps) {
  const [step, setStep] = useState<"preview" | "connecting" | "confirm" | "executing" | "success" | "error">("preview");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [txResult, setTxResult] = useState<ExecutionResult | null>(null);
  const [walletAdapter, setWalletAdapter] = useState<WalletAdapter | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const color = STRATEGY_COLORS[strategy.label];

  const [tokenAInput, setTokenAInput] = useState<string>("");
  const [tokenBInput, setTokenBInput] = useState<string>("");

  // Fetch live prices and compute sensible deposit defaults
  useEffect(() => {
    let cancelled = false;
    const computeDefaults = async () => {
      const STABLES = new Set(["USDC", "USDT", "DAI", "FRAX", "USDH"]);
      const tokenA = strategy.pool.tokenA.toUpperCase();
      const tokenB = strategy.pool.tokenB.toUpperCase();
      const aIsStable = STABLES.has(tokenA);
      const bIsStable = STABLES.has(tokenB);

      if (aIsStable && bIsStable) {
        // Both stablecoins — capital / 2 for each
        if (!cancelled) {
          setTokenAInput((capitalUSD / 2).toFixed(2));
          setTokenBInput((capitalUSD / 2).toFixed(2));
        }
        return;
      }

      // Fetch live price for the volatile token
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd`,
          { cache: "no-store" }
        );
        const data = await res.json();
        const solPrice = data?.solana?.usd ?? 150;
        const half = capitalUSD / 2;

        if (tokenA === "SOL" || tokenB === "SOL") {
          const solAmount = half / solPrice;
          if (tokenA === "SOL" && !cancelled) {
            setTokenAInput(solAmount.toFixed(4));
            setTokenBInput(half.toFixed(2));
          } else if (!cancelled) {
            setTokenAInput(half.toFixed(2));
            setTokenBInput(solAmount.toFixed(4));
          }
        } else {
          // Non-SOL volatile — assume ~$1 as fallback
          if (!cancelled) {
            setTokenAInput(half.toFixed(2));
            setTokenBInput(half.toFixed(2));
          }
        }
      } catch {
        // CoinGecko down — use reasonable fallback
        if (!cancelled) {
          const fallback = (capitalUSD / 2).toFixed(2);
          setTokenAInput(fallback);
          setTokenBInput(fallback);
        }
      }
    };
    computeDefaults();
    return () => { cancelled = true; };
  }, [strategy.pool.tokenA, strategy.pool.tokenB, capitalUSD]);

  const handleConnect = async () => {
    setStep("connecting");
    setErrorMsg("");
    const { wallet, address, balance, error } = await connectWallet();
    if (error || !wallet || !address) {
      setErrorMsg(error ?? "Failed to connect wallet");
      setStep("preview");
      return;
    }
    setWalletAdapter(wallet);
    setWalletAddress(address);
    setWalletBalance(balance ?? await getBalance(address));
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!walletAdapter) return;
    setStep("executing");

    // Pass the user's edited deposit amounts
    const tokenAOverride = parseFloat(tokenAInput) || undefined;
    const tokenBOverride = parseFloat(tokenBInput) || undefined;

    const result = await executeLPPosition(
      walletAdapter,
      strategy.pool.address,
      strategy.pool.tokenA,
      strategy.pool.tokenB,
      capitalUSD,
      tokenAOverride,
      tokenBOverride,
    );
    setTxResult(result);
    if (result.success) {
      setStep("success");
    } else {
      setErrorMsg(result.error ?? "Transaction failed");
      setStep("error");
    }
  };

  useEffect(() => {
    if (step !== "success" || !txResult?.success) return;
    const timeout = window.setTimeout(() => {
      onConfirm(txResult ?? undefined);
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [step, txResult, onConfirm]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(8, 11, 18, 0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          background: "var(--bg-elevated)",
          border: `1px solid ${color}44`,
          borderRadius: 20,
          padding: 32,
          width: 480,
          maxWidth: "90vw",
          boxShadow: `0 0 60px ${color}22`,
        }}
      >
        {/* --- PREVIEW step --- */}
        {step === "preview" && (
          <>
            <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 20 }}>
              EXECUTION PREVIEW
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
              {strategy.pool.tokenA}/{strategy.pool.tokenB}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
              {strategy.pool.protocol} - {strategy.label}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                ["CAPITAL", `$${capitalUSD.toLocaleString()}`],
                ["FEE APR", `${strategy.pool.feeApr.toFixed(1)}%`],
                ["7D FEES", `$${((strategy.projectedMonthlyFees / 30) * 7).toFixed(2)}`],
                ["30D FEES", `$${strategy.projectedMonthlyFees.toFixed(2)}`],
                ["1Y FEES", `$${(strategy.projectedMonthlyFees * 12).toFixed(2)}`],
                ["IL RISK", strategy.projectedILRisk],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "var(--bg-base)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.15em", fontFamily: "monospace", marginBottom: 4 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-base)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, lineHeight: 1.6 }}>
              Note: You will be asked to approve this transaction in your Phantom wallet. Mindor never holds your private keys.
            </div>
            {/* Editable deposit amounts */}
            <div style={{ background: "var(--bg-base)", borderRadius: 10, padding: "14px 16px", marginBottom: 20, border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 12 }}>
                DEPOSIT AMOUNTS (EDITABLE)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 4 }}>{strategy.pool.tokenA} AMOUNT</div>
                  <input type="number" value={tokenAInput} onChange={e => setTokenAInput(e.target.value)} step="0.001" min="0.001"
                    style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontFamily: "monospace", fontSize: 14, outline: "none", boxSizing: "border-box" as const }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 4 }}>{strategy.pool.tokenB} AMOUNT</div>
                  <input type="number" value={tokenBInput} onChange={e => setTokenBInput(e.target.value)} step="0.1" min="0.1"
                    style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontFamily: "monospace", fontSize: 14, outline: "none", boxSizing: "border-box" as const }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, fontFamily: "monospace" }}>
                Estimated total: ~${(parseFloat(tokenAInput || "0") * 150 + parseFloat(tokenBInput || "0")).toFixed(2)} USD
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", fontFamily: "monospace" }}>
                Cancel
              </button>
              <button onClick={handleConnect} style={{ flex: 2, padding: "12px", background: color, border: "none", borderRadius: 10, color: "var(--bg-base)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                CONNECT PHANTOM &gt;
              </button>
            </div>
          </>
        )}

        {/* --- CONNECTING step --- */}
        {step === "connecting" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2], y: [0, -8, 0] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  style={{ width: 10, height: 10, borderRadius: "50%", background: color }}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--text-muted)", fontFamily: "monospace" }}>
              CONNECTING WALLET...
            </div>
          </div>
        )}

        {/* --- CONFIRM step --- */}
        {step === "confirm" && (
          <>
            {walletAddress && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 12px", background: "var(--bg-base)", borderRadius: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px #22C55E", flexShrink: 0 }} />
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                </div>
                {walletBalance !== null && (
                  <div style={{ fontSize: 11, fontFamily: "monospace", color, flexShrink: 0 }}>
                    {walletBalance.toFixed(2)} SOL
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px #22C55E" }} />
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#22C55E", fontFamily: "monospace" }}>
                PHANTOM CONNECTED
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Confirm Transaction</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
              Add liquidity to {strategy.pool.tokenA}/{strategy.pool.tokenB} pool on {strategy.pool.protocol} with ${capitalUSD.toLocaleString()} capital.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", fontFamily: "monospace" }}>
                Cancel
              </button>
              <button onClick={handleConfirm} style={{ flex: 2, padding: "12px", background: color, border: "none", borderRadius: 10, color: "var(--bg-base)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                CONFIRM IN PHANTOM &gt;
              </button>
            </div>
          </>
        )}

        {/* --- ERROR step --- */}
        {step === "error" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#F87171", marginBottom: 12 }}>Transaction Failed</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>{errorMsg}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", fontFamily: "monospace" }}>
                Close
              </button>
              <button onClick={() => setStep("preview")} style={{ flex: 1, padding: "12px", background: color, border: "none", borderRadius: 10, color: "var(--bg-base)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}>
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* --- SUCCESS step --- */}
        {step === "success" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "32px 0" }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.1 }} style={{ marginBottom: 16 }}>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="28" fill="#22C55E" fillOpacity="0.15" />
                <circle cx="28" cy="28" r="20" stroke="#22C55E" strokeWidth="2" />
                <path d="M18 28l7 7 13-13" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Position Opened</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
              {strategy.pool.tokenA}/{strategy.pool.tokenB} on {strategy.pool.protocol}
            </div>
            <div style={{ fontSize: 12, color, fontFamily: "monospace" }}>
              Earning {strategy.pool.feeApr.toFixed(1)}% APR
            </div>
            {txResult?.signature && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 6 }}>
                  TRANSACTION
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace", wordBreak: "break-all", background: "var(--bg-base)", padding: "8px 12px", borderRadius: 6, marginBottom: 8, border: "1px solid var(--border-subtle)" }}>
                  {txResult.signature.slice(0, 24)}...{txResult.signature.slice(-8)}
                </div>
                {txResult.explorerUrl && (
                  <a href={txResult.explorerUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-primary)", fontFamily: "monospace", textDecoration: "none", border: "1px solid var(--accent-primary)44", padding: "6px 14px", borderRadius: 6 }}>
                    View on Solana Explorer
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
