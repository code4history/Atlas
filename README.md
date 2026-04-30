# Atlas

[![CI](https://github.com/code4history/Atlas/actions/workflows/test.yml/badge.svg)](https://github.com/code4history/Atlas/actions/workflows/test.yml)

Candidate CRS lookup for Maplat V3.1, usable from Node.js and browser runtimes.
Atlas searches `proj.db` through `proj-wasm` and can optionally merge JSON-defined custom projections such as UTJCP historical zones.

日本語のREADMEは[こちら](./README.ja.md)。

## Features

- Lookup projected CRS candidates from a geographic extent
- Filter by area string, deprecated flag, and onshore-only preference
- Apply configurable bbox padding during containment tests
- Merge built-in or user-provided JSON projection definitions
- Keep browser demo logic outside the published package surface

## Requirements

- Node.js >= 20
- pnpm >= 10 for development

## Installation

### pnpm

```sh
pnpm add @c4h/atlas
```

### npm

```sh
npm install @c4h/atlas
```

## Basic Usage

```ts
import { listProjectedCrsFromProjWasm } from "@c4h/atlas";

const rows = await listProjectedCrsFromProjWasm({
  extent: { west: 135.4, south: 34.55, east: 135.65, north: 34.8 },
  area: "Japan",
  onshoreOnly: true,
});

console.log(rows.map((row) => row.id));
```

## Development

- `pnpm run dev`: start the local demo site
- `pnpm run build`: build the published package into `dist/`
- `pnpm run build:demo`: build the GitHub Pages demo into `dist-demo/`
- `pnpm run verify:demo`: build and verify the GitHub Pages artifact
- `pnpm run test`: run the Vitest suite

## Publish

`pnpm publish` is guarded by `prepublishOnly`, which runs:

- `pnpm run test`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run verify:demo`

## Demo

- Root portal: `index.html`
- Demo app: `demo/crs-candidate-lookup.html`
- GitHub Pages target: `https://code4history.github.io/Atlas/`

## License

Maplat Limited License 1.1
