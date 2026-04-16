## ADDED Requirements

### Requirement: Atlas Demo Must Be Publishable To GitHub Pages

Atlas MUST provide an automated deployment path for the demo site through GitHub Actions and GitHub Pages.

#### Scenario: Demo build output is generated for Pages

- **WHEN** CI builds the demo site
- **THEN** the build emits a static site artifact suitable for GitHub Pages deployment
- **AND** the generated paths work under the `/Atlas/` base path

#### Scenario: Demo deployment is automated

- **WHEN** the configured deployment workflow runs on the main branch
- **THEN** GitHub Actions publishes the current demo build to GitHub Pages
