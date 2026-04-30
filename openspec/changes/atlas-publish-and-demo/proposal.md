# Change: Standardize Atlas Publish And Demo Delivery

## Why

Atlas is functionally close to release, but its publish story, browser story, and demo delivery story are still inconsistent. The current state allows demos that work in local Vite development while failing under the stricter constraints of GitHub Pages, and it leaves too much room for demo-only behavior that diverges from the public Atlas runtime.

## What Changes

- make Atlas publishable to npmjs with `pnpm publish`
- make the public Atlas lookup runtime usable from browsers as well as Node.js
- add bilingual package documentation aligned with sibling repositories
- add a local Vite demo and GitHub Pages deployment flow
- keep demo implementation outside `src/`
- make GitHub Pages compatibility the acceptance baseline for the demo
- require the demo to use the package’s real `proj-wasm` runtime assets and public lookup semantics
- require a slippy-map UI aligned with the sibling demo visual language

## Impact

- Affected specs: `candidate-crs-catalog`, `package-management`, `demo-site`, `ci-cd`
- Affected code: `package.json`, `vite.config.ts`, `src/**`, root `index.html`, `demo/**`, `README.md`, `README.ja.md`, GitHub Actions workflows
