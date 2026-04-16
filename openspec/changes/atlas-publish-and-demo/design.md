## Context

Atlas already provides the candidate CRS lookup logic needed for Maplat V3.1. The remaining work is release standardization and demo delivery alignment with sibling repositories such as MaplatTransform and MaplatTin.

## Decisions

- keep `src/` reserved for publishable library code
- keep the publishable Atlas library Node-only in this change
- place demo logic and resources under `demo/`
- keep root `index.html` as the GitHub Pages entry page
- use one Vite config with package mode and demo mode
- deploy the demo site to GitHub Pages under `/Atlas/`
- implement browser-side demo lookup through a demo-only adapter under `demo/`, not by making the published package browser-capable
- use a lightweight table plus full detail panel instead of a spreadsheet framework
- implement “all clicked points are within the CRS” by querying with the bbox enclosing all clicked points

## Consequences

- package and demo concerns stay separated without splitting into multiple projects
- the demo remains easy to host on GitHub Pages
- Atlas avoids gaining demo-only logic in the public runtime surface
- browser-specific asset loading and lookup behavior are isolated to `demo/`
