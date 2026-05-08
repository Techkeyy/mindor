"use client";
import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
          background: "var(--bg-base)", color: "var(--text-primary)",
          fontFamily: "monospace", padding: 24, textAlign: "center",
        }}>
          <div style={{ fontSize: 48, opacity: 0.3 }}>⚠</div>
          <div style={{ fontSize: 14, letterSpacing: "0.1em", color: "var(--text-muted)" }}>
            SOMETHING WENT WRONG
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 480, lineHeight: 1.6 }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: "10px 20px",
              background: "var(--accent-primary)", color: "var(--bg-base)",
              border: "none", borderRadius: 8, fontSize: 12,
              fontFamily: "monospace", cursor: "pointer",
            }}
          >
            RELOAD
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
