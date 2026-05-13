// Reports view — phase throughput, BIC load, blocker breakdown, recent activity.
// All driven from the live items state.

const { useMemo: useMemoR } = React;

function ReportsView({ items, density }) {
  const stats = useMemoR(() => {
    const total = items.length;
    const complete = items.filter((i) => window.itemStatus(i) === "complete").length;
    const blocked = items.filter((i) => window.itemStatus(i) === "blocked").length;
    const active = items.filter((i) => window.itemStatus(i) === "in-progress").length;
    const notStarted = items.filter((i) => window.itemStatus(i) === "not-started").length;
    const totalSteps = items.length * window.TOTAL_STEPS;
    const completedSteps = items.reduce((s, i) => s + Math.min(i.progress, window.TOTAL_STEPS), 0);

    // Steps per phase
    const phaseStats = window.PHASES.map((ph) => {
      const possible = items.length * ph.steps.length;
      const done = items.reduce((s, i) => {
        return s + ph.steps.filter((sx) => i.progress > sx).length;
      }, 0);
      return { label: ph.label, possible, done, pct: possible ? Math.round((done / possible) * 100) : 0 };
    });

    // BIC load
    const bicLoad = window.BIC_OPTIONS.map((bic) => {
      const own = items.filter((i) => i.bic === bic);
      const blocking = own.filter((i) => i.blockerStep !== null).length;
      return { bic, total: own.length, blocking };
    });

    // Project breakdown — derived dynamically from loaded items
    const uniqueProjects = [...new Set(items.map((i) => i.project))].sort();
    const projects = uniqueProjects.map((p) => {
      const own = items.filter((i) => i.project === p);
      const totalP = own.length;
      const completeP = own.filter((i) => window.itemStatus(i) === "complete").length;
      const blockedP = own.filter((i) => window.itemStatus(i) === "blocked").length;
      const stepsDone = own.reduce((s, i) => s + Math.min(i.progress, window.TOTAL_STEPS), 0);
      const stepsTotal = totalP * window.TOTAL_STEPS;
      return {
        name: p,
        total: totalP,
        complete: completeP,
        blocked: blockedP,
        pct: stepsTotal ? Math.round((stepsDone / stepsTotal) * 100) : 0,
      };
    });

    // Blocker reason breakdown
    const reasonCounts = {};
    items.filter((i) => i.blockerStep !== null).forEach((i) => {
      reasonCounts[i.blockerText] = (reasonCounts[i.blockerText] || 0) + 1;
    });
    const reasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);

    // Step-by-step where items are stuck
    const stepStuck = window.STEPS.map((_, idx) => {
      const stuck = items.filter((i) => i.progress === idx && i.blockerStep === null).length;
      const blocked = items.filter((i) => i.blockerStep === idx).length;
      return { idx, stuck, blocked };
    });

    return {
      total, complete, blocked, active, notStarted,
      totalSteps, completedSteps,
      phaseStats, bicLoad, projects, reasons, stepStuck,
    };
  }, [items]);

  const overallPct = stats.totalSteps ? Math.round((stats.completedSteps / stats.totalSteps) * 100) : 0;
  const maxStep = Math.max(...stats.stepStuck.map((s) => s.stuck + s.blocked), 1);

  return (
    <div className={`rp-wrap density-${density}`}>
      <div className="rp-grid">
        {/* Headline */}
        <section className="rp-card rp-headline">
          <div className="rp-card-title">PORTFOLIO PROGRESS</div>
          <div className="rp-headline-row">
            <div className="rp-headline-num">{overallPct}%</div>
            <div className="rp-headline-detail">
              <div className="rp-headline-frac">{stats.completedSteps} <span>/ {stats.totalSteps} steps</span></div>
              <div className="rp-headline-meta">
                {stats.complete} of {stats.total} items signed off
              </div>
            </div>
          </div>
          <div className="rp-stat-strip">
            <div className="rp-stat"><span className="rp-stat-num" style={{ color: "#378ADD" }}>{stats.active}</span><span className="rp-stat-lbl">Active</span></div>
            <div className="rp-stat"><span className="rp-stat-num" style={{ color: "#D85A30" }}>{stats.blocked}</span><span className="rp-stat-lbl">Blocked</span></div>
            <div className="rp-stat"><span className="rp-stat-num" style={{ color: "#1D9E75" }}>{stats.complete}</span><span className="rp-stat-lbl">Complete</span></div>
            <div className="rp-stat"><span className="rp-stat-num" style={{ color: "#6b7280" }}>{stats.notStarted}</span><span className="rp-stat-lbl">Not started</span></div>
          </div>
        </section>

        {/* Phase throughput */}
        <section className="rp-card">
          <div className="rp-card-title">PHASE THROUGHPUT</div>
          <div className="rp-phase-list">
            {stats.phaseStats.map((p) => (
              <div key={p.label} className="rp-phase-row">
                <div className="rp-phase-lbl">{p.label}</div>
                <div className="rp-phase-bar-wrap">
                  <div className="rp-phase-bar" style={{ width: `${p.pct}%` }}></div>
                </div>
                <div className="rp-phase-num">{p.done}<span>/{p.possible}</span></div>
              </div>
            ))}
          </div>
        </section>

        {/* Where items are stuck */}
        <section className="rp-card rp-card-wide">
          <div className="rp-card-title">WHERE ITEMS ARE STUCK · by step</div>
          <div className="rp-step-chart">
            {stats.stepStuck.map((s, i) => {
              const activeH = (s.stuck / maxStep) * 100;
              const blockedH = (s.blocked / maxStep) * 100;
              const step = window.STEPS[i];
              return (
                <div key={i} className="rp-step-col" title={`Step ${i + 1} — ${step.name}: ${s.stuck} active · ${s.blocked} blocked`}>
                  <div className="rp-step-counts">
                    <span className={`rp-step-count rp-step-count-active ${s.stuck ? "" : "is-zero"}`}>{s.stuck}</span>
                    <span className={`rp-step-count rp-step-count-blocked ${s.blocked ? "" : "is-zero"}`}>{s.blocked}</span>
                  </div>
                  <div className="rp-step-bars">
                    <div className="rp-step-bar-track">
                      <div className="rp-step-bar rp-step-bar-active" style={{ height: `${activeH}%` }}></div>
                    </div>
                    <div className="rp-step-bar-track">
                      <div className="rp-step-bar rp-step-bar-blocked" style={{ height: `${blockedH}%` }}></div>
                    </div>
                  </div>
                  <div className="rp-step-num">{i + 1}</div>
                  <div className="rp-step-name">{step.short}</div>
                </div>
              );
            })}
          </div>
          <div className="rp-step-legend">
            <span><span className="rp-key rp-key-active"></span>active here</span>
            <span><span className="rp-key rp-key-blocked"></span>blocked here</span>
          </div>
        </section>

        {/* BIC load */}
        <section className="rp-card">
          <div className="rp-card-title">BALL IN COURT · load</div>
          <div className="rp-bic-list">
            {stats.bicLoad.map((b) => {
              const c = window.BIC_COLORS[b.bic];
              return (
                <div key={b.bic} className="rp-bic-row">
                  <span className="rp-bic-name" style={{ background: c.bg, color: c.fg }}>{b.bic}</span>
                  <div className="rp-bic-bar-wrap">
                    <div
                      className="rp-bic-bar"
                      style={{ width: `${(b.total / Math.max(stats.total, 1)) * 100}%`, background: c.fg }}
                    ></div>
                  </div>
                  <span className="rp-bic-num">{b.total}</span>
                  {b.blocking > 0 && <span className="rp-bic-blocking">{b.blocking} ⚠</span>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Blocker reasons */}
        <section className="rp-card">
          <div className="rp-card-title">BLOCKER REASONS</div>
          {stats.reasons.length === 0 ? (
            <div className="rp-empty">No blockers — flow is clean.</div>
          ) : (
            <div className="rp-reasons">
              {stats.reasons.map(([r, n]) => (
                <div key={r} className="rp-reason-row">
                  <i className="ti ti-alert-triangle" aria-hidden="true"></i>
                  <span className="rp-reason-text">{r}</span>
                  <span className="rp-reason-num">{n}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Projects */}
        <section className="rp-card rp-card-wide">
          <div className="rp-card-title">PROJECTS</div>
          <div className="rp-proj-list">
            {stats.projects.map((p) => (
              <div key={p.name} className="rp-proj-row">
                <div className="rp-proj-head">
                  <div className="rp-proj-name">{p.name}</div>
                  <div className="rp-proj-stats">
                    <span>{p.total} items</span>
                    <span className="rp-dot">·</span>
                    <span style={{ color: "#1D9E75" }}>{p.complete} done</span>
                    {p.blocked > 0 && (
                      <>
                        <span className="rp-dot">·</span>
                        <span style={{ color: "#D85A30" }}>{p.blocked} blocked</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="rp-proj-bar-wrap">
                  <div className="rp-proj-bar" style={{ width: `${p.pct}%` }}></div>
                </div>
                <div className="rp-proj-pct">{p.pct}%</div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

window.ReportsView = ReportsView;
