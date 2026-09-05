# Harbor Capital — Operating Desk (read-only)

Operating dashboard for Elephant Harbor Capital Growth.

- **Mode:** LIVE · **C = $200** (funded IBKR 2026-09-05)
- Snapshot mirrors Harbor ledger/`docs/capital.json` — no trade/withdraw UI
- Experimental sleeve limits and full risk text live in the Harbor Capital workspace docs

## Open
https://elephantharbor.github.io/harbor-capital-desk/

## Refresh
From the growth workspace only:

```bash
cd /workspace/harbor-capital-growth
python3 tools/publish_dashboard_snapshot.py --public
```

That command is the **only** writer to `data/snapshot.json` here. It always sanitizes
(IBKR U*/DU*/DUT* account ids, broker order ids, credential-like fields). Do **not**
copy the private `dashboard/data/snapshot.json` unsanitized. Push `main` after review
(ask before pushing). No transmits from publish.

## Portfolio summary

`data/segment-summary.json` is the Capital → portfolio homepage contract feed.
Regenerate from the public snapshot after publish (Cycle 5). Shared chrome: https://elephantharbor.github.io/shared/
