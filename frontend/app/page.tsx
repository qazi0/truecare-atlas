export default function Home() {
  return (
    <div className="flex flex-col flex-1 h-full">
      {/* Top bar */}
      <header className="flex items-center gap-4 border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight">
          TrustMap India
        </h1>
        <div className="flex-1">
          <input
            type="text"
            placeholder="Find facilities in Bihar that can handle high-risk delivery — NICU + emergency C-section + blood bank…"
            className="w-full rounded-md border border-border bg-surface px-4 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-trust"
          />
        </div>
        <nav className="flex gap-1">
          {["Search", "Map", "Audit"].map((tab) => (
            <button
              key={tab}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-border/50 transition-colors"
            >
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {/* Three-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Reasoning trace (left) */}
        <aside className="w-[300px] border-r border-border p-4 overflow-y-auto">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Reasoning Trace
          </p>
          <p className="mt-4 text-sm text-text-muted">
            Ask a question to see the agent&apos;s reasoning steps.
          </p>
        </aside>

        {/* Main content (center) */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-2xl font-semibold text-text">
              Healthcare Intelligence Search
            </p>
            <p className="mt-2 max-w-md text-sm text-text-muted">
              Search 10,000 Indian medical facilities with AI-powered trust
              scoring and capability verification.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[
                "Bihar maternal NICU",
                "Maharashtra oncology Tier-2 cities",
                "Tamil Nadu dialysis access",
              ].map((prompt) => (
                <button
                  key={prompt}
                  className="rounded-full border border-border px-3 py-1 text-xs text-text-muted hover:border-trust hover:text-trust transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </main>

        {/* Trust panel (right) */}
        <aside className="w-[380px] border-l border-border p-4 overflow-y-auto">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Trust Panel
          </p>
          <p className="mt-4 text-sm text-text-muted">
            Select a facility to see its trust score and evidence.
          </p>
        </aside>
      </div>
    </div>
  );
}
