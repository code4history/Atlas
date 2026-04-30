## ADDED Requirements

### Requirement: Atlas Must Provide A GitHub Pages-Compatible Demo Site

Atlas MUST provide a demo site that runs through local Vite development and works on GitHub Pages under the `/Atlas/` base path. GitHub Pages compatibility is the acceptance baseline.

#### Scenario: Demo code is separated from library code

- **WHEN** a maintainer inspects the repository structure
- **THEN** demo implementation code is stored outside `src/`
- **AND** the repository root keeps `index.html` as the demo entry page

#### Scenario: Demo portal is a real landing page

- **WHEN** a user opens the demo root page
- **THEN** the root page presents a portal-style landing page within the sibling demo visual language
- **AND** the root page is not a bare redirect stub

#### Scenario: Demo uses the public Atlas lookup runtime

- **WHEN** a maintainer inspects the demo architecture
- **THEN** browser-executed lookup uses the public Atlas package runtime
- **AND** demo-only code is limited to UI wiring and presentation concerns

#### Scenario: Demo uses a slippy map rather than a pseudo-map board

- **WHEN** a user opens the CRS candidate lookup demo
- **THEN** the primary map area is a real slippy map with pan and zoom interaction
- **AND** it is not replaced by a fixed grid or pseudo-map board

#### Scenario: Marker clicks drive CRS candidate lookup

- **WHEN** a user clicks one or more points on the demo map
- **THEN** the demo derives an enclosing geographic extent from all current markers
- **AND** the active query bbox is visible on the map
- **AND** Atlas lookup runs against that extent
- **AND** the candidate table updates to reflect the current marker set

#### Scenario: Selecting a CRS reveals full details

- **WHEN** a user selects a CRS from the candidate table
- **THEN** the demo draws the CRS extent rectangle on the map
- **AND** the demo displays the selected CRS details including full projection text and full WKT text without semantic truncation

#### Scenario: Clearing the query resets the demo state

- **WHEN** a user activates the clear control
- **THEN** all markers are removed
- **AND** the active query bbox is removed
- **AND** any selected CRS overlay is removed
- **AND** the candidate table and detail panel return to the empty state

### Requirement: Atlas Demo Must Support Area Filter Controls

The demo MUST support the requested area-filter workflow.

#### Scenario: Control changes trigger immediate re-query

- **WHEN** the user changes a supported filter control
- **THEN** the demo immediately refreshes the candidate query against the current marker set

#### Scenario: Area filter is disabled

- **WHEN** the area filter toggle is off
- **THEN** Atlas lookup is executed without an area filter string

#### Scenario: Area filter uses auto country detection

- **WHEN** the area filter toggle is on and the area selector is set to auto
- **AND** the first marker falls inside one of the supported country bounds
- **THEN** the demo applies the corresponding area filter string for that country

#### Scenario: Area filter uses an explicit country

- **WHEN** the area filter toggle is on and the user selects United States, Japan, Korea, or China
- **THEN** the demo applies the corresponding area filter string for Atlas lookup

#### Scenario: Deprecated and onshore toggles are available

- **WHEN** a user inspects the demo controls
- **THEN** the UI exposes `Deprecated` and `Onshore only` toggles
- **AND** their values are reflected in the Atlas lookup request

#### Scenario: Built-in custom projection inclusion is controllable

- **WHEN** a user inspects the demo controls
- **THEN** the UI exposes whether built-in custom projections are included
- **AND** the selected value is reflected in the Atlas lookup request

### Requirement: Atlas Demo Must Expose Result And Error States

The demo MUST make the query lifecycle visible to the user.

#### Scenario: Empty, loading, zero-result, and error states are distinguishable

- **WHEN** the demo is respectively idle, querying, returning no candidates, or failing
- **THEN** each state is visible through distinct UI feedback

### Requirement: Atlas Demo Must Stay Within The Code for History Demo Visual Language

Atlas demo pages MUST visually align with sibling Code for History demo pages while keeping the boilerplate-generation workflow local to maintainers.

#### Scenario: Demo shell matches shared visual language

- **WHEN** a maintainer inspects the Atlas demo entry page or demo screen
- **THEN** the page uses the shared dark header, light background, white card panels, and compact control-strip patterns
- **AND** these patterns are treated as observable output requirements rather than as a mandatory checked-in shared asset bundle

### Requirement: Atlas Demo Must Use Pages-Compatible Runtime Constraints

Atlas demo pages MUST remain compatible with GitHub Pages and external OSM tiles.

#### Scenario: Pages runtime does not require isolation-only browser features

- **WHEN** the demo runs on GitHub Pages
- **THEN** it does not require `SharedArrayBuffer`
- **AND** it does not require `crossOriginIsolated`
- **AND** it does not require `COOP`, `COEP`, or `coi-serviceworker`

#### Scenario: Runtime assets resolve from the project-site base path

- **WHEN** the GitHub Pages build is served from `/Atlas/`
- **THEN** `proj.db`, `proj.ini`, worker modules, wasm modules, and other runtime assets are resolved from the configured base path
- **AND** the demo does not use origin-rooted `/assets/...` fetches

#### Scenario: Demo uses production runtime assets

- **WHEN** the browser demo loads `proj-wasm` support files
- **THEN** it uses the same package-distributed runtime files intended for real Atlas usage
- **AND** it does not rely on substitute demo-only runtime payloads
