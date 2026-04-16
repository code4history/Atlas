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

### Requirement: Atlas Must Provide Bilingual Package Documentation

Atlas MUST provide package documentation in English and Japanese following the documentation pattern used by sibling repositories.

#### Scenario: README variants are available

- **WHEN** a user opens the repository
- **THEN** `README.md` exists in English
- **AND** `README.ja.md` exists in Japanese
- **AND** each README links to the other language variant

### Requirement: Atlas Published Package May Remain Node-Only

The Atlas package published to npmjs MAY remain Node-only for this change.

#### Scenario: Publish configuration does not promise browser runtime support

- **WHEN** a maintainer reviews the package design for this change
- **THEN** the publishable package is allowed to target Node.js only
- **AND** browser demo support is not required to come from the published package entrypoint
