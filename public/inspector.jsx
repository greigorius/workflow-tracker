// Inspector side panel — opens for blocking, unblocking, BIC change, and
// editing Notion properties for the current step. Used by both views.

const { useState: useStateI, useEffect: useEffectI, useMemo: useMemoI } = React;

function Inspector({ open, item, stepIdx, mode, onClose, actions, latency, pending }) {
  const [draftReason, setDraftReason] = useStateI("");
  const [draftBIC, setDraftBIC] = useStateI("");
  const [draftProps, setDraftProps] = useStateI({});

  useEffectI(() => {
    if (!item) return;
    setDraftReason(item.blockerText || window.BLOCKER_REASONS[0]);
    setDraftBIC(item.bic);
    setDraftProps({ ...item.props });
  }, [item?.notionId, mode, open]);

  const allProps = useMemoI(() => {
    if (!item) return [];
    const out = [];
    const seen = new Set();
    for (let i = 0; i <= Math.min(item.progress, 11); i++) {
      const ps = window.STEP_PROPS[i];
      if (ps) ps.forEach((p) => { if (!seen.has(p.key)) { seen.add(p.key); out.push({ ...p, stepIdx: i }); } });
    }
    if (stepIdx != null && stepIdx > (item?.progress ?? -1)) {
      const ps = window.STEP_PROPS[stepIdx];
      if (ps) ps.forEach((p) => { if (!seen.has(p.key)) { seen.add(p.key); out.push({ ...p, stepIdx }); } });
    }
    return out;
  }, [item, stepIdx]);

  if (!open || !item) return null;

  const step = window.STEPS[stepIdx] || window.STEPS[Math.min(item.progress, 11)];
  const phase = window.PHASES.find((p) => p.steps.includes(stepIdx ?? item.progress));
  const status = window.itemStatus(item);

  const handleSubmitBlock = () => {
    actions.blockStep(item.notionId, stepIdx ?? item.progress, draftReason, latency);
    onClose();
  };
  const handleUpdateBIC = (val) => {
    setDraftBIC(val);
    actions.setBIC(item.notionId, val, latency);
  };
  const handleSetProp = (key, val) => {
    setDraftProps((p) => ({ ...p, [key]: val }));
    actions.setProperty(item.notionId, key, val, latency);
  };

  const bc = window.BIC_COLORS[item.bic] || { bg: "#1f2937", fg: "#9ca3af" };

  return (
    <div className="ins-overlay" onClick={onClose}>
      <aside className="ins-panel" onClick={(e) => e.stopPropagation()}>
        <header className="ins-head">
          <div className="ins-head-row">
            <span className="ins-id">{item.id}</span>
            <button className="ins-close" onClick={onClose} aria-label="Close">
              <i className="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
          <h3 className="ins-name">{item.name}</h3>
          <div className="ins-sub">{item.project}</div>
          <div className="ins-meta-row">
            <span className={`ins-status ins-status-${status}`}>
              {status === "complete" ? "Complete" : status === "blocked" ? "Blocked" : status === "in-progress" ? "In progress" : "Not started"}
            </span>
            <span className="ins-meta-dot">·</span>
            <span className="ins-meta-text">
              Step {Math.min(item.progress + 1, window.TOTAL_STEPS)} of {window.TOTAL_STEPS}
              {phase && <> · {phase.label}</>}
            </span>
          </div>
        </header>

        <div className="ins-body">
          {/* Block / unblock — always visible when item is not complete */}
          {status !== "complete" && (
            <section className="ins-section">
              <div className="ins-sec-title">
                <i className="ti ti-alert-triangle" aria-hidden="true" style={{ color: item.blockerStep !== null ? "#D85A30" : "currentColor" }}></i>
                {item.blockerStep !== null ? "Blocker" : "Block step"}
              </div>
              {item.blockerStep !== null && (
                <div className="ins-blocker-current">
                  <i className="ti ti-alert-triangle" aria-hidden="true"></i>
                  <div className="ins-blocker-detail">
                    <span className="ins-blocker-reason">{item.blockerText || "Blocked"}</span>
                    <span className="ins-blocker-step">Step {item.blockerStep + 1} · {window.STEPS[item.blockerStep]?.short}</span>
                  </div>
                  <button
                    className="ins-btn ins-btn-primary ins-btn-sm"
                    onClick={() => { actions.unblockStep(item.notionId, latency); onClose(); }}
                  >
                    <i className="ti ti-lock-open" aria-hidden="true"></i> Unblock
                  </button>
                </div>
              )}
              <div className="ins-field">
                <label className="ins-lbl">{item.blockerStep !== null ? "Change reason" : "Reason"}</label>
                <select
                  className="ins-input"
                  value={draftReason}
                  onChange={(e) => setDraftReason(e.target.value)}
                >
                  {window.BLOCKER_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="ins-actions">
                <button className="ins-btn ins-btn-warn" onClick={handleSubmitBlock}>
                  <i className="ti ti-alert-triangle" aria-hidden="true"></i>
                  {item.blockerStep !== null ? "Update blocker" : "Block step"}
                </button>
              </div>
            </section>
          )}

          {/* BIC */}
          <section className="ins-section">
            <div className="ins-sec-title">
              <i className="ti ti-user" aria-hidden="true"></i>
              Ball in court
            </div>
            <div className="ins-bic-grid">
              {window.BIC_OPTIONS.map((b) => {
                const c = window.BIC_COLORS[b];
                const sel = draftBIC === b;
                return (
                  <button
                    key={b}
                    className={`ins-bic-pill ${sel ? "is-sel" : ""}`}
                    style={sel ? { background: c.bg, color: c.fg, borderColor: c.fg } : {}}
                    onClick={() => handleUpdateBIC(b)}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Properties / automations */}
          <section className="ins-section">
            <div className="ins-sec-title">
              <i className="ti ti-forms" aria-hidden="true"></i>
              Notion properties
              <span className="ins-hint">Saved fields trigger Notion automations</span>
            </div>
            {allProps.length === 0 ? (
              <div className="ins-prop-empty">
                No automations on the steps reached so far. Properties appear here as they unlock.
              </div>
            ) : (
              <div className="ins-prop-list">
                {allProps.map((p) => {
                  const cellPending = pending[`${item.notionId}:prop:${p.key}`];
                  const fromStep = window.STEPS[p.stepIdx];
                  return (
                    <div key={p.key} className="ins-field">
                      <label className="ins-lbl ins-lbl-prop">
                        <span>{p.label}</span>
                        <span className="ins-prop-from">step {p.stepIdx + 1} · {fromStep.short}</span>
                      </label>
                      <div className="ins-prop-row">
                        <input
                          type={p.type}
                          className="ins-input"
                          placeholder={p.placeholder || ""}
                          value={draftProps[p.key] || ""}
                          onChange={(e) => handleSetProp(p.key, e.target.value)}
                        />
                        {cellPending && <span className="ins-sync-pip"></span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Step list mini */}
          <section className="ins-section">
            <div className="ins-sec-title">
              <i className="ti ti-list-check" aria-hidden="true"></i>
              Progress
            </div>
            <ol className="ins-steps">
              {window.STEPS.map((s, i) => {
                const cs = window.cellStatus(item, i);
                return (
                  <li key={i} className={`ins-step ins-step-${cs}`}>
                    <span className="ins-step-num">{i + 1}</span>
                    <span className="ins-step-name">{s.name}</span>
                    <span className="ins-step-tag">
                      {cs === "done" && <i className="ti ti-check" aria-hidden="true"></i>}
                      {cs === "blocked" && (
                        <span className="ins-step-blocker-row">
                          <i className="ti ti-alert-triangle" aria-hidden="true"></i>
                          {item.blockerText && <span className="ins-step-blocker-txt">{item.blockerText}</span>}
                          <button className="ins-step-unblock-btn" onClick={() => { actions.unblockStep(item.notionId, latency); }} title="Unblock">
                            <i className="ti ti-lock-open" aria-hidden="true"></i>
                          </button>
                        </span>
                      )}
                      {cs === "active" && "active"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}

window.Inspector = Inspector;
