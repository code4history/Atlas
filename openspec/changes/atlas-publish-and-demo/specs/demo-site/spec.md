## ADDED Requirements

### Requirement: Atlas Must Provide A Local Demo Site

Atlas MUST provide a demo site that runs locally through the standard Vite development workflow.

#### Scenario: Demo code is separated from library code

- **WHEN** a maintainer inspects the repository structure
- **THEN** demo implementation code is stored outside `src/`
- **AND** the repository root keeps `index.html` as the demo entry page

#### Scenario: Marker clicks drive CRS candidate lookup

- **WHEN** a user clicks one or more points on the demo map
- **THEN** the demo derives an enclosing geographic extent from all current markers
- **AND** Atlas candidate lookup runs against that extent
- **AND** the candidate table updates to reflect the current marker set

#### Scenario: Selecting a CRS reveals full details

- **WHEN** a user selects a CRS from the candidate table
- **THEN** the demo draws the CRS extent rectangle on the map
- **AND** the demo displays the selected CRS details including full projection text and full WKT text without semantic truncation

#### Scenario: Clearing the query resets the demo state

- **WHEN** a user activates the clear control
- **THEN** all markers are removed
- **AND** any selected CRS overlay is removed
- **AND** the candidate table and detail panel return to the empty state

### Requirement: Atlas Demo Must Support Area Filter Controls

The demo MUST support the requested area-filter workflow.

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
