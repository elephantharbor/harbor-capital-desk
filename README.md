# Harbor Capital — Operating Desk (read-only)

Operating dashboard for Elephant Harbor Capital Growth.

- **Mode:** LIVE · **C = $200** (funded IBKR 2026-09-05)
- Snapshot mirrors Harbor ledger/`docs/capital.json` — no trade/withdraw UI
- Experimental sleeve limits and full risk text live in the Harbor Capital workspace docs

## Open
https://elephantharbor.github.io/harbor-capital-desk/

## Refresh
Rebuild `data/snapshot.json` from the Harbor Capital workspace (`python3 tools/dashboard_snapshot.py`), copy into this repo, and push `main`.
