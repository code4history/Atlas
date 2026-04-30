## ADDED Requirements

### Requirement: Atlas Demo Must Be Publishable To GitHub Pages

Atlas MUST provide an automated deployment path for the demo site through GitHub Actions and GitHub Pages.

#### Scenario: Demo build output is generated for Pages

- **WHEN** CI builds the demo site
- **THEN** the build emits a static site artifact suitable for GitHub Pages deployment
- **AND** the generated paths work under the `/Atlas/` base path
- **AND** the generated artifact resolves portal page, demo page, modules, worker modules, wasm, `proj.db`, and related runtime assets under that base path

#### Scenario: Demo deployment is automated

- **WHEN** the configured deployment workflow runs on the main branch
- **THEN** GitHub Actions publishes the current demo build to GitHub Pages

#### Scenario: Pages verification is stronger than source-string checks

- **WHEN** CI verifies GitHub Pages compatibility
- **THEN** it checks built artifact behavior or built asset URLs rather than only checking for configuration strings in source files

#### Scenario: Pages deployment does not depend on isolation-only headers

- **WHEN** GitHub Pages serves the built demo
- **THEN** the accepted design does not depend on custom `COOP` or `COEP` response headers being injected at deploy time
