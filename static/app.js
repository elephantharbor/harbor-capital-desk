/* Harbor Capital operating desk — read-only SPA (harbor-dashboard-snapshot-v1) */
(function () {
  "use strict";

  let SNAP = null;
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Money / labeled values — never invent numbers. */
  function moneyHtml(m) {
    if (m == null) {
      return `<span class="dim">N/A</span> <span class="badge badge-na">N/A</span>`;
    }
    if (typeof m === "object") {
      const display =
        m.display != null && m.display !== ""
          ? m.display
          : m.value == null || m.value === undefined
            ? "N/A"
            : String(m.value);
      // Null / N/A money: badge text N/A only (mode lives in header)
      if (m.value == null || m.value === undefined || display === "N/A") {
        return `<span class="dim">N/A</span> <span class="badge badge-na">N/A</span>`;
      }
      const lbl = String(m.label || "PAPER").toUpperCase();
      return `<span>${esc(display)}</span> ${labelBadge(lbl)}`;
    }
    if (m === "" || m === "N/A") {
      return `<span class="dim">N/A</span> <span class="badge badge-na">N/A</span>`;
    }
    return `<span>${esc(m)}</span>`;
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
    else if (s === "live") cls = "badge-live";
    else if (s === "paper") cls = "badge-paper";
    else if (s === "backtest") cls = "badge-backtest";
    else if (s.includes("reject") || s.includes("kill")) cls = "badge-rejected";
    else if (s.includes("paus") || s.includes("defer")) cls = "badge-paused";
    else if (s === "idea" || s === "researching") cls = "badge-idea";
    else if (s.includes("open") || s.includes("blocked") || s.includes("trial") || s.includes("skip"))
      cls = "badge-open";
    else if (s.includes("standing") || s.includes("not requested")) cls = "badge-standing";
    else if (s === "locked") cls = "badge-paper";
    return `<span class="badge ${cls}">${esc(raw)}</span>`;
  }

  function gateBadge(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes("standing") || s === "not requested")
      return `<span class="badge badge-standing">${esc(status)}</span>`;
    if (
      s.includes("open") ||
      s.includes("blocked") ||
      s.includes("trial") ||
      s.includes("skipped") ||
      s.includes("deferred")
    )
      return `<span class="badge badge-open">${esc(status)}</span>`;
    return `<span class="badge badge-na">${esc(status)}</span>`;
  }

  function emptyState(title, detail) {
    return `<div class="empty"><strong>${esc(title)}</strong><span>${esc(detail || "")}</span></div>`;
  }

  function modeBadge() {
    return labelBadge(SNAP.mode || SNAP.meta?.mode || SNAP.portfolio?.mode || "PAPER");
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

  /* ---------- views ---------- */

  function viewOverview() {
    const p = SNAP.portfolio || {};
    const pw = SNAP.performance_windows || {};
    const risk = SNAP.risk || {};
    const hg = SNAP.human_gates || {};
    const health = SNAP.system_health || {};
    const fc = SNAP.forecasts || {};
    const counts = fc.counts || {};
    const meta = SNAP.meta || {};
    const activity = buildActivityItems();

    const av = p.account_value_money || { display: "N/A", label: "PAPER", value: null };

    const windowKeys = ["today", "7d", "30d", "90d", "inception"];
    const windowKpis = windowKeys
      .map((k) => {
        const w = pw[k];
        return `<div class="kpi"><div class="label">${esc(k)}</div><div class="val">${moneyHtml(w)}</div></div>`;
      })
      .join("");

    const actHtml = activity
      .slice(0, 12)
      .map(
        (a) =>
          `<li><span class="ts">${esc(a.ts)}</span> <span class="kind">${esc(a.kind)}</span>
           <strong>${esc(a.title)}</strong><br/><span class="muted">${esc(a.summary)}</span></li>`
      )
      .join("");

    const gatesRows = (hg.gates || [])
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

    const sleeveRows = (p.sleeves || [])
      .map(
        (s) =>
          `<tr>
            <td><code>${esc(s.id)}</code></td>
            <td>${labelBadge(s.label)}</td>
            <td>${esc(s.status)}</td>
            <td class="dim">${esc(s.note || "")}</td>
          </tr>`
      )
      .join("");

    const warnings = (meta.warnings || [])
      .map((w) => `<li>${esc(w)}</li>`)
      .join("");

    const resolvedClean = counts.resolved_clean ?? fc.brier?.n_resolved_clean ?? 0;
    const midN = counts.mid_promote_eligible ?? fc.buckets?.mid_promote?.count ?? 0;
    const midIds = fc.buckets?.mid_promote?.ids || [];

    return `
      <div class="stack">
        <div class="grid grid-2">
          <div class="card">
            <h2>Account value</h2>
            <div class="hero-value">${esc(av.display || "N/A")} ${labelBadge(av.label || "PAPER")}</div>
            <p class="hero-note">${esc(p.note || "C unconfirmed; no invented NAV")}</p>
            <div class="kpi-row" style="grid-template-columns:repeat(3,1fr);margin-top:12px">
              <div class="kpi"><div class="label">Net P&amp;L</div><div class="val">${moneyHtml(p.net_pnl)}</div></div>
              <div class="kpi"><div class="label">Realized</div><div class="val">${moneyHtml(p.realized_pnl)}</div></div>
              <div class="kpi"><div class="label">Deployed</div><div class="val">${moneyHtml(p.deployed)}</div></div>
            </div>
          </div>
          <div class="card">
            <h2>Registry status mix</h2>
            <p class="muted" style="margin:0 0 8px">Not a health score — status counts from strategies.csv only.</p>
            <div class="kpi-row" style="grid-template-columns:repeat(2,1fr)">
              <div class="kpi"><div class="label">Shadow</div><div class="val">${esc(health.shadow ?? "—")}</div></div>
              <div class="kpi"><div class="label">Rejected</div><div class="val">${esc(health.rejected ?? "—")}</div></div>
              <div class="kpi"><div class="label">Deferred / paused</div><div class="val">${esc(health.deferred ?? "—")}</div></div>
              <div class="kpi"><div class="label">Idea / researching</div><div class="val">${esc(health.proposed ?? "—")}</div></div>
            </div>
          </div>
        </div>

        <div class="card">
          <h2>Performance windows</h2>
          <div class="kpi-row">${windowKpis}</div>
          <p class="muted">${esc(pw.reason || pw.note || "")} ${labelBadge(pw.label || "PAPER")}</p>
        </div>

        <div class="card">
          <h2>Risk strip</h2>
          <div class="strip">
            <div class="item"><span class="k">Utilization</span><span class="v">${moneyHtml(risk.utilization)}</span></div>
            <div class="item"><span class="k">Current DD</span><span class="v">${moneyHtml(risk.current_dd)}</span></div>
            <div class="item"><span class="k">DD gates</span><span class="v">12% / 18% / 25%</span></div>
            <div class="item"><span class="k">Exp book cap</span><span class="v">≤10% C</span></div>
            <div class="item"><span class="k">Reserve floor</span><span class="v">≥50% C</span></div>
          </div>
          <p class="muted" style="margin:8px 0 0">${esc(risk.note || risk.framework || "")} · ${esc(risk.dollar_limits_note || "dollar limits TBD until C")}</p>
        </div>

        <div class="card">
          <h2>Sleeves (status only — no $ invent)</h2>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Sleeve</th><th>Label</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>${sleeveRows || `<tr><td colspan="4" class="muted">No sleeves</td></tr>`}</tbody>
          </table></div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <h2>Activity stream</h2>
            <p class="dim" style="margin:0 0 6px">${esc(SNAP.activity?.note || "From journal/registry only")}</p>
            <ul class="activity">${actHtml || "<li class='muted'>No activity</li>"}</ul>
          </div>
          <div class="card">
            <h2>Forecast quality</h2>
            <div class="kpi-row" style="grid-template-columns:repeat(2,1fr)">
              <div class="kpi"><div class="label">Clean</div><div class="val">${esc(counts.clean ?? "—")}</div></div>
              <div class="kpi"><div class="label">Contaminated</div><div class="val">${esc(counts.contaminated ?? "—")}</div></div>
              <div class="kpi"><div class="label">Mid-promote</div><div class="val">${esc(midN)}</div></div>
              <div class="kpi"><div class="label">Resolved clean</div><div class="val">${esc(resolvedClean)}</div></div>
            </div>
            ${
              Number(resolvedClean) < 5
                ? `<div class="callout warn">${esc(fc.brier?.message || "Insufficient resolved clean sample")}. ${esc(fc.brier?.warning || "No Brier chart. Do not mix clean/contaminated.")}</div>`
                : `<div class="callout ok">Resolved clean sample may support charts — still do not mix contaminated.</div>`
            }
            ${
              midN
                ? `<div class="callout info">Mid-promote eligible: ${midIds.map((id) => `<code>${esc(id)}</code>`).join(", ")} (W*=${esc(fc.W_star)})</div>`
                : ""
            }
          </div>
        </div>

        <div class="card">
          <h2>Human gates <span class="muted">(${esc(hg.open_count ?? "?")}/${esc(hg.count ?? (hg.gates || []).length)} open-ish)</span></h2>
          <div class="callout warn">${esc(hg.note || "Live trading blocked until human gates clear")}${hg.live_blocked ? " · live_blocked=true" : ""}</div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>#</th><th>Gate</th><th>Owner</th><th>Status</th><th>Blocks</th></tr></thead>
            <tbody>${gatesRows}</tbody>
          </table></div>
          <p class="dim" style="margin-top:6px">Source: ${esc(hg.source || "")}</p>
        </div>

        ${
          warnings
            ? `<div class="card"><h2>Warnings</h2><ul class="warn-list">${warnings}</ul></div>`
            : ""
        }
      </div>`;
  }

  function positionTable(rows) {
    if (!rows || !rows.length) {
      return emptyState(
        "No current positions",
        "Empty blotter — not broken. Paper mode; no open risk."
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
    // Enriched shape: {event,securities,crypto}; legacy: array
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
      note = pos.length ? "" : "No open positions in snapshot (paper bootstrap).";
    } else {
      event = pos?.event || [];
      securities = pos?.securities || [];
      crypto = pos?.crypto || [];
      note = pos?.note || "";
    }
    return `
      <div class="stack">
        <h2 class="section-title">Positions ${labelBadge(pos?.label || SNAP.mode || "PAPER")}</h2>
        ${note ? `<div class="callout">${esc(note)}</div>` : ""}
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
        "blotter empty / header-only. Fills appear here when paper or live trades are logged."
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
        <h2 class="section-title">History ${labelBadge(hist.label || "PAPER")}</h2>
        <p class="muted">${esc(hist.note || "")}</p>
        <div class="card"><h2>Blotter</h2>${blotterHtml}</div>
        <div class="card">
          <h2>Shadow artifacts (path refs — no invented PnL)</h2>
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

  function viewStrategies() {
    const groups = strategiesGrouped();
    const groupsHtml = groups
      .map((grp) => {
        const cards = (grp.items || [])
          .map(
            (s) => `
          <div class="strat-card">
            <div class="id">${esc(s.strategy_id)} ${statusBadge(s.status)}</div>
            <div class="name">${esc(s.name)} · ${esc(s.owner)} · ${esc(s.market)}</div>
            <div class="hyp">${esc(s.hypothesis)}</div>
            <div class="meta" style="margin-top:6px">Falsify: ${esc(s.falsify)}</div>
            <div class="meta">Next: ${esc(s.next_decision)}</div>
            <div class="meta">${esc(s.evidence_summary)}</div>
            <div class="meta" style="margin-top:4px">Alloc: ${esc(s.capital_alloc_pct_note || s.capital_alloc_pct || "0")} · ${labelBadge(s.label || "PAPER")}</div>
          </div>`
          )
          .join("");
        return `
          <div class="strategy-group">
            <div class="head">${statusBadge(grp.status)} <span class="muted">${esc(grp.count)}</span></div>
            <div class="strategy-cards">${cards}</div>
          </div>`;
      })
      .join("");

    return `
      <div class="stack">
        <h2 class="section-title">Strategies <span class="muted">${esc(SNAP.strategies?.count ?? "")}</span> ${labelBadge(SNAP.strategies?.label || "PAPER")}</h2>
        <div class="callout warn">VOLGATE OOS is regime plumbing / DD check — not live alpha. Do not present as a live sleeve.</div>
        <div class="callout warn">Rejected / paused / deferred strategies are shown deliberately — do not hide kills.</div>
        <p class="muted">${esc(SNAP.strategies?.note || "")} · source ${esc(SNAP.strategies?.source || "")}</p>
        ${groupsHtml || emptyState("No strategies", "registry empty")}
      </div>`;
  }

  function forecastTable(rows) {
    if (!rows.length) return emptyState("None in this bucket", "");
    return `<div class="table-wrap"><table class="data">
      <thead><tr>
        <th>ID</th><th>Event</th><th>my_p</th><th>market</th><th>Status</th><th>Flags</th><th>Author</th><th>Locked</th><th>Outcome / Brier</th>
      </tr></thead>
      <tbody>
        ${rows
          .map((f) => {
            const flags = [
              f.eligible_mid_promote ? "mid-promote" : "",
              String(f.thin_book) === "true" || f.thin_book === true ? "thin_book" : "",
              String(f.wide_book) === "true" || f.wide_book === true ? "wide_book" : "",
              String(f.looked_at_market_first) === "true" || f.looked_at_market_first === true
                ? "looked_at_market_first"
                : "clean_lock",
            ]
              .filter(Boolean)
              .join(", ");
            const outcome = f.outcome == null || f.outcome === "" ? "N/A" : String(f.outcome);
            const brier = f.brier == null || f.brier === "" ? "N/A" : String(f.brier);
            return `<tr>
              <td><code>${esc(f.forecast_id)}</code></td>
              <td>${esc(f.event)}</td>
              <td>${esc(f.my_p_locked ?? "N/A")}</td>
              <td>${esc(f.market_p_at_lock ?? "N/A")}</td>
              <td>${statusBadge(f.status)}</td>
              <td class="muted">${esc(flags)}</td>
              <td>${esc(f.author || "")}</td>
              <td class="dim">${esc(f.timestamp_ct || "")}</td>
              <td class="muted">${esc(outcome)} / ${esc(brier)}</td>
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

    const showChartNote =
      Number(resolvedClean) < 5
        ? `<div class="callout warn">Insufficient resolved clean sample (n=${esc(resolvedClean)}). No Brier chart. ${esc(f.brier?.message || "")} ${esc(f.brier?.warning || "Do not invent outcomes or mix contaminated rows.")}</div>`
        : `<div class="callout ok">Resolved clean sample may support a chart — still do not mix contaminated. Clean Brier: ${moneyHtml(f.brier?.clean)}</div>`;

    const midIds = (mid.ids || []).map((id) => `<code>${esc(id)}</code>`).join(", ") || "none";

    return `
      <div class="stack">
        <h2 class="section-title">Forecasts ${labelBadge(f.label || "PAPER")}</h2>
        <div class="kpi-row">
          <div class="kpi"><div class="label">Active</div><div class="val">${esc(f.active_count ?? "—")}</div></div>
          <div class="kpi"><div class="label">Clean</div><div class="val">${esc(counts.clean ?? clean.length)}</div></div>
          <div class="kpi"><div class="label">Contaminated</div><div class="val">${esc(counts.contaminated ?? contam.length)}</div></div>
          <div class="kpi"><div class="label">Mid-promote</div><div class="val">${esc(counts.mid_promote_eligible ?? mid.count ?? midRows.length)}</div></div>
          <div class="kpi"><div class="label">Resolved clean</div><div class="val">${esc(resolvedClean)}</div></div>
        </div>
        ${showChartNote}
        <div class="card">
          <h2>Mid-promote callout (W*=${esc(f.W_star)})</h2>
          <p><code>${esc(mid.rule || "looked_at_market_first=false AND vol/oi>0 AND book_width<=W*")}</code></p>
          <div class="callout info">Eligible now: ${midIds}</div>
          ${midRows.length ? forecastTable(midRows) : ""}
        </div>
        <div class="card">
          <h2>Clean sample (process-clean locks)</h2>
          <p class="muted">${esc(buckets.outcome_calib_clean?.note || "")}</p>
          ${forecastTable(clean)}
        </div>
        <div class="card">
          <h2>Contaminated</h2>
          <p class="muted">${esc(buckets.contaminated?.note || "looked_at_market_first or contaminated_abstain — process practice only")}</p>
          ${forecastTable(contam)}
        </div>
        <div class="card">
          <h2>Calibration files (append-only CSV)</h2>
          <p class="muted">${esc(calib.note || "CSV append-only row counts — NOT sample n / distinct forecast ids")}</p>
          <div class="strip">
            <div class="item"><span class="k">Clean path</span><span class="v"><code>${esc(calib.clean_path || "")}</code></span></div>
            <div class="item"><span class="k">Clean append rows</span><span class="v">${esc(calib.clean_append_rows ?? calib.clean_row_count ?? 0)}</span></div>
            <div class="item"><span class="k">Contaminated path</span><span class="v"><code>${esc(calib.contaminated_path || "")}</code></span></div>
            <div class="item"><span class="k">Contam append rows</span><span class="v">${esc(calib.contaminated_append_rows ?? calib.contaminated_row_count ?? 0)}</span></div>
          </div>
        </div>
        <div class="callout">${esc(f.note || "do not invent outcomes/brier when blank")}</div>
      </div>`;
  }

  function viewRisk() {
    const r = SNAP.risk || {};
    const econ = SNAP.economics || {};
    const caps = (r.pct_limits || [])
      .map(
        (c) =>
          `<tr>
            <td>${esc(c.rule)}</td>
            <td>${esc(c.pct_display || (c.pct_of_c != null ? Math.round(c.pct_of_c * 1000) / 10 + "%" : "N/A"))}</td>
            <td class="muted">${esc(c.notes || "")}</td>
            <td>${labelBadge(c.label || "PAPER")}</td>
            <td class="dim">$ N/A until C</td>
          </tr>`
      )
      .join("");

    const ddSrc = r.dd_thresholds || r.drawdown_limits || [];
    const dd = ddSrc
      .map((d) => {
        const thr =
          d.threshold_display ||
          (d.pct != null ? "≥" + d.pct + "%" : d.threshold_pct != null ? "≥" + Math.round(d.threshold_pct * 100) + "%" : "N/A");
        return `<tr>
            <td>${esc(thr)}</td>
            <td>${esc(d.action)}</td>
            <td>${labelBadge(d.label || "PAPER")}</td>
          </tr>`;
      })
      .join("");

    const econNotes = (econ.notes || []).map((n) => `<li>${esc(n)}</li>`).join("");

    return `
      <div class="stack">
        <h2 class="section-title">Risk framework ${labelBadge(r.label || "PAPER")}</h2>
        <div class="callout warn">C unconfirmed → utilization and dollar caps are N/A. No leverage / margin / options / perps.${r.no_leverage ? " (policy: no_leverage)" : ""}</div>
        <div class="strip">
          <div class="item"><span class="k">Utilization</span><span class="v">${moneyHtml(r.utilization)}</span></div>
          <div class="item"><span class="k">Current DD</span><span class="v">${moneyHtml(r.current_dd)}</span></div>
          <div class="item"><span class="k">Framework</span><span class="v">${esc(r.framework || "")}</span></div>
        </div>
        <div class="card">
          <h2>Position &amp; book caps (% of C)</h2>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Rule</th><th>% of C</th><th>Notes</th><th>Label</th><th>$</th></tr></thead>
            <tbody>${caps || `<tr><td colspan="5" class="muted">No caps</td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="card">
          <h2>Drawdown thresholds</h2>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>DD from peak</th><th>Action</th><th>Label</th></tr></thead>
            <tbody>${dd}</tbody>
          </table></div>
        </div>
        <div class="card">
          <h2>Dollar limits</h2>
          <p>${r.dollar_limits == null ? `<span class="dim">N/A</span> — ${esc(r.dollar_limits_note || "TBD while C unconfirmed")}` : esc(JSON.stringify(r.dollar_limits))}</p>
          <p class="dim">Source: ${esc(r.source || "")}</p>
          <ul class="warn-list">${(r.pointers || []).map((p) => `<li><code>${esc(p)}</code></li>`).join("")}</ul>
        </div>
        <div class="card">
          <h2>Fee / friction assumptions ${labelBadge(econ.label || "PAPER")}</h2>
          <p class="muted">${esc(econ.kind || "")} · ${esc(econ.source || "")}</p>
          <div class="strip">
            <div class="item"><span class="k">Kalshi taker</span><span class="v">${esc(econ.kalshi_taker_rate)}</span></div>
            <div class="item"><span class="k">IBKR event</span><span class="v">${esc(econ.ibkr_event_per_contract)}</span></div>
            <div class="item"><span class="k">IBKR equity</span><span class="v">${esc(econ.ibkr_equity_per_share)}</span></div>
            <div class="item"><span class="k">Crypto RT bps</span><span class="v">${esc(econ.crypto_rt_bps_default)}</span></div>
            <div class="item"><span class="k">Half-spread</span><span class="v">${esc(econ.event_default_half_spread)}</span></div>
          </div>
          <ul class="warn-list">${econNotes}</ul>
        </div>
        <div class="card">
          <h2>Human gates (live blockers)</h2>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>#</th><th>Gate</th><th>Owner</th><th>Status</th><th>Blocks</th></tr></thead>
            <tbody>
              ${(SNAP.human_gates?.gates || [])
                .map(
                  (g) =>
                    `<tr><td>${esc(g.n ?? g.num)}</td><td>${esc(g.gate)}</td><td>${esc(g.owner)}</td>
                     <td>${gateBadge(g.status)}</td><td class="muted">${esc(g.blocks)}</td></tr>`
                )
                .join("")}
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
      .map(
        (L) => `
        <div class="lesson">
          <div><span class="id">${esc(L.lesson_id)}</span> <span class="muted">${esc(L.date_ct)}</span>
            <span class="dim">· ${esc(L.source)}</span></div>
          <div class="row"><div class="k">Experience</div><div class="v">${esc(L.what_happened)}</div></div>
          <div class="row"><div class="k">Believed</div><div class="v">${esc(L.believed_beforehand)}</div></div>
          <div class="row"><div class="k">Evidence</div><div class="v">${esc(L.evidence_showed)}</div></div>
          <div class="row"><div class="k">Learning</div><div class="v"><strong>${esc(L.what_we_learned)}</strong></div></div>
          <div class="row"><div class="k">Change</div><div class="v">${esc(L.what_changed)}</div></div>
          <div class="row"><div class="k">Related</div><div class="v dim">${esc(L.related_ids)}</div></div>
        </div>`
      )
      .join("");
    return `
      <div class="stack">
        <h2 class="section-title">Lessons <span class="muted">${esc(SNAP.lessons.count)}</span></h2>
        <p class="muted">Experience → Learning → Change · ${esc(SNAP.lessons.source || "journal/lessons.csv")}</p>
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

    const banner = `Schema ${SNAP.schema_version || "v1"} · Mode ${SNAP.mode || "PAPER"} · Generated ${SNAP.generated_at_ct || SNAP.meta?.generated_at_ct || "—"} · C confirmed: ${SNAP.c_confirmed ?? SNAP.meta?.c_confirmed ?? false}`;

    return `
      <div class="stack">
        <h2 class="section-title">System docs</h2>
        <div class="callout info">${esc(banner)}</div>
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
      document.getElementById("gen-at").textContent = gen;
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
