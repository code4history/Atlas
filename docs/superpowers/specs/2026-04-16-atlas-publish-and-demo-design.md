# Atlas Publish And Demo Design

## Summary

Atlas will adopt the same release and demo delivery pattern used by the related Maplat libraries:

- npm publishing through `pnpm publish` with public package metadata and prepublish verification
- a Vite-powered demo that runs locally with `pnpm run dev`
- GitHub Pages deployment of the demo from the repository root entry page

The demo must be designed from the GitHub Pages constraints first. Local `pnpm run dev` is a development aid, not the acceptance baseline. `src/` stays library-only, while demo UI code lives under `demo/`.

## Goals

- Make `@c4h/atlas` publishable to npmjs in the same style as sibling repositories.
- Make the public Atlas lookup runtime usable from both Node.js and browsers.
- Provide an interactive demo that matches the existing Maplat demo branding and deployment model.
- Keep demo implementation outside `src/`.
- Keep the public library API focused on CRS lookup rather than UI concerns.

## Non-Goals

- No ranking/scoring model beyond current candidate filtering.
- No spreadsheet framework or heavy UI dependency for the candidate table.
- No bespoke visual design that diverges from the existing Maplat family demos.
- No GitHub Pages dependency on `SharedArrayBuffer`, `COOP`, `COEP`, or `coi-serviceworker`.

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
  - emits a browser-capable Atlas runtime rather than a Node-only demo surrogate
- Demo mode: `vite` or `vite build`
  - emits the demo site to `dist-demo/`
  - uses root `index.html` plus `demo/crs-candidate-lookup.html`
  - sets `base` for GitHub Pages at `/Atlas/`

`package.json` will be aligned with sibling packages:

- `private: false`
- `publishConfig.access: public`
- repository metadata, bug tracker, homepage, keywords
- `dev`, `build:demo`, `prepublishOnly`

## Runtime Boundary

Atlas package publication and Atlas demo delivery use the same lookup implementation.

- `src/` remains the publishable Atlas library.
- The public Atlas lookup API must run in both Node.js and browser environments.
- Demo-only code under `demo/` is limited to UI wiring, rendering, and interaction state.
- Demo pages must call the public Atlas lookup API rather than reimplementing CRS filtering semantics in demo-local code.

This keeps UI concerns out of `src/` while preventing semantic drift between package usage and demo usage.

## Pages-First Runtime Rules

GitHub Pages is the acceptance environment for the demo.

- `pnpm run dev` is a development aid only.
- The demo must run on GitHub Pages without `SharedArrayBuffer`.
- The demo must not require `crossOriginIsolated`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, or `coi-serviceworker`.
- `proj-wasm` is intentionally used in single-threaded mode for demo compatibility.
- External OSM tiles are used directly, so the design must remain compatible with ordinary cross-origin image loading.

### Runtime Assets

The demo must use the same `proj-wasm` runtime assets that production package consumers rely on.

- `proj.db`
- `proj.ini`
- worker module(s)
- `proj-emscripten.js`
- `proj-emscripten.wasm`
- built-in custom projection JSON

These assets must be loaded through runtime-safe URLs rooted at `import.meta.env.BASE_URL`, so the same build works under `/Atlas/` on GitHub Pages.

The demo must not rely on substitute demo-only assets, origin-rooted `/assets/...` shortcuts, or ad hoc fetch rewrites that bypass the package’s real runtime behavior.

## Public API And URI Loading

Atlas must expose one public lookup surface for Node and browser callers.

- User-defined CRS resources are identified by URI, not raw filesystem path strings.
- Supported forms include `file:///...` for Node.js, `https://...` where remote loading is permitted, and `data:` URIs for tests or embedded payloads.
- Built-in custom projections are loaded with the same runtime-safe URL discipline as other package assets.

## Demo UX

### Layout

- Root `index.html` is a demo portal page, not a redirect stub.
- The portal follows the sibling repo pattern: dark header, short description, and a card grid. Atlas currently has one card leading to the CRS candidate lookup demo.
- The demo page follows the sibling shell pattern: dark header, compact control strip, main visualization area, and lower information area.
- The Atlas-specific main content is one slippy map plus a results section containing a candidate table and a detail panel.

The visual style will intentionally mirror the existing Maplat demo pages:

- dark blue header
- compact control row
- light gray page background
- white card-like panels
- simple hover/selection treatments

These are observable output requirements. Maintainer-local tools or skills may help produce them, but the spec constrains the rendered output itself.

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
- `Include custom projections` toggle
- `Clear` button

Control changes trigger immediate re-query.

### Map Interaction

- The map must be a real slippy map. Fixed grid boards or pseudo-map canvases are not allowed.
- `Leaflet` with external OSM tiles is the intended implementation shape.
- Clicking the map adds a marker at the clicked position.
- The active query extent is recalculated from all current markers.
- The active query bbox is itself visible on the map.
- CRS candidates are refreshed after each marker add, clear action, or filter change.
- Selecting a CRS row draws that CRS bbox as a rectangle on the map.
- `Clear` removes all markers, the query bbox, and the selected CRS rectangle, resets the result state, and clears the selected detail panel.

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

The UI must also expose distinct empty, loading, zero-result, and error states.

## Search Logic

### Marker-To-Extent Conversion

- 0 markers: no query is run; the table stays empty and the detail panel stays unset.
- 1 marker: create a degenerate bbox at that point.
- 2 or more markers: create a min/max extent that encloses all markers.

### Candidate Lookup

The demo executes the public Atlas lookup API in the browser.

- `extent`: derived from current markers
- `includeDeprecated`: from UI toggle
- `onshoreOnly`: from UI toggle
- `area`: undefined when area filter is off
- `area`: selected country label or inferred auto area string when area filter is on
- `includeCustomProjections`: from UI toggle
- `userProjectionUri`: when custom user data is configured

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

The requested behavior is “show CRS candidates that within all current points.” This is implemented by converting all current points into one enclosing bbox and applying Atlas’s normal `bbox contains extent` semantics.

## Testing Strategy

### Library And Config

- add tests for package metadata expectations
- add tests for browser-capable package exports and URI-based resource loading
- add tests for Vite mode behavior that can be asserted without spinning up a browser
- keep current public API tests passing

### Demo Logic

Add focused tests for demo-local pure helpers under demo-local test coverage, such as:

- marker array to extent conversion
- supported-country auto-detection
- UI state to lookup options mapping

DOM-heavy visual behavior will be kept thin and verified manually unless a narrow jsdom test is cheap and stable.

### Build Artifact Verification

Static build verification must inspect the built artifact, not just source strings.

- the portal page resolves under `/Atlas/`
- the demo page resolves under `/Atlas/`
- runtime asset URLs resolve under `/Atlas/assets/`
- no runtime fetch path is rooted at `location.origin` or bare `/assets/`

### Manual Verification

- GitHub Pages-equivalent static serving shows the portal page
- navigating from portal to demo succeeds
- OSM tiles render
- clicking markers updates the query bbox and candidate rows
- filter toggles re-query correctly
- row selection paints the CRS bbox
- detail panel shows full `proj4` and `wkt2`
- `Clear` resets markers, bbox, selection, and state
- `pnpm run dev` starts the demo locally
- `pnpm run build`
- `pnpm run build:demo`
- GitHub Pages artifact serves correctly under `/Atlas/`

## Risks And Mitigations

- drift between demo behavior and library behavior: eliminate demo-local lookup semantics and route browser queries through the public API
- runtime asset URL mistakes under project-site base paths: verify built artifact URLs under `/Atlas/` explicitly
- accidental dependency on isolation headers during local dev: keep Pages compatibility as the acceptance baseline and treat dev headers as non-normative
- area-name substring mismatch: keep country mapping strings aligned with observed `areaName` values and cover them with narrow tests
- long WKT output making the page unwieldy: confine long fields to fixed-height scrollable panels

## Implementation Notes

- Follow sibling repositories for README structure and publish scripts rather than inventing Atlas-specific wording.
- Keep demo code under `demo/` even when helper logic is pure TypeScript.
- Keep root `index.html` as the landing page and link to `demo/crs-candidate-lookup.html`.
- Ensure demo runtime asset loading uses the same package-distributed `proj-wasm` assets that production usage depends on.
