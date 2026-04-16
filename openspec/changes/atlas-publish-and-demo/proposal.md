# Change: Standardize Atlas Publish And Demo Delivery

## Why

Atlas is functionally close to release, but it does not yet match the packaging and demo delivery standards used by sibling Maplat repositories. That leaves npm publication and GitHub Pages demo delivery inconsistent across the project family.

## What Changes

- make Atlas publishable to npmjs with `pnpm publish`
- add bilingual package documentation aligned with sibling repositories
- add a local Vite demo and GitHub Pages deployment flow
- keep demo implementation outside `src/`

## Impact

- Affected specs: `package-management`, `demo-site`, `ci-cd`
- Affected code: `package.json`, `vite.config.ts`, root `index.html`, `demo/**`, `README.md`, `README.ja.md`, GitHub Actions workflows
