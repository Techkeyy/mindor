import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editorial №01 — Mindor",
  description: "Liquid Resin Collection — An exploration of controlled material transformation.",
};

export default function EditorialPage() {
  return (
    <iframe
      src="/editorial.html"
      style={{
        width: "100vw",
        height: "100vh",
        border: "none",
        display: "block",
        background: "#FAFAFA",
      }}
      title="Mindor Editorial №01"
    />
  );
}
