// app.jsx — App shell: top bar, view router, loading screen, Notion sync.

const TWEAK_DEFAULTS = {
  view:        "matrix",
  density:     "comfortable",
  theme:       "dark",
  accent:      "#378ADD",
  focusLayout: "queue",
};

function App() {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const view = tweaks.view || "matrix";

  // ── Data loading ────────────────────────────────────────────────────────
  const [loadState, setLoadState] = React.useState("loading"); // "loading" | "ok" | "error"
  const [loadError, setLoadError] = React.useState(null);

  const store = window.useWorkflowStore([]);

  React.useEffect(() => {
    fetch("/api/items")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(({ items }) => {
        store.setItems(items);
        setLoadState("ok");
      })
      .catch((err) => {
        setLoadError(err.message);
        setLoadState("error");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filters ─────────────────────────────────────────────────────────────
  const [filters, setFilters] = React.useState({
    q:       "",
    project: "All projects",
    bic:     "All BIC",
    status:  "All statuses",
  });

  // Derive unique project names from loaded items
  const projectOptions = React.useMemo(() => {
    const names = [...new Set(store.items.map((i) => i.project))].sort();
    return names;
  }, [store.items]);

  // Apply all filters once here — pass filteredItems down to views
  const filteredItems = React.useMemo(() => {
    return store.items.filter((it) => {
      if (filters.q) {
        const q = filters.q.toLowerCase().trim();
        if (!it.name.toLowerCase().includes(q) && !(it.id || "").toLowerCase().includes(q)) return false;
      }
      if (filters.project && filters.project !== "All projects") {
        if ((it.project || "").trim() !== filters.project.trim()) return false;
      }
      if (filters.bic && filters.bic !== "All BIC") {
        if ((it.bic || "").trim() !== filters.bic.trim()) return false;
      }
      if (filters.status && filters.status !== "All statuses") {
        const s = window.itemStatus(it);
        const map = {
          "Not started": "not-started",
          "In progress": "in-progress",
          "Blocked":     "blocked",
          "Complete":    "complete",
        };
        if (s !== map[filters.status]) return false;
      }
      return true;
    });
  }, [store.items, filters]);

  const bicOptions = window.BIC_OPTIONS;

  // ── Inspector ───────────────────────────────────────────────────────────
  const [inspector, setInspector] = React.useState({
    open: false, itemId: null, stepIdx: null, mode: "details",
  });
  const [focusedCell, setFocusedCell] = React.useState(null);

  const onOpenInspector = React.useCallback((itemId, stepIdx, mode) => {
    setInspector({ open: true, itemId, stepIdx, mode: mode || "details" });
  }, []);
  const onCloseInspector = React.useCallback(() => {
    setInspector((p) => ({ ...p, open: false }));
  }, []);

  const inspectedItem = React.useMemo(
    () => store.items.find((i) => i.notionId === inspector.itemId),
    [store.items, inspector.itemId]
  );

  // ── Theme ───────────────────────────────────────────────────────────────
  React.useEffect(() => {
    document.body.classList.toggle("theme-light", tweaks.theme === "light");
    document.documentElement.style.setProperty("--accent", tweaks.accent);
  }, [tweaks.theme, tweaks.accent]);

  const anyPending = Object.keys(store.pending).length > 0;
  const setView = (v) => setTweak("view", v);

  // ── Component references ─────────────────────────────────────────────────
  const MatrixView    = window.MatrixView;
  const FocusView     = window.FocusView;
  const FocusQueueView = window.FocusQueueView;
  const ReportsView   = window.ReportsView;
  const Inspector     = window.Inspector;
  const ToastTray     = window.ToastTray;
  const TweaksPanel   = window.TweaksPanel;
  const TweakSection  = window.TweakSection;
  const TweakRadio    = window.TweakRadio;
  const TweakColor    = window.TweakColor;

  // ── Loading screen ───────────────────────────────────────────────────────
  if (loadState === "loading") {
    return (
      <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", opacity: 0.7 }}>
          <div className="sync-dot" style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", margin: "0 auto 12px", animation: "pulse 1s ease-in-out infinite" }}></div>
          <div style={{ fontSize: 13, letterSpacing: "0.04em" }}>Loading from Notion…</div>
        </div>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Failed to connect to Notion</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 20 }}>{loadError}</div>
          <button
            style={{ padding: "8px 16px", borderRadius: 6, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}
            onClick={() => { setLoadState("loading"); setLoadError(null); fetch("/api/items").then(r => r.json()).then(({ items }) => { store.setItems(items); setLoadState("ok"); }).catch(err => { setLoadError(err.message); setLoadState("error"); }); }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Main app ─────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <span className="brand-mark"></span>
            <span className="brand-text">Workflow</span>
          </div>
          <nav className="view-tabs" role="tablist">
            <button role="tab" aria-selected={view === "matrix"} className={`view-tab ${view === "matrix" ? "is-active" : ""}`} onClick={() => setView("matrix")}>
              <i className="ti ti-grid-dots" aria-hidden="true"></i>Matrix
            </button>
            <button role="tab" aria-selected={view === "focus"} className={`view-tab ${view === "focus" ? "is-active" : ""}`} onClick={() => setView("focus")}>
              <i className="ti ti-target" aria-hidden="true"></i>Focus
            </button>
            <button role="tab" aria-selected={view === "reports"} className={`view-tab ${view === "reports" ? "is-active" : ""}`} onClick={() => setView("reports")}>
              <i className="ti ti-chart-bar" aria-hidden="true"></i>Reports
            </button>
          </nav>
        </div>

        <div className="topbar-right">
          <button
            className="save-backup-btn"
            onClick={store.saveBackup}
            title={store.lastBackup ? `Last saved ${new Date(store.lastBackup).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No backup yet"}
          >
            <i className="ti ti-device-floppy" aria-hidden="true"></i>
            {store.lastBackup
              ? new Date(store.lastBackup).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Save"}
          </button>
          <div className={`sync-pill ${anyPending ? "is-syncing" : ""}`}>
            <span className="sync-dot"></span>
            <span className="sync-lbl">
              {anyPending ? "Syncing…" : `Notion · ${store.items.length} items`}
            </span>
          </div>
        </div>
      </header>

      {view !== "reports" && (
        <div className="filterbar">
          <div className="filt-group">
            <i className="ti ti-search filt-icon" aria-hidden="true"></i>
            <input
              className="filt-input"
              type="text"
              placeholder="Search items…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <select
            className="filt-input filt-select"
            value={filters.project}
            onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))}
          >
            <option>All projects</option>
            {projectOptions.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select
            className="filt-input filt-select"
            value={filters.bic}
            onChange={(e) => setFilters((f) => ({ ...f, bic: e.target.value }))}
          >
            <option>All BIC</option>
            {bicOptions.map((b) => <option key={b}>{b}</option>)}
          </select>
          <select
            className="filt-input filt-select"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option>All statuses</option>
            <option>Not started</option>
            <option>In progress</option>
            <option>Blocked</option>
            <option>Complete</option>
          </select>
          <div className="filt-spacer"></div>
          <div className="filt-count">
            {filteredItems.length} items
          </div>
        </div>
      )}

      <main className="main">
        {view === "matrix" && (
          <MatrixView
            items={filteredItems}
            pending={store.pending}
            actions={store.actions}
            latency={0}
            density={tweaks.density}
            onOpenInspector={onOpenInspector}
            focusedCell={focusedCell}
            setFocusedCell={setFocusedCell}
          />
        )}
        {view === "focus" && tweaks.focusLayout === "queue" && (
          <FocusQueueView
            items={filteredItems}
            pending={store.pending}
            actions={store.actions}
            latency={0}
            density={tweaks.density}
            onOpenInspector={onOpenInspector}
          />
        )}
        {view === "focus" && tweaks.focusLayout !== "queue" && (
          <FocusView
            items={filteredItems}
            pending={store.pending}
            actions={store.actions}
            latency={0}
            density={tweaks.density}
            onOpenInspector={onOpenInspector}
          />
        )}
        {view === "reports" && (
          <ReportsView items={store.items} density={tweaks.density} />
        )}
      </main>

      <Inspector
        open={inspector.open}
        item={inspectedItem}
        stepIdx={inspector.stepIdx}
        mode={inspector.mode}
        onClose={onCloseInspector}
        actions={store.actions}
        latency={0}
        pending={store.pending}
      />

      <ToastTray toasts={store.toasts} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="View">
          <TweakRadio
            label=""
            value={tweaks.view}
            options={[
              { value: "matrix",  label: "Matrix" },
              { value: "focus",   label: "Focus" },
              { value: "reports", label: "Reports" },
            ]}
            onChange={(v) => setTweak("view", v)}
          />
        </TweakSection>
        <TweakSection label="Density">
          <TweakRadio
            label=""
            value={tweaks.density}
            options={[
              { value: "compact",     label: "Compact" },
              { value: "comfortable", label: "Roomy" },
            ]}
            onChange={(v) => setTweak("density", v)}
          />
        </TweakSection>
        <TweakSection label="Focus layout">
          <TweakRadio
            label=""
            value={tweaks.focusLayout}
            options={[
              { value: "queue", label: "Queue" },
              { value: "rows",  label: "Rows" },
            ]}
            onChange={(v) => setTweak("focusLayout", v)}
          />
        </TweakSection>
        <TweakSection label="Theme">
          <TweakRadio
            label=""
            value={tweaks.theme}
            options={[
              { value: "dark",  label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(v) => setTweak("theme", v)}
          />
        </TweakSection>
        <TweakSection label="Accent">
          <TweakColor
            label=""
            value={tweaks.accent}
            options={["#378ADD", "#1D9E75", "#BA7517", "#A062D9"]}
            onChange={(v) => setTweak("accent", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
