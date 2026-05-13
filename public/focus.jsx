// Focus mode — collapse each item to ONE row showing its current active step
// with a big primary "Done" target. Auto-advance: after completing, the row
// updates in place to show the next step. Items with blockers float to the
// top and show their reason inline. Completed items are tucked away.

const { useState: useStateF, useMemo: useMemoF, useEffect: useEffectF, useRef: useRefF } = React;

function FocusView({ items, pending, actions, latency, density, onOpenInspector }) {
  const filtered = items;

  const [hideDone, setHideDone] = useStateF(true);
  const [focusedRowIdx, setFocusedRowIdx] = useStateF(0);
  const containerRef = useRefF(null);

  // Sort: blocked first (most urgent), then in-progress by progress desc, then not-started, then complete
  const sorted = useMemoF(() => {
    const order = { blocked: 0, "in-progress": 1, "not-started": 2, complete: 3 };
    return [...filtered].sort((a, b) => {
      const sa = order[window.itemStatus(a)];
      const sb = order[window.itemStatus(b)];
      if (sa !== sb) return sa - sb;
      return b.progress - a.progress;
    });
  }, [filtered]);

  const visible = useMemoF(
    () => (hideDone ? sorted.filter((x) => window.itemStatus(x) !== "complete") : sorted),
    [sorted, hideDone]
  );

  // Keyboard
  useEffectF(() => {
    function handler(e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
      if (!visible.length) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedRowIdx((i) => Math.min(visible.length - 1, i + 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedRowIdx((i) => Math.max(0, i - 1));
      } else if (e.key === " " || e.key === "Enter") {
        const item = visible[focusedRowIdx];
        if (!item) return;
        if (window.itemStatus(item) === "blocked") return;
        if (item.progress >= window.TOTAL_STEPS) return;
        e.preventDefault();
        actions.completeStep(item.notionId, item.progress, latency);
      } else if (e.key.toLowerCase() === "b") {
        const item = visible[focusedRowIdx];
        if (!item || item.progress >= window.TOTAL_STEPS) return;
        e.preventDefault();
        if (window.itemStatus(item) === "blocked") {
          actions.unblockStep(item.notionId, latency);
        } else {
          onOpenInspector(item.notionId, item.progress, "block");
        }
      } else if (e.key.toLowerCase() === "i") {
        const item = visible[focusedRowIdx];
        if (!item) return;
        e.preventDefault();
        onOpenInspector(item.notionId, item.progress, "details");
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, focusedRowIdx, actions, latency, onOpenInspector]);

  useEffectF(() => {
    if (visible.length > 0 && focusedRowIdx >= visible.length) {
      setFocusedRowIdx(visible.length - 1);
    }
  }, [visible.length, focusedRowIdx]);

  const counts = useMemoF(() => {
    const total = filtered.length;
    const blocked = filtered.filter((i) => window.itemStatus(i) === "blocked").length;
    const active = filtered.filter((i) => window.itemStatus(i) === "in-progress").length;
    const complete = filtered.filter((i) => window.itemStatus(i) === "complete").length;
    return { total, blocked, active, complete };
  }, [filtered]);

  return (
    <div className={`fc-wrap density-${density}`} ref={containerRef}>
      <div className="fc-summary">
        <div className="fc-sum-block">
          <div className="fc-sum-num">{counts.active}</div>
          <div className="fc-sum-lbl">Ready to advance</div>
        </div>
        <div className="fc-sum-block">
          <div className="fc-sum-num fc-sum-warn">{counts.blocked}</div>
          <div className="fc-sum-lbl">Blocked — needs attention</div>
        </div>
        <div className="fc-sum-block">
          <div className="fc-sum-num fc-sum-ok">{counts.complete}</div>
          <div className="fc-sum-lbl">Complete</div>
        </div>
        <div className="fc-sum-spacer"></div>
        <label className="fc-toggle">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
          />
          <span>Hide completed</span>
        </label>
      </div>

      <div className="fc-list">
        {visible.map((item, i) => (
          <FocusRow
            key={item.notionId}
            item={item}
            pending={pending}
            actions={actions}
            latency={latency}
            isFocused={i === focusedRowIdx}
            onFocus={() => setFocusedRowIdx(i)}
            onOpenInspector={onOpenInspector}
          />
        ))}
        {visible.length === 0 && (
          <div className="fc-empty">
            {hideDone ? "Everything is complete or hidden." : "No items match filters."}
          </div>
        )}
      </div>

      <div className="fc-foot">
        <span className="mx-shortcut"><kbd>↑↓</kbd>navigate</span>
        <span className="mx-shortcut"><kbd>Space</kbd>mark done</span>
        <span className="mx-shortcut"><kbd>B</kbd>block / unblock</span>
        <span className="mx-shortcut"><kbd>I</kbd>inspect / properties</span>
      </div>
    </div>
  );
}

function FocusRow({ item, pending, actions, latency, isFocused, onFocus, onOpenInspector }) {
  const status = window.itemStatus(item);
  const bc = window.BIC_COLORS[item.bic] || { bg: "#1f2937", fg: "#9ca3af" };
  const pri = window.PRIORITY_COLORS[item.priority] || "#888780";
  const pct = window.itemPct(item);
  const isBlocked = status === "blocked";
  const isComplete = status === "complete";
  const isNotStarted = status === "not-started";
  const stepIdx = item.progress;
  const step = window.STEPS[stepIdx];
  const phase = window.PHASES.find((p) => p.steps.includes(stepIdx));
  const propKeys = window.STEP_PROPS[stepIdx];
  const hasUnfilled = propKeys && propKeys.some((p) => !item.props[p.key]);
  const cellPending = pending[`${item.notionId}:${stepIdx}`];

  return (
    <div
      className={[
        "fc-row",
        `fc-row-${status}`,
        isFocused ? "is-focused" : "",
      ].join(" ")}
      onClick={onFocus}
      tabIndex={0}
    >
      <div className="fc-row-left">
        <span className="mx-pri-dot" style={{ background: pri }}></span>
        <span className="fc-id">{item.id}</span>
        <div className="fc-name-block">
          <div className="fc-name">{item.name}</div>
          <div className="fc-meta">
            <span className="fc-project">{item.project}</span>
            <span className="fc-dot-sep">·</span>
            <span className="fc-progress-text">{stepIdx}/{window.TOTAL_STEPS} steps</span>
          </div>
        </div>
      </div>

      <div className="fc-row-mid">
        {isComplete ? (
          <div className="fc-step-meta">
            <span className="fc-phase fc-phase-done">COMPLETE</span>
            <div className="fc-step-name">All {window.TOTAL_STEPS} steps signed off</div>
          </div>
        ) : (
          <div className="fc-step-meta">
            <span className="fc-phase">{phase?.label || ""}</span>
            <div className="fc-step-name">
              <span className="fc-step-num">Step {stepIdx + 1}</span>
              <span>·</span>
              <span>{step.name}</span>
            </div>
            {isBlocked && (
              <div className="fc-blocker">
                <i className="ti ti-alert-triangle" aria-hidden="true"></i>
                <span>{item.blockerText}</span>
                <span className="fc-blocker-bic">→ {item.bic}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fc-row-right">
        <div className="fc-prog-mini">
          <div className="fc-prog-track">
            <div
              className="fc-prog-bar"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? "#1D9E75" : isBlocked ? "#D85A30" : "#378ADD",
              }}
            ></div>
          </div>
          <span className="fc-prog-pct">{pct}%</span>
        </div>

        <button
          className="fc-bic"
          style={{ background: bc.bg, color: bc.fg }}
          onClick={(e) => { e.stopPropagation(); onOpenInspector(item.notionId, stepIdx, "details"); }}
          title={`Ball in court: ${item.bic}`}
        >
          {item.bic}
        </button>

        {isComplete ? (
          <span className="fc-done-badge">
            <i className="ti ti-circle-check" aria-hidden="true"></i> Done
          </span>
        ) : isBlocked ? (
          <div className="fc-action-group">
            <button
              className="fc-btn fc-btn-warn"
              onClick={(e) => { e.stopPropagation(); onOpenInspector(item.notionId, stepIdx, "block"); }}
            >
              <i className="ti ti-pencil" aria-hidden="true"></i> Edit
            </button>
            <button
              className="fc-btn fc-btn-primary"
              onClick={(e) => { e.stopPropagation(); actions.unblockStep(item.notionId, latency); }}
            >
              <i className="ti ti-lock-open" aria-hidden="true"></i> Unblock
            </button>
          </div>
        ) : (
          <div className="fc-action-group">
            {hasUnfilled && (
              <button
                className="fc-btn fc-btn-prop"
                onClick={(e) => { e.stopPropagation(); onOpenInspector(item.notionId, stepIdx, "details"); }}
                title="Has Notion properties to fill"
              >
                <i className="ti ti-forms" aria-hidden="true"></i> Properties
              </button>
            )}
            <button
              className="fc-btn fc-btn-secondary"
              onClick={(e) => { e.stopPropagation(); onOpenInspector(item.notionId, stepIdx, "block"); }}
              title="Block this step (B)"
            >
              <i className="ti ti-alert-triangle" aria-hidden="true"></i>
            </button>
            <button
              className={`fc-btn fc-btn-primary fc-btn-done ${cellPending ? "is-syncing" : ""}`}
              onClick={(e) => { e.stopPropagation(); actions.completeStep(item.notionId, stepIdx, latency); }}
              disabled={cellPending}
            >
              {cellPending ? (
                <>
                  <span className="fc-spinner"></span>
                  Syncing
                </>
              ) : (
                <>
                  <i className="ti ti-circle-check" aria-hidden="true"></i>
                  {isNotStarted ? "Start" : "Done"} · {step.short}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

window.FocusView = FocusView;
