"use client";

export default function Header({ isLoading = false }: { isLoading?: boolean }) {
  return (
    <header className="sticky top-0 z-50 glass" style={{ borderBottom: "1px solid var(--border)" }} id="site-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Logo + Gemini Badge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <svg
              className="w-4 h-4 text-indigo-400 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--text)]">
              SiteAudit
            </span>
            <span className="gradient-text text-sm font-medium tracking-[0.15em] uppercase">AI</span>
          </div>
          <span
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-medium tracking-[0.2em] uppercase"
            style={{
              background: "rgba(66, 133, 244, 0.05)",
              color: "var(--google-blue)",
              border: "1px solid rgba(66, 133, 244, 0.12)",
            }}
          >
            Powered by Gemini
          </span>
        </div>

        {/* Right: Agent Count Badge */}
        <div
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[9px] font-semibold tracking-[0.2em] uppercase transition-all"
          style={{
            background: "rgba(99, 102, 241, 0.05)",
            border: "1px solid rgba(99, 102, 241, 0.15)",
          }}
          title="Live page collection, AI research, evidence-based analysis and response validation"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-dot"
          />
          <span className="text-indigo-300">{isLoading ? "Analysis in progress" : "Live website analysis"}</span>
        </div>
      </div>
    </header>
  );
}
