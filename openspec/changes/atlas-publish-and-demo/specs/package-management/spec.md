## ADDED Requirements

### Requirement: Atlas Must Be Publishable To Public npm

Atlas MUST be configured so maintainers can publish the package to npmjs using the standard project workflow.

#### Scenario: Public package metadata is present

- **WHEN** a maintainer inspects `package.json`
- **THEN** the package is not marked private
- **AND** it declares public publish access
- **AND** it includes repository metadata consistent with the project family

#### Scenario: Publish verification runs before release

- **WHEN** a maintainer runs the prepublish workflow
- **THEN** Atlas runs the required verification commands before package publication

### Requirement: Atlas Must Provide A Public Lookup Runtime For Node And Browsers

Atlas MUST expose one public lookup runtime that can be used from both Node.js and browser environments.

#### Scenario: Browser execution avoids Node-only dependencies

- **WHEN** a browser caller uses the public Atlas lookup API
- **THEN** the runtime does not require direct use of Node-only modules such as `node:fs/promises` or `node:path`

#### Scenario: User-defined CRS resources are specified by URI

- **WHEN** a caller provides user-defined CRS resources
- **THEN** Atlas accepts URI-based resource identifiers rather than raw local path strings
- **AND** `file:///` URIs are supported in Node.js
- **AND** `https://` and `data:` URIs are supported where the runtime permits them

#### Scenario: Package-distributed runtime assets are used in browsers

- **WHEN** a browser caller uses the public Atlas lookup API
- **THEN** Atlas resolves `proj-wasm` runtime assets from the package-distributed files
- **AND** the browser path does not depend on demo-only substitute assets

### Requirement: Atlas Must Provide Bilingual Package Documentation

Atlas MUST provide package documentation in English and Japanese following the documentation pattern used by sibling repositories.

#### Scenario: README variants are available

- **WHEN** a user opens the repository
- **THEN** `README.md` exists in English
- **AND** `README.ja.md` exists in Japanese
- **AND** each README links to the other language variant
