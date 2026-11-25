/**
 * In a browser Atlas points proj-wasm's own requests for its runtime files at
 * `projWasmAssetBaseUrl`. It does so only while the runtime starts: the page's `fetch` is the
 * page's own again afterwards.
 *
 * proj-wasm is replaced by a fake whose `init` requests the files the real one requests, and a
 * `document` is defined so Atlas takes the browser path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  init: undefined as undefined | (() => Promise<void>),
}));

vi.mock("proj-wasm", () => ({
  init: async () => fake.init?.(),
}));

const ASSET_BASE = "https://static.example.invalid/atlas-assets/";
const BUNDLED = "https://app.example.invalid/node_modules/proj-wasm/dist/";

type FetchInput = Parameters<typeof fetch>[0];

function href(input: FetchInput): string {
  return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

const originalFetch = globalThis.fetch;
let requested: string[];
let pageFetch: typeof fetch;

beforeEach(() => {
  vi.resetModules();
  requested = [];
  pageFetch = (async (input: FetchInput) => {
    requested.push(href(input));
    return new Response("", { headers: { "content-length": "2000000" } });
  }) as typeof fetch;
  globalThis.fetch = pageFetch;
  (globalThis as { document?: unknown }).document = {};
  fake.init = async () => {
    await fetch(`${BUNDLED}proj.db`);
    await fetch(`${BUNDLED}proj.ini`);
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as { document?: unknown }).document;
  delete (globalThis as { __ATLAS_PROJ_WASM_ASSET_BASE_URL__?: unknown }).__ATLAS_PROJ_WASM_ASSET_BASE_URL__;
});

async function startRuntime(): Promise<void> {
  const { initializeProjWasmRuntime } = await import("../src/proj-wasm-crs.ts");
  await initializeProjWasmRuntime({ projWasmAssetBaseUrl: ASSET_BASE });
}

describe("the page's fetch while and after the runtime starts", () => {
  it("points the runtime's own requests at the asset base while it starts", async () => {
    await startRuntime();
    expect(requested).toEqual([`${ASSET_BASE}proj.db`, `${ASSET_BASE}proj.ini`]);
  });

  it("gives the page its own fetch back once the runtime has started", async () => {
    await startRuntime();
    expect(globalThis.fetch).toBe(pageFetch);

    requested.length = 0;
    await fetch("https://api.example.invalid/downloads/proj.db");
    await fetch("https://api.example.invalid/config/proj.ini");
    expect(requested).toEqual([
      "https://api.example.invalid/downloads/proj.db",
      "https://api.example.invalid/config/proj.ini",
    ]);
  });

  it("gives the page its own fetch back when the runtime fails to start", async () => {
    fake.init = async () => {
      await fetch(`${BUNDLED}proj.ini`);
      throw new Error("start-up failed (simulated)");
    };
    await expect(startRuntime()).rejects.toThrow("start-up failed (simulated)");
    expect(globalThis.fetch).toBe(pageFetch);
  });

  it("leaves a fetch the page installed meanwhile in place, and stops redirecting through it", async () => {
    let pageWrapper: typeof fetch | undefined;
    fake.init = async () => {
      const inner = globalThis.fetch;
      pageWrapper = ((input: FetchInput, init?: RequestInit) => inner(input, init)) as typeof fetch;
      globalThis.fetch = pageWrapper;
      await fetch(`${BUNDLED}proj.ini`);
    };
    await startRuntime();
    expect(globalThis.fetch).toBe(pageWrapper);

    requested.length = 0;
    await fetch("https://api.example.invalid/downloads/proj.db");
    expect(requested).toEqual(["https://api.example.invalid/downloads/proj.db"]);
  });
});
