"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Pool } from "@/lib/defillama";
import type { StrategyCard } from "@/lib/simulation";
import { connectWallet, loadOnChainPositions, loadPositionsFromStorage, savePositionToStorage, removePositionFromStorage, closeLPPosition, claimPositionFees, fetchPositionPnL, type ExecutionResult, type PositionPnL } from "@/lib/solana";
import ErrorBoundary from "@/components/ErrorBoundary";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import PositionsPanel from "@/components/PositionsPanel";
import SimulationResults from "@/components/SimulationResults";

type SimResult = {
  pools: Pool[];
  strategies: StrategyCard[];
  timestamp: string;
  intent: {
    capitalUSD: number;
    riskProfile: "low" | "medium" | "high";
    durationDays: number;
    summary: string;
  };
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
};

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
  positionAddress?: string;
  poolAddress?: string;
  pnl?: PositionPnL | null;
  pnlLoading?: boolean;
};

let msgCounter = 0;

export default function AppPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [walletAdapter, setWalletAdapter] = useState<any>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadPositionsForWallet = async (address: string) => {
    try {
      // Load from localStorage first (instant, offline-safe)
      const stored = loadPositionsFromStorage(address)
      if (stored.length > 0) {
        setPositions(stored.map(p => ({
          ...p,
          id: p.address || p.signature,
          timestamp: new Date(p.timestamp),
        })))
      }

      // Also try on-chain (may overwrite with fresher data)
      const onChain = await loadOnChainPositions(address)
      if (onChain.length > 0) {
        setPositions(onChain.map(position => ({
          id: position.address,
          tokenA: position.tokenA,
          tokenB: position.tokenB,
          protocol: position.protocol,
          feeApr: position.feeApr,
          signature: position.signature,
          explorerUrl: position.explorerUrl,
          timestamp: position.timestamp,
          capitalUSD: position.capitalUSD,
        })))
      }
    } catch (err) {
      console.error("Failed to load positions:", err)
    }
  };

  const handleWalletConnect = async () => {
    if (walletConnecting) return;
    setWalletConnecting(true);
    try {
      const { wallet, address, error } = await connectWallet();
      if (!address || error) {
        console.error(error ?? "Failed to connect wallet");
        alert(error ?? "Failed to connect wallet. Is Phantom installed?");
        return;
      }
      setConnectedWallet(address);
      setWalletAdapter(wallet);
      await loadPositionsForWallet(address);
    } finally {
      setWalletConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setConnectedWallet(null);
    setWalletAdapter(null);
    setPositions([]);
  };

  const handleRefreshPnl = async (position: Position) => {
    // Mark loading
    setPositions(prev =>
      prev.map(p => p.id === position.id ? { ...p, pnlLoading: true } : p)
    );

    try {
      const poolAddr = position.poolAddress ?? "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6";
      const posAddr = position.positionAddress ?? position.signature;
      const result = await fetchPositionPnL(poolAddr, posAddr, position.capitalUSD);

      setPositions(prev =>
        prev.map(p =>
          p.id === position.id
            ? { ...p, pnl: result, pnlLoading: false }
            : p
        )
      );
    } catch (err) {
      console.error("[refreshPnl]", err);
      setPositions(prev =>
        prev.map(p =>
          p.id === position.id
            ? { ...p, pnlLoading: false }
            : p
        )
      );
    }
  };

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    msgCounter++;

    const userMsg: Message = {
      id: `u-${msgCounter}`,
      role: "user",
      text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setSimResult(null);

    try {
      const intentRes = await fetch("/api/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: text }),
      });
      const intent = await intentRes.json();

      const poolsRes = await fetch("/api/fetch-pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskProfile: intent.riskProfile,
          capitalUSD: intent.capitalUSD,
        }),
      });
      const poolData = await poolsRes.json();

      if (!poolData || !poolData.strategies || !Array.isArray(poolData.strategies)) {
        console.error("[handleSubmit] invalid poolData:", poolData);
        msgCounter++;
        setMessages(prev => [...prev, {
          id: `e-${msgCounter}`,
          role: "assistant",
          text: "Could not load pool strategies. Please try again.",
          timestamp: new Date(),
        }]);
        setLoading(false);
        return;
      }

      const result: SimResult = {
        pools: poolData.pools ?? [],
        strategies: poolData.strategies,
        timestamp: poolData.timestamp ?? new Date().toISOString(),
        intent,
      };
      setSimResult(result);
      setSelectedStrategy(0);

      msgCounter++;
      setMessages(prev => [...prev, {
        id: `a-${msgCounter}`,
        role: "assistant",
        text: `Found ${result.strategies.length} strategies for $${intent.capitalUSD.toLocaleString()} - ${intent.riskProfile} risk. Best match: ${result.strategies[0]?.pool?.tokenA}/${result.strategies[0]?.pool?.tokenB} on ${result.strategies[0]?.pool?.protocol} at ${result.strategies[0]?.pool?.feeApr?.toFixed(1)}% APR.`,
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error(err);
      msgCounter++;
      setMessages(prev => [...prev, {
        id: `e-${msgCounter}`,
        role: "assistant",
        text: "Failed to fetch simulation data. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (strategy: StrategyCard, txData?: ExecutionResult) => {
    setExecuting(true);

    if (txData?.success && txData.signature) {
      const poolAddr = txData.poolAddress ?? strategy.pool.address;
      const newPosition: Position = {
        id: txData.signature,
        tokenA: strategy.pool.tokenA,
        tokenB: strategy.pool.tokenB,
        protocol: strategy.pool.protocol,
        feeApr: strategy.pool.feeApr,
        signature: txData.signature,
        explorerUrl: txData.explorerUrl ?? "",
        timestamp: new Date(),
        capitalUSD: simResult?.intent.capitalUSD ?? 0,
        poolAddress: poolAddr,
      };
      setPositions(prev => [newPosition, ...prev]);

      if (connectedWallet) {
        savePositionToStorage(connectedWallet, {
          ...newPosition,
          address: txData.signature,
        });
      }
    }

    msgCounter++;
    setMessages(prev => [...prev, {
      id: `a-${msgCounter}`,
      role: "assistant",
      text: `${txData?.success ? "✅" : "❌"} ${strategy.label} execution - ${strategy.pool.tokenA}/${strategy.pool.tokenB} on ${strategy.pool.protocol}.`,
      timestamp: new Date(),
    }]);
    setTimeout(() => setExecuting(false), 2000);
  };

  const handleWithdraw = async (position: Position) => {
    if (!walletAdapter) {
      alert("Connect your wallet first to withdraw.");
      return;
    }
    const poolAddr = position.poolAddress ?? "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6";
    const posAddr = position.positionAddress ?? position.signature;
    try {
      const result = await closeLPPosition(walletAdapter, posAddr, poolAddr);
      if (result.success) {
        setPositions(prev => prev.filter(p => p.id !== position.id));
        if (connectedWallet) {
          removePositionFromStorage(connectedWallet, position.id);
        }
        alert("Position closed! View tx: " + (result.explorerUrl ?? ""));
      } else {
        alert("Withdrawal failed: " + (result.error ?? "unknown error"));
      }
    } catch (err: any) {
      alert("Withdrawal error: " + (err?.message ?? String(err)));
    }
  };

  const handleDismiss = (position: Position) => {
    setPositions(prev => prev.filter(p => p.id !== position.id));
    if (connectedWallet) {
      removePositionFromStorage(connectedWallet, position.id);
    }
  };

  const handleClaimFees = async (position: Position) => {
    if (!walletAdapter) {
      alert("Connect your wallet first.");
      return;
    }
    const poolAddr = position.poolAddress ?? "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6";
    const posAddr = position.positionAddress ?? position.signature;
    try {
      const result = await claimPositionFees(walletAdapter, poolAddr, posAddr);
      if (result.success) {
        alert("Fees claimed! View tx: " + (result.explorerUrl ?? ""));
        // Refresh P&L after claiming
        handleRefreshPnl(position);
      } else {
        alert("Claim failed: " + (result.error ?? "unknown error"));
      }
    } catch (err: any) {
      alert("Claim error: " + (err?.message ?? String(err)));
    }
  };

  return (
    <ErrorBoundary>
    <div style={{
      height: "100vh", width: "100vw",
      display: "flex", flexDirection: "column",
      background: "var(--bg-base)", color: "var(--text-primary)",
      fontFamily: "Inter, 'JetBrains Mono', monospace", overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        height: 48, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 20px",
        background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)",
        flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/" style={{
            color: "var(--accent-primary)", fontSize: 11,
            letterSpacing: "0.3em", fontFamily: "monospace", textDecoration: "none",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <img src="/logo.png" alt="Mindor" style={{ width: 22, height: 22, borderRadius: 4 }} />
            {"<"} MINDOR
          </a>
          <div style={{ height: 12, width: 1, background: "var(--border-subtle)" }} />
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.2em", fontFamily: "monospace" }}>
            SIMULATION TERMINAL
          </div>
          <span style={{ fontSize: 9, color: "#22C55E", fontFamily: "monospace", padding: "2px 8px", borderRadius: 4, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            0% FEES
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px #22C55E" }} />
            <span style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.2em", fontFamily: "monospace" }}>LIVE</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {connectedWallet ? (
            <>
              <span style={{
                padding: "6px 12px", borderRadius: 8,
                border: "1px solid var(--accent-primary)44",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: 10, letterSpacing: "0.16em", fontFamily: "monospace",
              }}>
                {connectedWallet.slice(0, 4)}...{connectedWallet.slice(-4)}
              </span>
              <button onClick={handleDisconnect}
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: "1px solid var(--accent-danger)",
                  background: "transparent",
                  color: "var(--accent-danger)",
                  fontSize: 10, letterSpacing: "0.16em", fontFamily: "monospace",
                  cursor: "pointer",
                }}>
                DISCONNECT
              </button>
            </>
          ) : (
            <button onClick={handleWalletConnect} disabled={walletConnecting}
              style={{
                padding: "6px 12px", borderRadius: 8,
                border: "1px solid var(--accent-primary)",
                background: "transparent",
                color: "var(--accent-primary)",
                fontSize: 10, letterSpacing: "0.16em", fontFamily: "monospace",
                cursor: walletConnecting ? "not-allowed" : "pointer",
              }}>
              {walletConnecting ? "CONNECTING..." : "CONNECT WALLET"}
            </button>
          )}
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px #22C55E" }} />
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.15em", fontFamily: "monospace" }}>
            SOLANA MAINNET
          </div>
        </div>
      </div>

      {/* Main split panel */}
      <div className="mindor-main-panels" style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* LEFT PANEL */}
        <div className="mindor-left-panel" style={{
          width: 380, flexShrink: 0, display: "flex", flexDirection: "column",
          background: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)",
        }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <span style={{ fontSize: 10, letterSpacing: "0.25em", color: "var(--text-muted)", fontFamily: "monospace" }}>
                INTENT TERMINAL
              </span>
              <span style={{ fontSize: 9, color: "var(--accent-primary)", fontFamily: "monospace", opacity: 0.7 }}>
                DefiLlama + Meteora
              </span>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ marginTop: 40, textAlign: "center" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--text-secondary)", lineHeight: 2, opacity: 0.7, fontFamily: "monospace" }}>
                  DESCRIBE YOUR GOAL<br />
                  <span style={{ color: "var(--border-active)", opacity: 0.6 }}>
                    &quot;$5k, low risk, stable yield&quot;
                  </span>
                </div>
              </div>
            )}
            <AnimatePresence>
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "85%", padding: "10px 14px",
                    borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: msg.role === "user" ? "var(--accent-primary)" : "var(--bg-elevated)",
                    color: msg.role === "user" ? "var(--bg-base)" : "var(--text-secondary)",
                    fontSize: 13, lineHeight: 1.5,
                    border: msg.role === "assistant" ? "1px solid var(--border-subtle)" : "none",
                  }}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", gap: 4, padding: "4px 0" }}>
                {[0, 1, 2].map(i => (
                  <motion.div key={i}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-primary)" }}
                  />
                ))}
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Describe your goal..."
                rows={2}
                style={{
                  flex: 1, background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)", borderRadius: 10,
                  padding: "10px 14px", color: "var(--text-primary)",
                  fontSize: 13, fontFamily: "Inter, monospace",
                  resize: "none", outline: "none", lineHeight: 1.5,
                }}
              />
              <button onClick={handleSubmit} disabled={loading || !input.trim()}
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: loading || !input.trim() ? "var(--border-subtle)" : "var(--accent-primary)",
                  border: "none", color: "var(--bg-base)", fontSize: 16,
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "background 0.2s",
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              ENTER to send - SHIFT+ENTER for new line
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="mindor-right-panel" style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
          <PositionsPanel positions={positions} onWithdraw={handleWithdraw} onRefreshPnl={handleRefreshPnl} onDismiss={handleDismiss} onClaimFees={handleClaimFees} />
          <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
            <AnimatePresence mode="wait">
              {!simResult && !loading && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: "100%" }}>
                  <EmptyState />
                </motion.div>
              )}
              {loading && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: "100%" }}>
                  <LoadingState />
                </motion.div>
              )}
              {simResult && !loading && (
                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ height: "100%" }}>
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
    </div>
    <style dangerouslySetInnerHTML={{ __html: `
      /* Mobile: stack panels vertically */
      @media (max-width: 768px) {
        .mindor-main-panels {
          flex-direction: column !important;
        }
        .mindor-left-panel {
          width: 100% !important;
          max-height: 45vh !important;
          flex-shrink: 1 !important;
        }
        .mindor-right-panel {
          flex: 1 !important;
          min-height: 55vh !important;
        }
      }
    `}} />
    </ErrorBoundary>
  );
}
