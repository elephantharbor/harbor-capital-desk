/* Harbor Capital operating desk — read-only SPA (harbor-dashboard-snapshot-v1.1) */
(function () {
  "use strict";

  let SNAP = null;
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");

  const GLOSSARY = {
    C: "Starting bankroll — the risk-math base (not necessarily current account value)",
    DD: "Drawdown — decline from peak equity",
    my_p: "Harbor probability — our locked forecast probability",
    OOS: "Out-of-sample — tested on data held out from fitting",
    "RT bps": "Round-trip cost in basis points (buy + sell friction)",
    Falsify: "When we abandon — pre-committed kill condition",
    "mid-promote": "Eligible for further consideration (tight clean book)",
    "mid-promote eligible": "Eligible for further consideration (tight clean book)",
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tip(label, key) {
    const t = GLOSSARY[key] || GLOSSARY[label] || "";
    if (!t) return esc(label);
    return `<span class="tip" title="${esc(t)}">${esc(label)}</span>`;
  }

  /** Format a number (or numeric string) as user-facing USD: $200.00 — never invent values. */
  function formatUsd(n) {
    if (n == null || n === "" || n === "—" || n === "N/A") return null;
    let raw = n;
    if (typeof raw === "string") {
      raw = raw.trim().replace(/^[+$]/, "").replace(/,/g, "");
      if (raw === "" || raw === "—" || raw === "N/A") return null;
    }
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(num)) return null;
    const sign = num < 0 ? "-" : "";
    return sign + "$" + Math.abs(num).toFixed(2);
  }

  /** Polish snapshot display strings: 210.0 → $210.00; keep %; rewrite $N inside mixed strings. */
  function polishMoneyDisplay(display, value) {
    if (display == null || display === "" || display === "N/A") {
      if (value == null || value === undefined) return "N/A";
      return formatUsd(value) || String(value);
    }
    const d = String(display).trim();
    if (d === "N/A" || d === "—") return d;
    // Pure percent (e.g. trading return 0.0%)
    if (/^-?\d+(\.\d+)?%$/.test(d)) {
      const num = Number(d.replace("%", ""));
      return Number.isFinite(num) ? num.toFixed(2) + "%" : d;
    }
    // Mixed utilization-style: 0% ($0 of $20 exp book)
    if (/%/.test(d) && /\$/.test(d)) {
      return d.replace(/\$(\d+(?:\.\d+)?)/g, (_, n) => formatUsd(Number(n)) || "$" + n);
    }
    // Already $-prefixed single amount
    if (/^\$?-?\d+(\.\d+)?$/.test(d.replace(/,/g, ""))) {
      return formatUsd(d) || d;
    }
    // Plain number from snapshot display/value (210.0, 0)
    if (/^-?\d+(\.\d+)?$/.test(d)) {
      return formatUsd(Number(d)) || d;
    }
    if (value != null && value !== undefined && Number.isFinite(Number(value)) && !/%/.test(d) && !/[A-Za-z]/.test(d)) {
      return formatUsd(Number(value)) || d;
    }
    return d;
  }

  /** Money / labeled values — never invent numbers. */
  function moneyHtml(m) {
    if (m == null || m === "" || m === "N/A") {
      return `<span class="dim">N/A</span> <span class="badge badge-na">N/A</span>`;
    }
    if (typeof m === "object") {
      if (m.value == null || m.value === undefined) {
        return `<span class="dim">N/A</span> <span class="badge badge-na">N/A</span>`;
      }
      const display = polishMoneyDisplay(m.display, m.value);
      if (display === "N/A") {
        return `<span class="dim">N/A</span> <span class="badge badge-na">N/A</span>`;
      }
      const lbl = String(m.label || "PAPER").toUpperCase();
      return `<span>${esc(display)}</span> ${labelBadge(lbl)}`;
    }
    return `<span>${esc(polishMoneyDisplay(m, typeof m === "number" ? m : null))}</span>`;
  }

  function labelBadge(label) {
    const lbl = String(label || "N/A").toUpperCase();
    let cls = "badge-na";
    if (lbl === "PAPER") cls = "badge-paper";
    else if (lbl === "SHADOW") cls = "badge-shadow";
    else if (lbl === "LIVE") cls = "badge-live";
    else if (lbl === "BACKTEST") cls = "badge-backtest";
    return `<span class="badge ${cls}">${esc(lbl)}</span>`;
  }

  function statusBadge(st) {
    const raw = String(st || "unknown");
    const s = raw.toLowerCase();
    let cls = "badge-na";
    if (s === "shadow") cls = "badge-shadow";
    else if (s === "live" || s === "authorized" || s === "ready" || s.startsWith("ready")) cls = "badge-live";
    else if (s === "paper") cls = "badge-paper";
    else if (s === "backtest") cls = "badge-backtest";
    else if (s.includes("reject") || s.includes("kill")) cls = "badge-rejected";
    else if (s.includes("paus") || s.includes("defer") || s.includes("not_started") || s.includes("not started"))
      cls = "badge-paused";
    else if (s === "idea" || s === "researching") cls = "badge-idea";
    else if (s.includes("open") || s.includes("blocked") || s.includes("trial") || s.includes("skip") || s.includes("progress"))
      cls = "badge-open";
    else if (s.includes("standing") || s.includes("not requested") || s.includes("cleared")) cls = "badge-standing";
    else if (s === "locked") cls = "badge-paper";
    return `<span class="badge ${cls}">${esc(raw)}</span>`;
  }

  function gateBadge(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes("cleared") || s.includes("standing") || s === "not requested")
      return `<span class="badge badge-standing">${esc(status)}</span>`;
    if (
      s.includes("open") ||
      s.includes("blocked") ||
      s.includes("trial") ||
      s.includes("skipped") ||
      s.includes("deferred") ||
      s.includes("progress")
    )
      return `<span class="badge badge-open">${esc(status)}</span>`;
    return `<span class="badge badge-na">${esc(status)}</span>`;
  }

  function emptyState(title, detail) {
    return `<div class="empty"><strong>${esc(title)}</strong><span>${esc(detail || "")}</span></div>`;
  }

  function freshnessStrip() {
    const meta = SNAP.meta || {};
    const gen = SNAP.generated_at_ct || meta.generated_at_ct || "—";
    const topRec = SNAP.last_reconciled_ibkr_ct;
    const rec = topRec != null && topRec !== ""
      ? topRec
      : meta.last_reconciled_ibkr_ct != null && meta.last_reconciled_ibkr_ct !== ""
        ? meta.last_reconciled_ibkr_ct
        : null;
    const portal = meta.confirmed_ct || SNAP.portfolio?.book_timestamp_ct || null;
    if (rec) {
      return `<div class="freshness muted">Last reconciled with IBKR: <strong>${esc(rec)}</strong> · Dashboard generated: <strong>${esc(gen)}</strong></div>`;
    }
    const portalBit = portal
      ? ` Last known Portal confirm date: <strong>${esc(portal)}</strong>.`
      : "";
    // Non-alarming: missing stamp ≠ invented numbers
    return `<div class="callout info reconcile-banner" role="status">
      <strong>Dashboard generated:</strong> ${esc(gen)}.
      <strong>Last reconciled with IBKR:</strong> not yet this session.${portalBit}
      Desk figures below are from the snapshot / last known book notes; the brokerage reconcile stamp is simply missing for this session.
    </div>`;
  }

  function sleeveBadgeCaption() {
    return `<p class="muted sleeve-caption">Experimental sleeve: small live tests within fixed dollar limits; most capital stays in cash/reserve. Badges (PAPER / SHADOW / LIVE) describe strategy stage, not whether the brokerage account is live.</p>`;
  }

  /** Map Pike operating_status booleans → plain-English badges (never "live blocked"). */
  function opStatusParts() {
    const os = SNAP.operating_status || {};
    const notes = os.notes || {};
    const liveOn = os.live_trading === true || (os.live_trading && os.live_trading.status);
    const autoOn = os.automated_execution === true;
    const wdOn = os.withdrawal === true;

    let liveStatus, liveDetail;
    if (typeof os.live_trading === "object" && os.live_trading) {
      liveStatus = os.live_trading.status || (liveOn ? "Authorized" : "Blocked");
      liveDetail = os.live_trading.detail || notes.live_trading || "";
    } else {
      liveStatus = liveOn ? "Authorized" : "Not authorized";
      liveDetail = notes.live_trading || "";
    }

    let autoStatus, autoDetail;
    if (typeof os.automated_execution === "object" && os.automated_execution) {
      autoStatus = os.automated_execution.status || "—";
      autoDetail = os.automated_execution.detail || notes.automated_execution || "";
    } else if (autoOn) {
      autoStatus = "Ready";
      autoDetail = notes.automated_execution || "Automated path available";
    } else if (liveOn) {
      // live authorized but agents do not auto-transmit — Holt-gated
      autoStatus = "Ready — Holt-gated";
      autoDetail =
        notes.automated_execution ||
        "Gateway/API usable; Holt alone transmits (dry_run default for agents). Not a live-trading block.";
    } else {
      autoStatus = "Setup in progress";
      autoDetail = notes.automated_execution || "Await live auth + Gateway";
    }

    let wdStatus, wdDetail;
    if (typeof os.withdrawal === "object" && os.withdrawal) {
      wdStatus = os.withdrawal.status || "Standing human gate";
      wdDetail = os.withdrawal.detail || notes.withdrawal || "";
    } else {
      wdStatus = wdOn ? "Allowed" : "Standing human gate";
      wdDetail = notes.withdrawal || "No agent withdrawal authority";
    }

    const cFmt = formatUsd(os.starting_c ?? SNAP.portfolio?.starting_c) || "—";
    const summary =
      os.summary ||
      (liveOn
        ? `Looking at a funded LIVE IBKR book (starting bankroll C=${cFmt}). Live trading authorized within sleeve; net trading P&L from fills only. Funding excess is reserve, not performance.`
        : "Paper/research desk — live trading not authorized.");

    return {
      summary,
      liveStatus,
      liveDetail,
      autoStatus,
      autoDetail,
      wdStatus,
      wdDetail,
      action: os.action_needed || "None flagged",
      label: os.label || SNAP.mode || "LIVE",
    };
  }

  function forecastIndex() {
    const byId = new Map();
    for (const f of SNAP.forecasts?.active || []) byId.set(f.forecast_id, f);
    return byId;
  }

  function forecastsInBucket(bucketKey) {
    const ids = SNAP.forecasts?.buckets?.[bucketKey]?.ids || [];
    const byId = forecastIndex();
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  function buildActivityItems() {
    const act = SNAP.activity || {};
    if (Array.isArray(act.events) && act.events.length) {
      return act.events.map((e) => ({
        ts: e.ts || "",
        kind: e.kind || "event",
        title: e.title || "",
        summary: e.summary || "",
      }));
    }
    const items = [];
    for (const f of act.recent_forecast_locks || []) {
      items.push({
        ts: f.timestamp_ct || "",
        kind: "forecast",
        title: f.forecast_id || "",
        summary: `${f.status || ""} · ${f.event || ""}`,
      });
    }
    for (const s of act.strategy_updated_ct_tops || []) {
      items.push({
        ts: s.updated_ct || "",
        kind: "strategy",
        title: s.strategy_id || "",
        summary: `${s.status || ""} · ${s.name || ""}`,
      });
    }
    items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    return items;
  }

  function strategiesGrouped() {
    if (Array.isArray(SNAP.strategies?.grouped) && SNAP.strategies.grouped.length) {
      return SNAP.strategies.grouped;
    }
    const items = SNAP.strategies?.items || [];
    const order = ["shadow", "researching", "idea", "paused", "deferred", "rejected", "killed", "live"];
    const map = new Map();
    for (const s of items) {
      const st = String(s.status || "unknown").toLowerCase();
      if (!map.has(st)) map.set(st, []);
      map.get(st).push(s);
    }
    const keys = [
      ...order.filter((k) => map.has(k)),
      ...[...map.keys()].filter((k) => !order.includes(k)).sort(),
    ];
    return keys.map((status) => ({ status, count: map.get(status).length, items: map.get(status) }));
  }

  function edgeVerdict(fc) {
    const n = Number(fc?.brier?.n_resolved_clean ?? fc?.counts?.resolved_clean ?? 0);
    if (n < 5) return { label: "Insufficient", cls: "badge-open", why: `Only ${n} resolved clean forecasts (need ≥5).` };
    const clean = fc?.brier?.clean;
    if (clean == null || clean.value == null) return { label: "Insufficient", cls: "badge-open", why: "No scored clean Brier yet." };
    return { label: "Pending score", cls: "badge-na", why: "Sample may support a claim once Brier is computed — do not mix contaminated." };
  }

  /* ---------- views ---------- */

  function viewOverview() {
    const p = SNAP.portfolio || {};
    const risk = SNAP.risk || {};
    const hg = SNAP.human_gates || {};
    const health = SNAP.system_health || {};
    const fc = SNAP.forecasts || {};
    const counts = fc.counts || {};
    const meta = SNAP.meta || {};
    const via = SNAP.viability || SNAP.viability_period || {};
    const activity = buildActivityItems();
    const op = opStatusParts();

    const av = p.account_value_money || { display: "N/A", label: "PAPER", value: null };
    const startC = p.starting_capital || { display: String(p.starting_c ?? "N/A"), label: av.label };

    const actHtml = activity
      .slice(0, 10)
      .map(
        (a) =>
          `<li><span class="ts">${esc(a.ts)}</span> <span class="kind">${esc(a.kind)}</span>
           <strong>${esc(a.title)}</strong><br/><span class="muted">${esc(a.summary)}</span></li>`
      )
      .join("");

    const remaining = hg.remaining_gates || (hg.gates || []).filter((g) => {
      const st = String(g.status || "").toLowerCase();
      return !st.includes("cleared");
    });
    const gatesRows = remaining
      .map(
        (g) =>
          `<tr>
            <td>${esc(g.n ?? g.num)}</td>
            <td>${esc(g.gate)}</td>
            <td>${esc(g.owner)}</td>
            <td>${gateBadge(g.status)}</td>
            <td class="muted">${esc(g.blocks)}</td>
          </tr>`
      )
      .join("");

    const edge = edgeVerdict(fc);
    const midN = counts.mid_promote_eligible ?? fc.buckets?.mid_promote?.count ?? 0;
    const resolvedClean = counts.resolved_clean ?? fc.brier?.n_resolved_clean ?? 0;
    const viaStatus = via.status || (via.started ? "IN_PROGRESS" : "NOT_STARTED");
    const viaNote = via.note || "";

    return `
      <div class="stack">
        <div class="card status-panel">
          <h2>Status — what you are looking at</h2>
          ${freshnessStrip()}
          <p class="plain">${esc(op.summary || p.note || "")}</p>
          <div class="status-grid">
            <div class="status-cell">
              <div class="k">Live trading</div>
              <div class="v">${statusBadge(op.liveStatus)}</div>
              <div class="d muted">${esc(op.liveDetail)}</div>
            </div>
            <div class="status-cell">
              <div class="k">Automated execution</div>
              <div class="v">${statusBadge(op.autoStatus)}</div>
              <div class="d muted">${esc(op.autoDetail)}</div>
            </div>
            <div class="status-cell">
              <div class="k">Withdrawals</div>
              <div class="v">${statusBadge(op.wdStatus)}</div>
              <div class="d muted">${esc(op.wdDetail)}</div>
            </div>
            <div class="status-cell">
              <div class="k">30-day viability</div>
              <div class="v">${statusBadge(viaStatus)}</div>
              <div class="d muted">${esc(viaNote)}</div>
            </div>
          </div>
          <div class="callout info"><strong>Action needed:</strong> ${esc(op.action)}</div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <h2>Money</h2>
            <div class="hero-value">${esc(polishMoneyDisplay(av.display, av.value))} ${labelBadge(av.label || "LIVE")}</div>
            <p class="hero-note">Account value · ${tip("Starting bankroll (C)", "C")}: ${moneyHtml(startC)}</p>
            ${sleeveBadgeCaption()}
            ${
              p.funding_excess && p.funding_excess.value
                ? `<p class="muted" style="margin:6px 0 0">${esc(p.funding_excess_note || "Funding excess is reserve, not performance.")}</p>`
                : ""
            }
            <div class="kpi-row" style="grid-template-columns:repeat(2,1fr);margin-top:12px">
              <div class="kpi"><div class="label">Net trading P&amp;L</div><div class="val">${moneyHtml(p.net_pnl)}</div></div>
              <div class="kpi"><div class="label">Trading return</div><div class="val">${moneyHtml(p.total_return_pct)}</div></div>
              <div class="kpi"><div class="label">Deployed</div><div class="val">${moneyHtml(p.deployed)}</div></div>
              <div class="kpi"><div class="label">Cash / reserve</div><div class="val">${moneyHtml(p.cash_reserve)}</div></div>
            </div>
          </div>
          <div class="card">
            <h2>Risk now</h2>
            <div class="strip">
              <div class="item"><span class="k">Positions</span><span class="v">None (100% cash)</span></div>
              <div class="item"><span class="k">Utilization</span><span class="v">${moneyHtml(risk.utilization)}</span></div>
              <div class="item"><span class="k">${tip("Drawdown", "DD")}</span><span class="v">${moneyHtml(risk.current_dd)}</span></div>
            </div>
            <p class="muted" style="margin:8px 0 0">Exp book cap ≤$20 · Reserve floor ≥$100 · ${tip("DD", "DD")} gates 12% / 18% / 25% of ${tip("C", "C")}</p>
            <p class="dim" style="margin:4px 0 0">${esc(risk.note || "")}</p>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <h2>Activity</h2>
            <p class="dim" style="margin:0 0 6px">${esc(SNAP.activity?.note || "From journal / decisions — not chat")}</p>
            <ul class="activity">${actHtml || "<li class='muted'>No activity logged</li>"}</ul>
          </div>
          <div class="card">
            <h2>Learning / edge</h2>
            <div class="kpi-row" style="grid-template-columns:repeat(2,1fr)">
              <div class="kpi"><div class="label">Edge evidence</div><div class="val">${statusBadge(edge.label)}</div></div>
              <div class="kpi"><div class="label">Resolved clean</div><div class="val">${esc(resolvedClean)}</div></div>
              <div class="kpi"><div class="label">${tip("Mid-promote eligible", "mid-promote")}</div><div class="val">${esc(midN)}</div></div>
              <div class="kpi"><div class="label">Lessons</div><div class="val">${esc(SNAP.lessons?.count ?? "—")}</div></div>
            </div>
            <p class="muted">${esc(edge.why)}</p>
            <p class="dim">Independent (clean) locks vs market-informed (contaminated) are kept separate — never mixed for edge claims.</p>
          </div>
        </div>

        <div class="card">
          <h2>Remaining human gates <span class="muted">(not a live halt)</span></h2>
          <p class="muted">${esc(hg.note || "")}</p>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>#</th><th>Gate</th><th>Owner</th><th>Status</th><th>Blocks</th></tr></thead>
            <tbody>${gatesRows || `<tr><td colspan="5" class="muted">No remaining gates listed</td></tr>`}</tbody>
          </table></div>
          <p class="dim" style="margin-top:6px">Source: ${esc(hg.source || "")}</p>
        </div>

        <details class="doc-sec">
          <summary>Registry mix (secondary) <span class="path">status counts — not a health score</span></summary>
          <div style="padding:10px 12px">
            <div class="kpi-row" style="grid-template-columns:repeat(2,1fr)">
              <div class="kpi"><div class="label">Shadow</div><div class="val">${esc(health.shadow ?? "—")}</div></div>
              <div class="kpi"><div class="label">Rejected</div><div class="val">${esc(health.rejected ?? "—")}</div></div>
              <div class="kpi"><div class="label">Deferred / paused</div><div class="val">${esc(health.deferred ?? "—")}</div></div>
              <div class="kpi"><div class="label">Idea / researching</div><div class="val">${esc(health.proposed ?? "—")}</div></div>
            </div>
          </div>
        </details>

        ${
          (meta.warnings || []).length
            ? `<details class="doc-sec"><summary>Warnings / honesty notes</summary>
               <ul class="warn-list" style="padding:10px 28px">${(meta.warnings || []).map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
               </details>`
            : ""
        }
      </div>`;
  }

  function positionTable(rows) {
    if (!rows || !rows.length) {
      return emptyState(
        "No open positions",
        "100% cash / reserve. Empty blotter is expected until the first live fill — not broken."
      );
    }
    const cols = Object.keys(rows[0]);
    return `<div class="table-wrap"><table class="data">
      <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map(
            (r) =>
              `<tr>${cols
                .map((c) => {
                  const v = r[c];
                  if (typeof v === "object" && v && ("display" in v || "label" in v))
                    return `<td>${moneyHtml(v)}</td>`;
                  if (v == null || v === "") return `<td class="dim">N/A</td>`;
                  return `<td>${esc(v)}</td>`;
                })
                .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table></div>`;
  }

  function viewPositions() {
    const pos = SNAP.positions;
    let event = [],
      securities = [],
      crypto = [],
      note = "";
    if (Array.isArray(pos)) {
      for (const p of pos) {
        const m = String(p.market || p.sleeve || "").toLowerCase();
        if (m.includes("event")) event.push(p);
        else if (m.includes("crypto")) crypto.push(p);
        else securities.push(p);
      }
      note = pos.length ? "" : "No open positions — 100% cash/reserve.";
    } else {
      event = pos?.event || [];
      securities = pos?.securities || [];
      crypto = pos?.crypto || [];
      note = pos?.note || "";
    }
    return `
      <div class="stack">
        <h2 class="section-title">Positions ${labelBadge(pos?.label || SNAP.mode || "LIVE")}</h2>
        ${freshnessStrip()}
        ${sleeveBadgeCaption()}
        ${note ? `<div class="callout info">${esc(note)}</div>` : ""}
        <div class="card"><h2>Event contracts</h2>${positionTable(event)}</div>
        <div class="card"><h2>Securities</h2>${positionTable(securities)}</div>
        <div class="card"><h2>Crypto spot</h2>${positionTable(crypto)}</div>
      </div>`;
  }

  function viewHistory() {
    const hist = SNAP.history || {};
    const blotter = hist.blotter || [];
    const shadows = hist.shadow_artifacts || [];
    const econ = SNAP.economics || {};

    let blotterHtml;
    if (!blotter.length) {
      blotterHtml = emptyState(
        "No trade history yet",
        "Blotter is empty (header-only). Fills appear here after the first live or paper fill. PreSubmitted orders are not fills."
      );
    } else {
      const cols = Object.keys(blotter[0]);
      blotterHtml = `
        <div class="filters">
          <input id="hist-q" type="search" placeholder="Filter blotter…" />
          <span class="muted">${blotter.length} rows</span>
        </div>
        <div class="card table-wrap">
          <table class="data" id="hist-table">
            <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
            <tbody>
              ${blotter
                .map(
                  (r) =>
                    `<tr>${cols
                      .map((c) => {
                        const v = r[c];
                        if (v == null || v === "") return `<td class="dim">N/A</td>`;
                        return `<td>${esc(v)}</td>`;
                      })
                      .join("")}</tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
    }

    const shadowRows = shadows
      .map(
        (a) =>
          `<tr>
            <td><code>${esc(a.path)}</code></td>
            <td>${labelBadge(a.label)}</td>
            <td class="muted">${esc(a.kind)}</td>
            <td class="dim">${esc(a.mtime_ct || "")}</td>
            <td class="muted">${esc(a.note || "")}</td>
          </tr>`
      )
      .join("");

    return `
      <div class="stack">
        <h2 class="section-title">History ${labelBadge(hist.label || SNAP.mode || "LIVE")}</h2>
        ${freshnessStrip()}
        <p class="muted">${esc(hist.note || "")}</p>
        <div class="card"><h2>Blotter (fills)</h2>${blotterHtml}</div>
        <div class="card">
          <h2>Shadow artifacts (path refs — not account P&amp;L)</h2>
          ${
            shadows.length
              ? `<div class="table-wrap"><table class="data">
                  <thead><tr><th>Path</th><th>Label</th><th>Kind</th><th>mtime</th><th>Note</th></tr></thead>
                  <tbody>${shadowRows}</tbody>
                </table></div>`
              : emptyState("No shadow artifacts", "")
          }
        </div>
        <div class="card">
          <h2>Economics (assumptions)</h2>
          <div class="strip">
            <div class="item"><span class="k">Fees</span><span class="v">${moneyHtml(econ.fees)}</span></div>
            <div class="item"><span class="k">Gross</span><span class="v">${moneyHtml(econ.gross)}</span></div>
            <div class="item"><span class="k">Net</span><span class="v">${moneyHtml(econ.net)}</span></div>
          </div>
          <p class="muted">${esc(econ.fills_note || "N/A until fills exist")}</p>
        </div>
      </div>`;
  }

  function bindHistoryFilter() {
    const input = document.getElementById("hist-q");
    const table = document.getElementById("hist-table");
    if (!input || !table) return;
    input.addEventListener("input", () => {
      const q = input.value.toLowerCase();
      table.querySelectorAll("tbody tr").forEach((tr) => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  }

  function plainRejectReason(s) {
    const ev = String(s.evidence_summary || "");
    const st = String(s.status || "").toLowerCase();
    if (st.includes("reject") || st.includes("kill")) {
      return ev || String(s.falsify || "Rejected under pre-committed discipline");
    }
    return "";
  }

  function viewStrategies() {
    const groups = strategiesGrouped();
    const groupsHtml = groups
      .map((grp) => {
        const st = String(grp.status || "").toLowerCase();
        const disciplineNote =
          st.includes("reject") || st.includes("kill") || st.includes("paus") || st.includes("defer")
            ? `<p class="muted" style="margin:0 0 6px">Shown on purpose — rejections and pauses are positive discipline, not clutter to hide.</p>`
            : "";
        const cards = (grp.items || [])
          .map((s) => {
            const reject = plainRejectReason(s);
            return `
          <div class="strat-card">
            <div class="name"><strong>${esc(s.name || "Unnamed")}</strong> ${statusBadge(s.status)}</div>
            <div class="id dim">${esc(s.strategy_id)} · ${esc(s.owner)} · ${esc(s.market)}${s.return_source ? ` · ${esc(s.return_source)}` : ""}</div>
            <div class="row-plain"><span class="k">What testing</span><span class="v">${esc(s.hypothesis || "")}</span></div>
            <div class="row-plain"><span class="k">Evidence</span><span class="v">${esc(s.evidence_summary || "")}</span></div>
            <div class="row-plain"><span class="k">Next</span><span class="v">${esc(s.next_decision || "")}</span></div>
            <div class="row-plain"><span class="k">Scale</span><span class="v">${esc(s.capital_alloc_pct_note || s.capital_alloc_pct || "0")} ${labelBadge(s.label || "PAPER")}</span></div>
            <div class="row-plain"><span class="k">${tip("Kill / Falsify", "Falsify")}</span><span class="v">${esc(s.falsify || "")}</span></div>
            ${reject && (st.includes("reject") || st.includes("kill")) ? `<div class="callout ok" style="margin-top:8px"><strong>Why rejected (discipline):</strong> ${esc(reject)}</div>` : ""}
          </div>`;
          })
          .join("");
        return `
          <div class="strategy-group">
            <div class="head">${statusBadge(grp.status)} <span class="muted">${esc(grp.count)}</span></div>
            ${disciplineNote}
            <div class="strategy-cards">${cards}</div>
          </div>`;
      })
      .join("");

    return `
      <div class="stack">
        <h2 class="section-title">Strategies <span class="muted">${esc(SNAP.strategies?.count ?? "")}</span></h2>
        ${freshnessStrip()}
        ${sleeveBadgeCaption()}
        <div class="callout info">VOLGATE ${tip("OOS", "OOS")} is regime plumbing / ${tip("DD", "DD")} check — not live alpha. Do not treat it as a live sleeve.</div>
        <p class="muted">${esc(SNAP.strategies?.note || "")}</p>
        ${groupsHtml || emptyState("No strategies", "registry empty")}
      </div>`;
  }

  function forecastProcessLabel(f) {
    const looked = String(f.looked_at_market_first) === "true" || f.looked_at_market_first === true;
    if (looked) return { label: "Market-informed", tip: "Looked at market first — practice / contaminated for edge claims" };
    return { label: "Independent", tip: "Locked without peeking at market first — process-clean" };
  }

  function forecastTable(rows) {
    if (!rows.length) return emptyState("None in this bucket", "");
    return `<div class="table-wrap"><table class="data">
      <thead><tr>
        <th>Event</th><th>${tip("Harbor p (my_p)", "my_p")}</th><th>Market p</th>
        <th>Process</th><th>Status</th><th>Flags</th><th>Author</th><th>Locked</th><th>Outcome / Brier</th><th class="dim">ID</th>
      </tr></thead>
      <tbody>
        ${rows
          .map((f) => {
            const proc = forecastProcessLabel(f);
            const flags = [
              f.eligible_mid_promote ? "mid-promote eligible" : "",
              String(f.thin_book) === "true" || f.thin_book === true ? "thin book" : "",
              String(f.wide_book) === "true" || f.wide_book === true ? "wide book" : "",
            ]
              .filter(Boolean)
              .join(", ");
            const outcome = f.outcome == null || f.outcome === "" ? "N/A" : String(f.outcome);
            const brier = f.brier == null || f.brier === "" ? "N/A" : String(f.brier);
            return `<tr>
              <td>${esc(f.event)}</td>
              <td>${esc(f.my_p_locked ?? "N/A")}</td>
              <td>${esc(f.market_p_at_lock ?? "N/A")}</td>
              <td><span class="tip" title="${esc(proc.tip)}">${esc(proc.label)}</span></td>
              <td>${statusBadge(f.status)}</td>
              <td class="muted">${esc(flags || "—")}</td>
              <td>${esc(f.author || "")}</td>
              <td class="dim">${esc(f.timestamp_ct || "")}</td>
              <td class="muted">${esc(outcome)} / ${esc(brier)}</td>
              <td class="dim"><code>${esc(f.forecast_id)}</code></td>
            </tr>`;
          })
          .join("")}
      </tbody></table></div>`;
  }

  function viewForecasts() {
    const f = SNAP.forecasts || {};
    const counts = f.counts || {};
    const buckets = f.buckets || {};
    const calib = f.calibration_files || {};
    const mid = buckets.mid_promote || {};
    const clean = forecastsInBucket("outcome_calib_clean");
    const contam = forecastsInBucket("contaminated");
    const midRows = forecastsInBucket("mid_promote");
    const resolvedClean = counts.resolved_clean ?? f.brier?.n_resolved_clean ?? 0;
    const edge = edgeVerdict(f);

    const sampleGate =
      Number(resolvedClean) < 5
        ? `<div class="callout warn"><strong>Sample gate:</strong> Need ≥5 resolved <em>independent</em> (clean) forecasts before claiming edge. Now n=${esc(resolvedClean)}. ${esc(f.brier?.message || "")}</div>`
        : `<div class="callout ok"><strong>Sample gate:</strong> Resolved clean sample may support charts — still do not mix market-informed rows. Clean Brier: ${moneyHtml(f.brier?.clean)}</div>`;

    const midIds = (mid.ids || []).map((id) => `<code>${esc(id)}</code>`).join(", ") || "none";

    return `
      <div class="stack">
        <h2 class="section-title">Forecasts</h2>
        ${freshnessStrip()}
        <div class="card">
          <h2>How to read this</h2>
          <p><strong>Independent</strong> = we locked ${tip("Harbor probability (my_p)", "my_p")} without looking at the market first — these can support edge claims once scored.</p>
          <p><strong>Market-informed</strong> = we peeked at the market first — useful practice, <em>not</em> proof we beat the market.</p>
          <p><strong>Edge evidence:</strong> ${statusBadge(edge.label)} — ${esc(edge.why)}</p>
          <p class="muted">${tip("Mid-promote", "mid-promote")}: independent lock + meaningful depth + book width ≤ W* (${esc(f.W_star)}). Thin/wide books fail that gate even if process-clean.</p>
        </div>
        <div class="kpi-row">
          <div class="kpi"><div class="label">Active</div><div class="val">${esc(f.active_count ?? "—")}</div></div>
          <div class="kpi"><div class="label">Independent (clean)</div><div class="val">${esc(counts.clean ?? clean.length)}</div></div>
          <div class="kpi"><div class="label">Market-informed</div><div class="val">${esc(counts.contaminated ?? contam.length)}</div></div>
          <div class="kpi"><div class="label">${tip("Mid-promote", "mid-promote")}</div><div class="val">${esc(counts.mid_promote_eligible ?? mid.count ?? midRows.length)}</div></div>
          <div class="kpi"><div class="label">Resolved clean</div><div class="val">${esc(resolvedClean)}</div></div>
        </div>
        ${sampleGate}
        <div class="card">
          <h2>${tip("Mid-promote eligible", "mid-promote")} (W*=${esc(f.W_star)})</h2>
          <p class="muted">Plain rule: independent lock, book has volume, and spread width ≤ ${esc(f.W_star)}.</p>
          <div class="callout info">Eligible now: ${midIds}</div>
          ${midRows.length ? forecastTable(midRows) : ""}
        </div>
        <div class="card">
          <h2>Independent sample (process-clean locks)</h2>
          <p class="muted">${esc(buckets.outcome_calib_clean?.note || "May include thin/wide books — those are not mid-promote.")}</p>
          ${forecastTable(clean)}
        </div>
        <div class="card">
          <h2>Market-informed (contaminated / practice)</h2>
          <p class="muted">${esc(buckets.contaminated?.note || "Looked at market first — process practice only")}</p>
          ${forecastTable(contam)}
        </div>
        <div class="card">
          <h2>Calibration files (append-only CSV)</h2>
          <p class="muted">${esc(calib.note || "CSV append-only row counts — NOT sample n / distinct forecast ids")}</p>
          <div class="strip">
            <div class="item"><span class="k">Clean append rows</span><span class="v">${esc(calib.clean_append_rows ?? 0)}</span></div>
            <div class="item"><span class="k">Contam append rows</span><span class="v">${esc(calib.contaminated_append_rows ?? 0)}</span></div>
          </div>
        </div>
      </div>`;
  }

  function viewRisk() {
    const r = SNAP.risk || {};
    const econ = SNAP.economics || {};
    const op = opStatusParts();
    const dl = r.dollar_limits || {};
    const c = r.starting_c ?? SNAP.portfolio?.starting_c;

    const caps = (r.pct_limits || [])
      .map((row) => {
        let dollars = "—";
        if (row.dollars_at_c != null) {
          dollars = formatUsd(row.dollars_at_c) || "—";
        } else if (c != null && row.pct_of_c != null) {
          dollars = formatUsd(Math.round(Number(c) * Number(row.pct_of_c) * 100) / 100) || "—";
        } else if (row.notes && String(row.notes).includes("$")) {
          dollars = String(row.notes).replace(/\$(\d+(?:\.\d+)?)/g, (_, n) => formatUsd(Number(n)) || "$" + n);
        }
        return `<tr>
            <td>${esc(row.rule)}</td>
            <td>${esc(row.pct_display || (row.pct_of_c != null ? Math.round(row.pct_of_c * 1000) / 10 + "%" : "—"))}</td>
            <td><strong>${esc(dollars)}</strong></td>
            <td class="muted">${esc(row.notes || "")}</td>
          </tr>`;
      })
      .join("");

    const dd = (r.dd_thresholds || [])
      .map((d) => {
        const dollars = d.dollars != null ? formatUsd(d.dollars) || "—" : "—";
        const cShow = formatUsd(c) || esc(c);
        return `<tr>
            <td>≥${esc(d.pct)}% from peak (${esc(dollars)} at ${tip("C", "C")}=${cShow})</td>
            <td>${esc(d.action)}</td>
          </tr>`;
      })
      .join("");

    const utilDetail = r.utilization_detail || {};
    const econNotes = (econ.notes || []).map((n) => `<li>${esc(n)}</li>`).join("");

    const remaining = (SNAP.human_gates?.remaining_gates || SNAP.human_gates?.gates || []).filter((g) => {
      const st = String(g.status || "").toLowerCase();
      return !st.includes("cleared by mandate") && !/^cleared/.test(st);
    });

    return `
      <div class="stack">
        <h2 class="section-title">Risk ${labelBadge(r.label || SNAP.mode || "LIVE")}</h2>
        ${freshnessStrip()}
        ${sleeveBadgeCaption()}
        <div class="callout ok">Live trading ${esc(op.liveStatus)} within sleeve. Automated execution: ${esc(op.autoStatus)}. No leverage / margin / options / perps.${r.no_leverage ? "" : ""}</div>
        <div class="strip">
          <div class="item"><span class="k">${tip("Starting bankroll", "C")}</span><span class="v">${esc(formatUsd(c) || "—")}</span></div>
          <div class="item"><span class="k">Utilization</span><span class="v">${moneyHtml(r.utilization)}</span></div>
          <div class="item"><span class="k">${tip("Drawdown", "DD")}</span><span class="v">${moneyHtml(r.current_dd)}</span></div>
          <div class="item"><span class="k">Exp book used</span><span class="v">${esc(formatUsd(utilDetail.deployed ?? 0) || "$0.00")} / ${esc(formatUsd(utilDetail.exp_book_cap ?? dl.experimental_book) || "—")}</span></div>
        </div>
        <div class="card">
          <h2>Limits (human-readable $ at C=${esc(formatUsd(c) || c)})</h2>
          <p class="muted">From live-experiment-sleeve + risk-architecture. Percentages of starting bankroll, shown as dollars.</p>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Rule</th><th>% of C</th><th>$ limit</th><th>Notes</th></tr></thead>
            <tbody>${caps || `<tr><td colspan="4" class="muted">No caps</td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="card">
          <h2>${tip("Drawdown", "DD")} actions</h2>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Threshold</th><th>Action</th></tr></thead>
            <tbody>${dd}</tbody>
          </table></div>
        </div>
        <div class="card">
          <h2>Key dollar caps (quick)</h2>
          <div class="kpi-row" style="grid-template-columns:repeat(3,1fr)">
            <div class="kpi"><div class="label">Exp book</div><div class="val">${esc(formatUsd(dl.experimental_book) || "—")}</div></div>
            <div class="kpi"><div class="label">Per exp position</div><div class="val">${esc(formatUsd(dl.pos_experimental) || "—")}</div></div>
            <div class="kpi"><div class="label">Reserve floor</div><div class="val">${esc(formatUsd(dl.reserve_floor) || "—")}</div></div>
            <div class="kpi"><div class="label">Strategy loss</div><div class="val">${esc(formatUsd(dl.strategy_loss) || "—")}</div></div>
            <div class="kpi"><div class="label">Soft daily pause</div><div class="val">${esc(formatUsd(dl.soft_daily_loss) || "—")}</div></div>
            <div class="kpi"><div class="label">First ops test</div><div class="val">${esc(formatUsd(dl.start_experiment_low) || "—")}–${esc(formatUsd(dl.start_experiment_high) || "—")}</div></div>
          </div>
          <p class="dim">${esc(r.dollar_limits_note || "")}</p>
        </div>
        <div class="card">
          <h2>Fee / friction assumptions</h2>
          <p class="muted">${esc(econ.kind || "")} · ${esc(econ.source || "")}</p>
          <div class="strip">
            <div class="item"><span class="k">Kalshi taker</span><span class="v">${esc(econ.kalshi_taker_rate)}</span></div>
            <div class="item"><span class="k">IBKR event</span><span class="v">${esc(econ.ibkr_event_per_contract)}</span></div>
            <div class="item"><span class="k">IBKR equity</span><span class="v">${esc(econ.ibkr_equity_per_share)}</span></div>
            <div class="item"><span class="k">${tip("Crypto RT bps", "RT bps")}</span><span class="v">${esc(econ.crypto_rt_bps_default)}</span></div>
            <div class="item"><span class="k">Half-spread</span><span class="v">${esc(econ.event_default_half_spread)}</span></div>
          </div>
          <ul class="warn-list">${econNotes}</ul>
        </div>
        <div class="card">
          <h2>Remaining human gates (not “live blocked”)</h2>
          <p class="muted">${esc(SNAP.human_gates?.note || "")}</p>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>#</th><th>Gate</th><th>Owner</th><th>Status</th><th>Blocks</th></tr></thead>
            <tbody>
              ${remaining
                .map(
                  (g) =>
                    `<tr><td>${esc(g.n ?? g.num)}</td><td>${esc(g.gate)}</td><td>${esc(g.owner)}</td>
                     <td>${gateBadge(g.status)}</td><td class="muted">${esc(g.blocks)}</td></tr>`
                )
                .join("") || `<tr><td colspan="5" class="muted">None</td></tr>`}
            </tbody>
          </table></div>
        </div>
      </div>`;
  }

  function viewLessons() {
    const items = SNAP.lessons?.items || [];
    if (!items.length) {
      return `<div class="stack"><h2 class="section-title">Lessons</h2>${emptyState("No lessons yet", "journal/lessons.csv empty")}</div>`;
    }
    const list = items
      .map((L) => {
        const conclusion = L.what_we_learned || L.learning || L.heading || "";
        const hasStruct = L.what_happened || L.believed_beforehand || L.evidence_showed || L.what_changed;
        if (!hasStruct && L.heading) {
          return `
          <div class="lesson">
            <div class="conclusion">${esc(L.heading)}</div>
            <div class="dim">${esc(L.source || "")}</div>
          </div>`;
        }
        return `
        <div class="lesson">
          <div class="conclusion">${esc(conclusion)}</div>
          <div><span class="id">${esc(L.lesson_id)}</span> <span class="muted">${esc(L.date_ct)}</span>
            <span class="dim">· ${esc(L.source)}</span></div>
          <div class="row"><div class="k">Observation</div><div class="v">${esc(L.what_happened || "")}</div></div>
          <div class="row"><div class="k">Decision / belief</div><div class="v">${esc(L.believed_beforehand || "")}</div></div>
          <div class="row"><div class="k">Outcome / evidence</div><div class="v">${esc(L.evidence_showed || "")}</div></div>
          <div class="row"><div class="k">Lesson</div><div class="v"><strong>${esc(L.what_we_learned || "")}</strong></div></div>
          <div class="row"><div class="k">System change</div><div class="v">${esc(L.what_changed || "")}</div></div>
          <div class="row"><div class="k">Related</div><div class="v dim">${esc(L.related_ids || "")}</div></div>
        </div>`;
      })
      .join("");
    return `
      <div class="stack">
        <h2 class="section-title">Lessons <span class="muted">${esc(SNAP.lessons.count)}</span></h2>
        ${freshnessStrip()}
        <p class="muted">Plain-English conclusion first · Observation → Decision → Outcome → Lesson → System Change · ${esc(SNAP.lessons.source || "journal/lessons.csv")}</p>
        <div class="card">${list}</div>
      </div>`;
  }

  function viewDocs() {
    const pack = SNAP.docs || SNAP.docs_meta || {};
    const sections = pack.sections || [];
    const excerpts = pack.excerpts || {};
    const docs = pack.docs || [];

    const shortCards = `
      <div class="grid grid-3">
        <div class="card"><h2>Mission / state</h2><pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11px;color:var(--muted);margin:0">${esc(excerpts.mission_short || "")}</pre></div>
        <div class="card"><h2>Risk</h2><pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11px;color:var(--muted);margin:0">${esc(excerpts.risk_short || "")}</pre></div>
        <div class="card"><h2>Learning loop</h2><pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11px;color:var(--muted);margin:0">${esc(excerpts.loop_short || "")}</pre></div>
      </div>`;

    const details = sections.length
      ? sections
          .map(
            (s) => `
        <details class="doc-sec">
          <summary>${esc(s.title || s.path)} <span class="path">${esc(s.path || "")}${s.exists === false ? " · missing" : ""}</span></summary>
          <pre>${esc(s.text || "")}</pre>
        </details>`
          )
          .join("")
      : docs
          .map(
            (d) => `
        <details class="doc-sec">
          <summary>${esc(d.path)} <span class="path">${d.exists ? "on disk" : "missing"} · ${esc(d.mtime_ct || "")}</span></summary>
          <pre>Path: ${esc(d.path)}
Exists: ${d.exists ? "yes" : "no"}
mtime: ${esc(d.mtime_ct || "—")}</pre>
        </details>`
          )
          .join("");

    const histNote =
      (excerpts.mission_short || "").includes("Paper/research only") ||
      (excerpts.mission_short || "").includes("C unconfirmed")
        ? `<div class="callout warn">Note: docs/canonical-state-2026-09-04.md is <strong>HISTORICAL</strong> (pre-funding). Current pointers: docs/capital.json, live-experiment-sleeve, risk-architecture, ops-index.</div>`
        : "";

    const banner = `Schema ${SNAP.schema_version || "v1"} · Mode ${SNAP.mode || "LIVE"} · Generated ${SNAP.generated_at_ct || SNAP.meta?.generated_at_ct || "—"} · Reconciled ${SNAP.meta?.last_reconciled_ibkr_ct || "—"} · C confirmed: ${SNAP.c_confirmed ?? SNAP.meta?.c_confirmed ?? false}`;

    return `
      <div class="stack">
        <h2 class="section-title">System docs</h2>
        <div class="callout info">${esc(banner)}</div>
        ${histNote}
        ${excerpts.mission_short || excerpts.risk_short || excerpts.loop_short ? shortCards : ""}
        <div class="callout">Embeds from snapshot docs / docs_meta — paths + short excerpts only.</div>
        ${details || emptyState("No docs_meta", "")}
      </div>`;
  }

  const VIEWS = {
    overview: viewOverview,
    positions: viewPositions,
    history: viewHistory,
    strategies: viewStrategies,
    forecasts: viewForecasts,
    risk: viewRisk,
    lessons: viewLessons,
    docs: viewDocs,
  };

  function show(name) {
    const fn = VIEWS[name] || viewOverview;
    app.innerHTML = fn();
    nav.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === name);
    });
    if (name === "history") bindHistoryFilter();
    try {
      history.replaceState(null, "", "#" + name);
    } catch (_) {}
  }

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-view]");
    if (!btn) return;
    show(btn.dataset.view);
  });

  async function boot() {
    try {
      const res = await fetch("data/snapshot.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      SNAP = await res.json();
      const gen = SNAP.generated_at_ct || SNAP.meta?.generated_at_ct || "";
      const rec = SNAP.last_reconciled_ibkr_ct || SNAP.meta?.last_reconciled_ibkr_ct || null;
      const portal = SNAP.meta?.confirmed_ct || "";
      const genEl = document.getElementById("gen-at");
      if (genEl) {
        if (rec) genEl.textContent = `reconciled ${rec} · gen ${gen}`;
        else if (portal) genEl.textContent = `Portal confirm ${portal} · gen ${gen}`;
        else genEl.textContent = gen;
      }
      const modeEl = document.querySelector("#top-meta .badge");
      if (modeEl) {
        const lbl = String(SNAP.mode || SNAP.meta?.mode || "PAPER").toUpperCase();
        modeEl.textContent = lbl;
        modeEl.className =
          "badge " +
          (lbl === "LIVE"
            ? "badge-live"
            : lbl === "SHADOW"
              ? "badge-shadow"
              : lbl === "BACKTEST"
                ? "badge-backtest"
                : "badge-paper");
      }
      const hash = (location.hash || "#overview").replace("#", "") || "overview";
      show(VIEWS[hash] ? hash : "overview");
    } catch (err) {
      app.innerHTML = `<div class="card"><h2>Snapshot load failed</h2>
        <p>Could not load <code>data/snapshot.json</code>.</p>
        <p class="muted">${esc(err.message)}</p>
        <p>Run <code>./dashboard/serve.sh</code> or <code>python3 tools/dashboard_snapshot.py</code> from repo root, then refresh.</p></div>`;
    }
  }

  boot();
})();
