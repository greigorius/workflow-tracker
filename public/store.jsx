// store.jsx — Central store with real Notion API sync.
// Optimistic UI: state updates locally immediately, then confirmed via API.
// On API error the local change is rolled back and a toast is shown.

const { useState, useCallback, useRef, useEffect } = React;

const BACKUP_KEY = "workflow_backup";

// ── API helper ────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Store ─────────────────────────────────────────────────────────────────────
function useWorkflowStore(initialItems) {
  const [items, setItems] = useState(initialItems || []);
  // Map: `${notionId}:${stepIdx|bic|prop:key}` -> "syncing" | "error"
  const [pending, setPending] = useState({});
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const [lastBackup, setLastBackup] = useState(() => {
    try {
      const b = localStorage.getItem(BACKUP_KEY);
      return b ? JSON.parse(b).savedAt : null;
    } catch { return null; }
  });
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const pushToast = useCallback((msg, kind = "info") => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const setSyncing = useCallback((cellKey) => {
    setPending((p) => ({ ...p, [cellKey]: "syncing" }));
  }, []);

  const clearSyncing = useCallback((cellKey) => {
    setPending((p) => {
      const { [cellKey]: _, ...rest } = p;
      return rest;
    });
  }, []);

  // Roll back an optimistic update by ID
  const rollback = useCallback((prevItems) => {
    setItems(prevItems);
  }, []);

  // ── completeStep ─────────────────────────────────────────────────────────
  const completeStep = useCallback(
    (itemId, idx) => {
      let notionId = null;
      let prev = null;

      setItems((items) => {
        const item = items.find((i) => i.notionId === itemId);
        if (!item || item.progress !== idx) return items;
        notionId = item.notionId;
        prev = items;
        return items.map((it) =>
          it.notionId === itemId
            ? { ...it, progress: idx + 1, subPhaseIdx: 0, blockerStep: null, blockerText: "" }
            : it
        );
      });

      if (!notionId) return;

      const cellKey = `${notionId}:${idx}`;
      setSyncing(cellKey);

      api("PATCH", `/api/items/${notionId}/advance`, { fromStep: idx })
        .then(() => {
          clearSyncing(cellKey);
          const stepName = window.STEPS[idx]?.short ?? `Step ${idx + 1}`;
          pushToast(`✓ ${itemId} · ${stepName}`, "ok");
        })
        .catch((err) => {
          clearSyncing(cellKey);
          if (prev) rollback(prev);
          pushToast(`✗ ${itemId} · ${err.message}`, "error");
        });
    },
    [setSyncing, clearSyncing, rollback, pushToast]
  );

  // ── undoStep ─────────────────────────────────────────────────────────────
  const undoStep = useCallback(
    (itemId, idx) => {
      let notionId = null;
      let prev = null;

      setItems((items) => {
        const item = items.find((i) => i.notionId === itemId);
        if (!item || item.progress !== idx + 1) return items;
        notionId = item.notionId;
        prev = items;
        return items.map((it) =>
          it.notionId === itemId ? { ...it, progress: idx, subPhaseIdx: 0 } : it
        );
      });

      if (!notionId) return;

      const cellKey = `${notionId}:${idx}:undo`;
      setSyncing(cellKey);

      api("PATCH", `/api/items/${notionId}/undo`, { fromStep: idx + 1 })
        .then(() => {
          clearSyncing(cellKey);
          pushToast(`↺ Undid ${itemId} · step ${idx + 1}`, "info");
        })
        .catch((err) => {
          clearSyncing(cellKey);
          if (prev) rollback(prev);
          pushToast(`✗ Undo failed · ${err.message}`, "error");
        });
    },
    [setSyncing, clearSyncing, rollback, pushToast]
  );

  // ── blockStep ────────────────────────────────────────────────────────────
  const blockStep = useCallback(
    (itemId, idx, reason) => {
      let notionId = null;
      let prev = null;

      setItems((items) => {
        const item = items.find((i) => i.notionId === itemId);
        if (!item) return items;
        notionId = item.notionId;
        prev = items;
        return items.map((it) =>
          it.notionId === itemId
            ? { ...it, blockerStep: idx, blockerText: reason || "Awaiting Instruction" }
            : it
        );
      });

      if (!notionId) return;

      const cellKey = `${notionId}:${idx}:block`;
      setSyncing(cellKey);

      api("PATCH", `/api/items/${notionId}/block`, { stepIdx: idx, reason })
        .then(() => {
          clearSyncing(cellKey);
          pushToast(`⚠ ${itemId} blocked · step ${idx + 1}`, "warn");
        })
        .catch((err) => {
          clearSyncing(cellKey);
          if (prev) rollback(prev);
          pushToast(`✗ Block failed · ${err.message}`, "error");
        });
    },
    [setSyncing, clearSyncing, rollback, pushToast]
  );

  // ── unblockStep ──────────────────────────────────────────────────────────
  const unblockStep = useCallback(
    (itemId) => {
      let notionId = null;
      let stepIdx = null;
      let prev = null;

      setItems((items) => {
        const item = items.find((i) => i.notionId === itemId);
        if (!item) return items;
        notionId = item.notionId;
        stepIdx  = item.blockerStep;
        prev = items;
        return items.map((it) =>
          it.notionId === itemId ? { ...it, blockerStep: null, blockerText: "" } : it
        );
      });

      if (!notionId) return;

      const cellKey = `${notionId}:unblock`;
      setSyncing(cellKey);

      api("PATCH", `/api/items/${notionId}/unblock`, { stepIdx })
        .then(() => {
          clearSyncing(cellKey);
          pushToast(`Unblocked ${itemId}`, "info");
        })
        .catch((err) => {
          clearSyncing(cellKey);
          if (prev) rollback(prev);
          pushToast(`✗ Unblock failed · ${err.message}`, "error");
        });
    },
    [setSyncing, clearSyncing, rollback, pushToast]
  );

  // ── setBIC ───────────────────────────────────────────────────────────────
  const setBIC = useCallback(
    (itemId, bic) => {
      let notionId = null;
      let prev = null;

      setItems((items) => {
        const item = items.find((i) => i.notionId === itemId);
        if (!item) return items;
        notionId = item.notionId;
        prev = items;
        return items.map((it) =>
          it.notionId === itemId ? { ...it, bic } : it
        );
      });

      if (!notionId) return;

      const cellKey = `${notionId}:bic`;
      setSyncing(cellKey);

      api("PATCH", `/api/items/${notionId}/bic`, { bic })
        .then(() => clearSyncing(cellKey))
        .catch((err) => {
          clearSyncing(cellKey);
          if (prev) rollback(prev);
          pushToast(`✗ BIC update failed · ${err.message}`, "error");
        });
    },
    [setSyncing, clearSyncing, rollback, pushToast]
  );

  // ── setProperty ─────────────────────────────────────────────────────────
  const setProperty = useCallback(
    (itemId, key, value) => {
      let notionId = null;
      let prev = null;

      setItems((items) => {
        const item = items.find((i) => i.notionId === itemId);
        if (!item) return items;
        notionId = item.notionId;
        prev = items;
        return items.map((it) =>
          it.notionId === itemId
            ? { ...it, props: { ...it.props, [key]: value } }
            : it
        );
      });

      if (!notionId) return;

      const cellKey = `${notionId}:prop:${key}`;
      setSyncing(cellKey);

      api("PATCH", `/api/items/${notionId}/property`, { key, value })
        .then(() => clearSyncing(cellKey))
        .catch((err) => {
          clearSyncing(cellKey);
          if (prev) rollback(prev);
          pushToast(`✗ Save failed · ${err.message}`, "error");
        });
    },
    [setSyncing, clearSyncing, rollback, pushToast]
  );

  // ── advanceSubPhase ──────────────────────────────────────────────────────
  const advanceSubPhase = useCallback(
    (itemId, stepIdx, subPhaseIdx) => {
      let notionId = null;
      let prev = null;
      const subPhases = window.STEPS[stepIdx]?.dmPhases || [];
      const isLast = subPhaseIdx >= subPhases.length - 1;

      setItems((items) => {
        const item = items.find((i) => i.notionId === itemId);
        if (!item || item.progress !== stepIdx) return items;
        notionId = item.notionId;
        prev = items;
        return items.map((it) => {
          if (it.notionId !== itemId) return it;
          if (isLast) {
            return { ...it, progress: stepIdx + 1, subPhaseIdx: 0, blockerStep: null, blockerText: "" };
          }
          return { ...it, subPhaseIdx: subPhaseIdx + 1 };
        });
      });

      if (!notionId) return;

      const cellKey = `${notionId}:${stepIdx}:sub`;
      setSyncing(cellKey);

      api("PATCH", `/api/items/${notionId}/subphase`, { stepIdx, subPhaseIdx })
        .then((data) => {
          clearSyncing(cellKey);
          if (data.advanced) {
            const stepName = window.STEPS[stepIdx]?.short ?? `Step ${stepIdx + 1}`;
            pushToast(`✓ ${itemId} · ${stepName}`, "ok");
          }
        })
        .catch((err) => {
          clearSyncing(cellKey);
          if (prev) rollback(prev);
          pushToast(`✗ ${itemId} · ${err.message}`, "error");
        });
    },
    [setSyncing, clearSyncing, rollback, pushToast]
  );

  const saveBackup = useCallback(() => {
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ items: itemsRef.current, savedAt }));
      setLastBackup(savedAt);
      pushToast("Backup saved", "ok");
    } catch {
      pushToast("✗ Backup failed · storage full?", "error");
    }
  }, [pushToast]);

  return {
    items,
    setItems,
    pending,
    toasts,
    lastBackup,
    saveBackup,
    actions: { completeStep, undoStep, blockStep, unblockStep, setBIC, setProperty, advanceSubPhase, pushToast },
  };
}

// ── Toast tray ────────────────────────────────────────────────────────────────
function ToastTray({ toasts }) {
  return (
    <div className="toast-tray" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

window.useWorkflowStore = useWorkflowStore;
window.ToastTray = ToastTray;
