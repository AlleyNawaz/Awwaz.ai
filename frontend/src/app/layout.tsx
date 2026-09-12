import type { Metadata } from "next";
import "./globals.css";
import { TopBar } from "@/components/layout/TopBar";
import { ToastProvider } from "@/components/ui/ToastProvider";

export const metadata: Metadata = {
  title: "Awwaz — Autonomous Civic Intelligence Platform",
  description: "Existing systems collect complaints. Awwaz guarantees municipal action. Autonomous intake, deterministic routing, SLA stall detection, and human-in-the-loop civic operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('awwaz_theme');
                  var theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ToastProvider>
          <TopBar />
          <main style={{ minHeight: "calc(100vh - 130px)" }}>
            {children}
          </main>
          <footer style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "1.25rem 1.5rem",
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            background: "var(--bg-header)",
            backdropFilter: "blur(12px)",
            transition: "background-color 0.25s ease, border-color 0.25s ease",
          }}>
            <div style={{ maxWidth: 1300, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Awwaz.ai</span>
                <span>•</span>
                <span>Autonomous Civic Infrastructure v2.4</span>
                <span>•</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>SHA-256 Verified Ledger</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 8px #10b981" }} />
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>All Systems Nominal</span>
                </span>
                <span>•</span>
                <span>Deterministic Benchmark</span>
              </div>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
