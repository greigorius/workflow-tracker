// Focus mode — alternative "Queue" layout.
// Single-column inbox, grouped by status (Needs attention / Up next / Not started / Complete).
// Minimal chrome: name + step subtext + BIC + one primary action, revealed on hover/focus.

const { useState: useStateFQ, useMemo: useMemoFQ, useEffect: useEffectFQ } = React;

function FocusQueueView({ items, pending, actions, latency, density, onOpenInspector }) {
  const filtered = items;

  const groups = useMemoFQ(() => {
    const blocked = [], active = [], notStarted = [], complete = [];
    filtered.forEach((it) => {
      const s = window.itemStatus(it);
      if (s === "blocked") blocked.push(it);
      else if (s === "in-progress") active.push(it);
      else if (s === "not-started") notStarted.push(it);
      else complete.push(it);
    });
    // Active sorted by deepest progress (closest to done)
    active.sort((a, b) => b.progress - a.progress);
    return { blocked, active, notStarted, complete };
  }, [filtered]);

  // Flat list for keyboard nav (skips complete by default unless empty groups)
  const [showComplete, setShowComplete] = useStateFQ(false);
  const flat = useMemoFQ(() => {
    const list = [...groups.blocked, ...groups.active, ...groups.notStarted];
    if (showComplete) list.push(...groups.complete);
    return list;
  }, [groups, showComplete]);

  const [focusedId, setFocusedId] = useStateFQ(flat[0]?.notionId || null);

  // Keep focused row valid as the list changes
  useEffectFQ(() => {
    if (!flat.length) return;
    if (!flat.find((x) => x.notionId === focusedId)) setFocusedId(flat[0].notionId);
  }, [flat, focusedId]);

  useEffectFQ(() => {
    function handler(e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
      if (!flat.length) return;
      const i = Math.max(0, flat.findIndex((x) => x.id === focusedId));
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault(); setFocusedId(flat[Math.min(flat.length - 1, i + 1)].id);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault(); setFocusedId(flat[Math.max(0, i - 1)].id);
      } else if (e.key === " " || e.key === "Enter") {
        const it = flat[i]; if (!it) return;
        if (window.itemStatus(it) === "blocked") return;
        if (it.progress >= window.TOTAL_STEPS) return;
        e.preventDefault();
        actions.completeStep(it.notionId, it.progress, latency);
      } else if (e.key.toLowerCase() === "b") {
        const it = flat[i]; if (!it || it.progress >= window.TOTAL_STEPS) return;
        e.preventDefault();
        if (window.itemStatus(it) === "blocked") actions.unblockStep(it.id, latency);
        else onOpenInspector(it.notionId, it.progress, "block");
      } else if (e.key.toLowerCase() === "i") {
        const it = flat[i]; if (!it) return;
        e.preventDefault();
        onOpenInspector(it.notionId, it.progress, "details");
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flat, focusedId, actions, latency, onOpenInspector]);

  const renderRow = (item) => (
    <QueueRow
      key={item.notionId}
      item={item}
      pending={pending}
      actions={actions}
      latency={latency}
      isFocused={item.notionId === focusedId}
      onFocus={() => setFocusedId(item.notionId)}
      onOpenInspector={onOpenInspector}
    />
  );

  const sectionTitle = (icon, label, count, accent) => (
    <div className={`fq-section-head fq-section-${accent}`}>
      <i className={`ti ${icon}`} aria-hidden="true"></i>
      <span className="fq-section-lbl">{label}</span>
      <span className="fq-section-count">{count}</span>
    </div>
  );

  const hasAny = groups.blocked.length || groups.active.length || groups.notStarted.length || (showComplete && groups.complete.length);

  return (
    <div className={`fq-wrap density-${density}`}>
      <div className="fq-inner">
        {groups.blocked.length > 0 && (
          <section className="fq-group">
            {sectionTitle("ti-alert-triangle", "Needs attention", groups.blocked.length, "warn")}
            <div className="fq-list">{groups.blocked.map(renderRow)}</div>
          </section>
        )}

        {groups.active.length > 0 && (
          <section className="fq-group">
            {sectionTitle("ti-target", "Up next", groups.active.length, "active")}
            <div className="fq-list">{groups.active.map(renderRow)}</div>
          </section>
        )}

        {groups.notStarted.length > 0 && (
          <section className="fq-group">
            {sectionTitle("ti-circle-dashed", "Not started", groups.notStarted.length, "idle")}
            <div className="fq-list">{groups.notStarted.map(renderRow)}</div>
          </section>
        )}

        {groups.complete.length > 0 && (
          <section className="fq-group">
            <button
              className="fq-section-head fq-section-toggle"
              onClick={() => setShowComplete((v) => !v)}
              aria-expanded={showComplete}
            >
              <i className={`ti ${showComplete ? "ti-chevron-down" : "ti-chevron-right"}`} aria-hidden="true"></i>
              <span className="fq-section-lbl">Complete</span>
              <span className="fq-section-count">{groups.complete.length}</span>
            </button>
            {showComplete && <div className="fq-list">{groups.complete.map(renderRow)}</div>}
          </section>
        )}

        {!hasAny && (
          <div className="fq-empty">
            <i className="ti ti-checks" aria-hidden="true"></i>
            <div>Nothing in the queue.</div>
          </div>
        )}
      </div>

      <div className="fq-foot">
        <span className="mx-shortcut"><kbd>↑↓</kbd>navigate</span>
        <span className="mx-shortcut"><kbd>Space</kbd>mark done</span>
        <span className="mx-shortcut"><kbd>B</kbd>block / unblock</span>
        <span className="mx-shortcut"><kbd>I</kbd>inspect</span>
      </div>
    </div>
  );
}

function QueueRow({ item, pending, actions, latency, isFocused, onFocus, onOpenInspector }) {
  const status = window.itemStatus(item);
  const bc = window.BIC_COLORS[item.bic] || { bg: "#1f2937", fg: "#9ca3af" };
  const isBlocked = status === "blocked";
  const isComplete = status === "complete";
  const stepIdx = item.progress;
  const step = window.STEPS[stepIdx];
  const phase = window.PHASES.find((p) => p.steps.includes(stepIdx));
  const cellPending = pending[`${item.notionId}:${stepIdx}`];
  const pct = window.itemPct(item);

  return (
    <div
      className={`fq-row fq-row-${status} ${isFocused ? "is-focused" : ""}`}
      onClick={onFocus}
      tabIndex={0}
    >
      <div className="fq-row-marker">
        <i className={`ti ${isBlocked ? "ti-alert-triangle" : isComplete ? "ti-circle-check" : status === "not-started" ? "ti-circle-dashed" : "ti-circle-dot"}`} aria-hidden="true"></i>
      </div>

      <div className="fq-row-main">
        <div className="fq-row-title">
          <span className="fq-id">{item.id}</span>
          <span className="fq-name">{item.name}</span>
        </div>

        {isComplete ? (
          <div className="fq-row-sub">
            <span className="fq-project">{item.project}</span>
            <span className="fq-dot">·</span>
            <span className="fq-done-text">All {window.TOTAL_STEPS} steps signed off</span>
          </div>
        ) : isBlocked ? (
          <div className="fq-row-sub">
            <span className="fq-blocker-text">
              <i className="ti ti-alert-triangle" aria-hidden="true"></i>
              {item.blockerText}
            </span>
            <span className="fq-dot">·</span>
            <span className="fq-step-ref">Step {stepIdx + 1} · {step.name}</span>
          </div>
        ) : (
          <div className="fq-row-sub">
            <span className="fq-phase-tag">{phase?.label}</span>
            <span className="fq-dot">·</span>
            <span className="fq-step-ref">Step {stepIdx + 1} · {step.name}</span>
            <span className="fq-dot">·</span>
            <span className="fq-project">{item.project}</span>
          </div>
        )}
      </div>

      <div className="fq-row-prog" aria-label={`${pct}% complete`}>
        <div className="fq-row-prog-bar" style={{ width: `${pct}%`, background: pct === 100 ? "#1D9E75" : isBlocked ? "#D85A30" : "var(--accent)" }}></div>
      </div>

      <button
        className="fq-bic"
        style={{ background: bc.bg, color: bc.fg }}
        onClick={(e) => { e.stopPropagation(); onOpenInspector(item.notionId, stepIdx, "details"); }}
        title={`Ball in court: ${item.bic}`}
      >
        {item.bic}
      </button>

      <div className="fq-row-action">
        {isComplete ? (
          <span className="fq-pct-text">100%</span>
        ) : isBlocked ? (
          <button
            className="fq-btn fq-btn-warn"
            onClick={(e) => { e.stopPropagation(); actions.unblockStep(item.notionId, latency); }}
          >
            <i className="ti ti-lock-open" aria-hidden="true"></i>
            Unblock
          </button>
        ) : (
          <button
            className={`fq-btn fq-btn-primary ${cellPending ? "is-syncing" : ""}`}
            onClick={(e) => { e.stopPropagation(); actions.completeStep(item.notionId, stepIdx, latency); }}
            disabled={cellPending}
            title="Mark step done (Space)"
          >
            {cellPending ? (
              <><span className="fc-spinner"></span>Syncing</>
            ) : (
              <><i className="ti ti-check" aria-hidden="true"></i>Mark done</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

window.FocusQueueView = FocusQueueView;
