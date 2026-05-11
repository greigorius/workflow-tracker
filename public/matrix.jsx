// Matrix grid view — items × 12 step columns. One click per cell.
// Cell states: locked / active / done / blocked. Hover for inspector,
// click active cell to complete, right-click or shift-click to block.

const { useState: useStateM, useMemo: useMemoM, useRef: useRefM, useEffect: useEffectM, useCallback: useCallbackM } = React;

function MatrixView({ items, pending, actions, latency, density, onOpenInspector, focusedCell, setFocusedCell }) {
  const gridRef = useRefM(null);
  const filtered = items;

  // Keyboard nav
  useEffectM(() => {
    function handler(e) {
      if (!focusedCell) return;
      const { itemId, idx } = focusedCell;
      const i = filtered.findIndex((x) => x.notionId === itemId);
      if (i < 0) return;
      const item = filtered[i];

      if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        let ni = i, nIdx = idx;
        if (e.key === "ArrowRight") nIdx = Math.min(window.TOTAL_STEPS - 1, idx + 1);
        if (e.key === "ArrowLeft") nIdx = Math.max(0, idx - 1);
        if (e.key === "ArrowDown") ni = Math.min(filtered.length - 1, i + 1);
        if (e.key === "ArrowUp") ni = Math.max(0, i - 1);
        setFocusedCell({ itemId: filtered[ni].notionId, idx: nIdx });
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (idx === item.progress && item.blockerStep === null) {
          actions.completeStep(item.notionId, idx, latency);
          setFocusedCell({ itemId: item.notionId, idx: Math.min(window.TOTAL_STEPS - 1, idx + 1) });
        } else if (idx === item.progress - 1) {
          actions.undoStep(item.notionId, idx, latency);
        }
        return;
      }
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (idx === item.progress) onOpenInspector(item.notionId, idx, "block");
        return;
      }
      if (e.key.toLowerCase() === "u") {
        e.preventDefault();
        if (item.blockerStep !== null) actions.unblockStep(item.notionId, latency);
        return;
      }
      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        onOpenInspector(item.notionId, idx, "details");
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusedCell, filtered, actions, latency, onOpenInspector, setFocusedCell]);

  return (
    <div className={`mx-wrap density-${density}`} ref={gridRef}>
      <div className="mx-scroll">
        <table className="mx-grid" role="grid">
          <thead>
            <tr className="mx-phase-row">
              <th className="mx-corner" colSpan={3}></th>
              {window.PHASES.map((ph) => (
                <th
                  key={ph.label}
                  colSpan={ph.steps.length}
                  className="mx-phase-cell"
                >
                  <span className="mx-phase-label">{ph.label}</span>
                </th>
              ))}
              <th className="mx-end-col"></th>
            </tr>
            <tr className="mx-step-row">
              <th className="mx-th-id">ID</th>
              <th className="mx-th-name">Item</th>
              <th className="mx-th-bic">BIC</th>
              {window.STEPS.map((s, i) => (
                <th key={i} className="mx-step-th" title={s.name}>
                  <div className="mx-step-num">{i + 1}</div>
                  <div className="mx-step-short">{s.short}</div>
                </th>
              ))}
              <th className="mx-th-progress">Progress</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <MatrixRow
                key={item.notionId}
                item={item}
                pending={pending}
                actions={actions}
                latency={latency}
                onOpenInspector={onOpenInspector}
                focusedCell={focusedCell}
                setFocusedCell={setFocusedCell}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={18} className="mx-empty">No items match filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mx-legend">
        <span className="mx-key"><span className="mx-key-cell st-locked"></span>Waiting</span>
        <span className="mx-key"><span className="mx-key-cell st-active"></span>Active</span>
        <span className="mx-key"><span className="mx-key-cell st-done"></span>Done</span>
        <span className="mx-key"><span className="mx-key-cell st-blocked"></span>Blocked</span>
        <span className="mx-key-spacer"></span>
        <span className="mx-shortcut"><kbd>↹</kbd>navigate</span>
        <span className="mx-shortcut"><kbd>Space</kbd>complete</span>
        <span className="mx-shortcut"><kbd>B</kbd>block</span>
        <span className="mx-shortcut"><kbd>U</kbd>unblock</span>
        <span className="mx-shortcut"><kbd>I</kbd>inspect</span>
      </div>
    </div>
  );
}

function MatrixRow({ item, pending, actions, latency, onOpenInspector, focusedCell, setFocusedCell }) {
  const bc = window.BIC_COLORS[item.bic] || { bg: "#1f2937", fg: "#9ca3af" };
  const pri = window.PRIORITY_COLORS[item.priority] || "#888780";
  const pct = window.itemPct(item);
  const itemStat = window.itemStatus(item);

  return (
    <tr className={`mx-row mx-row-${itemStat}`}>
      <td className="mx-cell-id">
        <span className="mx-pri-dot" style={{ background: pri }} title={item.priority}></span>
        <span className="mx-id-text">{item.id}</span>
      </td>
      <td className="mx-cell-name">
        <button className="mx-name-btn" onClick={() => onOpenInspector(item.notionId, item.progress, "details")}>
          {item.name}
        </button>
        <span className="mx-project-tag">{item.project.split("—")[0].trim()}</span>
      </td>
      <td className="mx-cell-bic">
        <button
          className="mx-bic-chip"
          style={{ background: bc.bg, color: bc.fg }}
          onClick={() => onOpenInspector(item.notionId, item.progress, "details")}
          title={`Ball in court: ${item.bic}`}
        >
          {item.bic}
        </button>
      </td>
      {window.STEPS.map((_, idx) => (
        <MatrixCell
          key={idx}
          item={item}
          idx={idx}
          pending={pending[`${item.notionId}:${idx}`]}
          actions={actions}
          latency={latency}
          onOpenInspector={onOpenInspector}
          focused={focusedCell && focusedCell.itemId === item.notionId && focusedCell.idx === idx}
          setFocusedCell={setFocusedCell}
        />
      ))}
      <td className="mx-cell-progress">
        <div className="mx-prog-track">
          <div
            className="mx-prog-bar"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? "#1D9E75" : item.blockerStep !== null ? "#D85A30" : "#378ADD",
            }}
          ></div>
        </div>
        <span className="mx-prog-pct">{pct}%</span>
      </td>
    </tr>
  );
}

function MatrixCell({ item, idx, pending, actions, latency, onOpenInspector, focused, setFocusedCell }) {
  const status = window.cellStatus(item, idx);
  const isActive = status === "active";
  const isDone = status === "done";
  const isBlocked = status === "blocked";
  const isLocked = status === "locked";

  const handleClick = (e) => {
    setFocusedCell({ itemId: item.notionId, idx });
    if (isActive) {
      actions.completeStep(item.notionId, idx, latency);
    } else if (isDone && idx === item.progress - 1) {
      actions.undoStep(item.notionId, idx, latency);
    } else if (isBlocked) {
      onOpenInspector(item.notionId, idx, "block");
    }
  };

  const handleContext = (e) => {
    e.preventDefault();
    setFocusedCell({ itemId: item.notionId, idx });
    if (isActive) {
      onOpenInspector(item.notionId, idx, "block");
    }
  };

  const handleAux = (e) => {
    // shift-click on active cell -> open block popover
    if (e.shiftKey && isActive) {
      e.preventDefault();
      onOpenInspector(item.notionId, idx, "block");
    }
  };

  const propKeys = window.STEP_PROPS[idx];
  const hasProps = propKeys && propKeys.some((p) => item.props[p.key]);
  const needsProps = isActive && propKeys;

  return (
    <td
      className={[
        "mx-cell",
        `st-${status}`,
        focused ? "is-focused" : "",
        pending ? "is-syncing" : "",
      ].join(" ")}
      onClick={handleClick}
      onContextMenu={handleContext}
      onMouseDown={handleAux}
      tabIndex={isActive || isBlocked ? 0 : -1}
      role="gridcell"
      aria-label={`${item.id} step ${idx + 1} ${window.STEPS[idx].name} — ${status}`}
    >
      <div className="mx-cell-inner">
        {isDone && <i className="ti ti-check mx-cell-icon" aria-hidden="true"></i>}
        {isBlocked && <i className="ti ti-alert-triangle mx-cell-icon" aria-hidden="true"></i>}
        {isActive && <span className="mx-active-pulse"></span>}
        {isLocked && <span className="mx-locked-dot"></span>}
        {hasProps && !isActive && <span className="mx-prop-pip" title="Properties saved"></span>}
        {needsProps && <span className="mx-prop-pip mx-prop-pip-active" title="Has properties to fill"></span>}
        {pending && <span className="mx-sync-dot" title="Syncing to Notion…"></span>}
      </div>
    </td>
  );
}

window.MatrixView = MatrixView;
