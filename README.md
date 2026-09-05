# Harbor Capital — Operating Desk (read-only)

Paper/research dashboard for Elephant Harbor Capital Growth.

- **Mode:** PAPER (starting capital C unconfirmed — no invented NAV)
- **No** trade, withdraw, deposit, or credential controls
- Source of truth remains the Harbor Capital journal/registry on the ops box; this site mirrors a snapshot

## Local
Open `index.html` via any static server, or view the GitHub Pages URL for this repo.

## Refresh
Rebuild `data/snapshot.json` from the Harbor Capital workspace (`tools/dashboard_snapshot.py`), then push an update to this repo.
