## Context

Atlas already provides the candidate CRS lookup logic needed for Maplat V3.1. The remaining work is release standardization and demo delivery alignment with sibling repositories such as MaplatTransform and MaplatTin.

## Decisions

- keep `src/` reserved for publishable library code
- place demo logic and resources under `demo/`
- keep root `index.html` as the GitHub Pages entry page
- use one Vite config with package mode and demo mode
- deploy the demo site to GitHub Pages under `/Atlas/`
- use a lightweight table plus full detail panel instead of a spreadsheet framework
- implement “all clicked points are within the CRS” by querying with the bbox enclosing all clicked points

## Consequences

- package and demo concerns stay separated without splitting into multiple projects
- the demo remains easy to host on GitHub Pages
- Atlas avoids gaining demo-only logic in the public runtime surface
- browser viability of the existing lookup path must be verified during implementation
