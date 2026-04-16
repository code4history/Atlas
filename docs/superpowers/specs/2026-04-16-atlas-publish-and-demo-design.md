# Atlas Publish And Demo Design

## Summary

Atlas will adopt the same release and demo delivery pattern used by the related Maplat libraries:

- npm publishing through `pnpm publish` with public package metadata and prepublish verification
- a Vite-powered demo that runs locally with `pnpm run dev`
- GitHub Pages deployment of the demo from the repository root entry page

The library runtime remains separate from the demo runtime. `src/` stays package-only. Demo code lives under `demo/`, with only `index.html` at repository root as the GitHub Pages entry point.

## Goals

- Make `@c4h/atlas` publishable to npmjs in the same style as sibling repositories.
- Provide an interactive demo that matches the existing Maplat demo branding and deployment model.
- Keep demo implementation outside `src/`.
- Keep the public library API focused on CRS lookup rather than UI concerns.

## Non-Goals

- No browser-first public Atlas API in this change.
- No ranking/scoring model beyond current candidate filtering.
- No spreadsheet framework or heavy UI dependency for the candidate table.
- No bespoke visual design that diverges from the existing Maplat family demos.

## Repository Structure

- `src/`: publishable Atlas library code only
- `demo/`: Atlas demo application code, helpers, and any demo-only styling
- `index.html`: demo portal page at repository root
- `README.md`: English package README
- `README.ja.md`: Japanese package README
- `.github/workflows/`: CI and GitHub Pages deployment workflows

## Build And Release Architecture

Atlas will use one Vite config with two modes.

- Package mode: `BUILD_MODE=package vite build`
  - emits library artifacts to `dist/`
  - excludes demo entry points
  - preserves current externalization behavior for `proj-wasm` and Node-only dependencies
- Demo mode: `vite` or `vite build`
  - emits the demo site to `dist-demo/`
  - uses root `index.html` plus `demo/atlas.html`
  - sets `base` for GitHub Pages at `/Atlas/`

`package.json` will be aligned with sibling packages:

- `private: false`
- `publishConfig.access: public`
- repository metadata, bug tracker, homepage, keywords
- `dev`, `build:demo`, `deploy`, `prepublishOnly`, `publish:npm`, `publish:npm:dry`

## Runtime Boundary

Atlas package publication and Atlas demo delivery intentionally use different runtime boundaries.

- `src/` remains the publishable Atlas library and stays Node-only.
- The npm package is not required to become browser-capable in this change.
- Browser execution for `pnpm run dev` and GitHub Pages is handled by a demo-only adapter under `demo/`.
- The demo adapter is responsible for browser-safe asset loading, candidate-data preparation, and lookup execution needed by the demo UI.

This separation is deliberate. It preserves the package design for `pnpm publish` while avoiding demo-specific browser concerns in the public library surface.

## Demo UX

### Layout

- Top area: Leaflet map and search controls
- Bottom-left: candidate CRS table
- Bottom-right or bottom-full-width: selected CRS detail panel

The visual style will intentionally mirror the existing Maplat demo pages:

- dark blue header
- compact control row
- light gray page background
- white card-like panels
- simple hover/selection treatments

### Controls

- `Deprecated` toggle
- `Onshore only` toggle
- `Area filter` toggle
- `Area` select with:
  - `Auto`
  - `United States`
  - `Japan`
  - `Korea`
  - `China`
- `Include custom projections` toggle if supported in demo scope
- `Clear` button

### Map Interaction

- Clicking the map adds a marker at the clicked position.
- The active query extent is recalculated from all current markers.
- CRS candidates are refreshed after each marker add, clear action, or filter change.
- Selecting a CRS row draws that CRS bbox as a rectangle on the map.
- `Clear` removes all markers and the selected CRS rectangle, resets the result state, and clears the selected detail panel.

### Table

The table is intentionally narrow and lightweight.

- Columns: `ID`, `Name`
- sticky header
- single-row selection
- no client-side sort in this change

### Detail Panel

The detail panel shows the full selected CRS record without truncating semantic content:

- `id`
- `authority`
- `code`
- `name`
- `areaName`
- `deprecated`
- `definitionType`
- `isApproximate`
- `bbox`
- `proj4` / projection text
- `pipeline` when present
- `wkt2`
- `source`

Long text values are shown in scrollable `<pre>` blocks so the user can inspect full definitions.

## Search Logic

### Marker-To-Extent Conversion

- 0 markers: no query is run; the table stays empty and the detail panel stays unset.
- 1 marker: create a degenerate bbox at that point.
- 2 or more markers: create a min/max extent that encloses all markers.

### Candidate Lookup

The demo will not directly execute the Node-only Atlas package entrypoint in the browser.

Instead, the demo will use a browser-focused adapter under `demo/` that mirrors Atlas lookup semantics for the subset of behavior needed by the demo.

- `extent`: derived from current markers
- `includeDeprecated`: from UI toggle
- `onshoreOnly`: from UI toggle
- `area`: undefined when area filter is off
- `area`: selected country label or inferred auto area string when area filter is on

The adapter must preserve Atlas-compatible filtering behavior:

- candidate bbox contains extent
- optional area substring filtering
- optional deprecated inclusion
- optional onshore-only filtering

### Area Filter

When the area filter is on:

- `Auto` infers the area from the first marker’s country
- explicit options map to area strings suitable for the current `areaName` substring filter

The demo will use a lightweight reverse-geocoding helper based on static geographic bounds for the supported countries, not a remote geocoding service. This avoids network coupling in local dev and GitHub Pages.

The supported auto-detection set is intentionally limited to:

- United States
- Japan
- Korea
- China

If the first marker is outside those coarse bounds, `Auto` falls back to no area string rather than guessing.

### Within Semantics

The requested behavior is “show CRS candidates that within all current points.” In this design, that is implemented by converting all current points into one enclosing bbox and reusing Atlas’s existing `bbox contains extent` semantics. This matches the current package boundary and avoids adding point-by-point demo-only filtering logic to the public API.

## Testing Strategy

### Library And Config

- add tests for package metadata expectations
- add tests for Vite mode behavior that can be asserted without spinning up a browser
- keep current public API tests passing

### Demo Logic

Add focused tests for demo-only pure helpers under demo-local test coverage, such as:

- marker array to extent conversion
- supported-country auto-detection
- UI state to lookup options mapping

DOM-heavy visual behavior will be kept thin and verified manually unless a narrow jsdom test is cheap and stable.

### Manual Verification

- `pnpm run dev` starts the demo locally
- clicking markers updates candidate rows
- filter toggles re-query correctly
- row selection paints the bbox rectangle
- detail panel shows full `proj4` and `wkt2`
- `pnpm run build`
- `pnpm run build:demo`
- GitHub Pages artifact serves correctly under `/Atlas/`

## Risks And Mitigations

- divergence between Node package behavior and demo adapter behavior: keep filtering semantics shared conceptually and cover the demo adapter with focused tests around extent containment and UI-to-query mapping.
- area-name substring mismatch: keep country mapping strings aligned with observed `areaName` values and cover them with narrow tests.
- long WKT output making the page unwieldy: confine long fields to fixed-height scrollable panels.

## Implementation Notes

- Follow sibling repositories for README structure and publish scripts rather than inventing Atlas-specific wording.
- Keep demo code under `demo/` even when helper logic is pure TypeScript.
- Keep root `index.html` as the landing page and link to `demo/atlas.html`.
