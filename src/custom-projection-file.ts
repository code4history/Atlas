import { isUsableDefinition } from "./definition-guard.ts";
import type { CustomProjectionDefinition } from "./proj-wasm-crs.ts";

/** The largest projection definition resource that is read, in bytes (and in characters of text). */
export const MAX_PROJECTION_RESOURCE_BYTES = 8 * 1024 * 1024;
/** How long a projection definition resource may take to arrive over HTTP(S). */
const PROJECTION_RESOURCE_TIMEOUT_MS = 30_000;
/** The longest resource description put into an error message. */
const MAX_DESCRIPTION_LENGTH = 200;

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * How a resource is named in error messages: scheme, host and path only. Credentials, the query
 * string and the fragment of a URL are left out, and so is the content of a `data:` URL.
 */
function describeResource(url: URL): string {
  if (url.protocol === "data:") return "data: URL";
  const text = url.protocol === "file:" ? `file://${url.pathname}` : `${url.protocol}//${url.host}${url.pathname}`;
  return text.length > MAX_DESCRIPTION_LENGTH ? `${text.slice(0, MAX_DESCRIPTION_LENGTH)}...` : text;
}

function tooLarge(url: URL): Error {
  return new Error(
    `Projection resource ${describeResource(url)} is too large (the limit is ${MAX_PROJECTION_RESOURCE_BYTES} bytes)`,
  );
}

/**
 * A caller-given resource may be `data:`, `file:` or `https:`. Plain `http:` is read only from
 * this machine (localhost) or, in a browser, from the page's own origin.
 */
function assertAllowedLocation(url: URL): void {
  if (url.protocol === "data:" || url.protocol === "file:" || url.protocol === "https:") return;
  if (url.protocol === "http:") {
    if (LOOPBACK_HOSTNAMES.has(url.hostname)) return;
    const pageOrigin = (globalThis as { location?: { origin?: string } }).location?.origin;
    if (typeof pageOrigin === "string" && pageOrigin === url.origin) return;
  }
  throw new Error(
    `Projection resource ${describeResource(url)} is not allowed: use a data:, file: or https: URL ` +
    "(http: only for localhost or the page's own origin)",
  );
}

function decodeDataUrl(url: URL): string {
  const href = url.href;
  if (href.length > MAX_PROJECTION_RESOURCE_BYTES * 2) throw tooLarge(url);

  const comma = href.indexOf(",");
  if (comma < 0) throw new Error("Unsupported data URL for a projection resource");
  const isBase64 = href.slice(0, comma).endsWith(";base64");
  const payload = href.slice(comma + 1);

  if (isBase64) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(payload, "base64").toString("utf8");
    }
    const binary = atob(payload);
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  }

  return decodeURIComponent(payload);
}

async function readResponseText(response: Response, url: URL): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_PROJECTION_RESOURCE_BYTES) throw tooLarge(url);

  const reader = response.body?.getReader?.();
  if (reader === undefined) return response.text();

  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_PROJECTION_RESOURCE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge(url);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchText(url: URL): Promise<string> {
  const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(PROJECTION_RESOURCE_TIMEOUT_MS)
    : undefined;
  let response: Response;
  try {
    response = await fetch(url, signal === undefined ? undefined : { signal });
  } catch {
    // The reason given by `fetch` can repeat the full URL; keep it out of the message.
    throw new Error(`Failed to load projection resource ${describeResource(url)}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to load projection resource ${describeResource(url)}: HTTP ${response.status}`);
  }
  return readResponseText(response, url);
}

async function readFileText(url: URL): Promise<string> {
  const nodeFsPromises = "node:fs/promises";
  const { readFile, stat } = await import(/* @vite-ignore */ nodeFsPromises) as typeof import("node:fs/promises");
  const info = await stat(url);
  if (!info.isFile()) throw new Error(`Projection resource ${describeResource(url)} is not a regular file`);
  if (info.size > MAX_PROJECTION_RESOURCE_BYTES) throw tooLarge(url);
  return readFile(url, "utf8");
}

async function loadTextResource(url: URL): Promise<string> {
  if (url.protocol === "data:") return decodeDataUrl(url);
  if (url.protocol !== "file:" && typeof fetch === "function") return fetchText(url);
  return readFileText(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * One row of a projection file, checked and copied field by field. A row that is not usable gives
 * `null` and is skipped by the caller, so one bad row does not stop the search:
 *
 * - `authority`, `code` and `name` must be non-empty strings.
 * - `bbox` must have four finite numbers (`west`, `south`, `east`, `north`).
 * - `proj4` and `pipeline`, when present, must be definitions Atlas may hand to PROJ
 *   (see `isUsableDefinition`), and at least one of them must be present.
 * - `areaName` (default `""`), `deprecated` (default `false`), `wkt2`, `isApproximate` and `source`
 *   must have their documented types when present.
 * - `unit` is passed on as it is; a row whose `unit` is not a valid linear unit stays in the
 *   result and is untransformable (the transformation gives `null`).
 */
function readDefinition(value: unknown): CustomProjectionDefinition | null {
  if (!isRecord(value)) return null;
  const { authority, code, name, bbox, proj4, pipeline, areaName, deprecated, wkt2, isApproximate, source, unit } = value;

  if (!isNonEmptyString(authority) || !isNonEmptyString(code) || !isNonEmptyString(name)) return null;

  if (!isRecord(bbox)) return null;
  const { west, south, east, north } = bbox;
  for (const edge of [west, south, east, north]) {
    if (typeof edge !== "number" || !Number.isFinite(edge)) return null;
  }

  if (proj4 !== undefined && !isUsableDefinition(proj4)) return null;
  if (pipeline !== undefined && !isUsableDefinition(pipeline)) return null;
  if (proj4 === undefined && pipeline === undefined) return null;

  if (areaName !== undefined && typeof areaName !== "string") return null;
  if (deprecated !== undefined && typeof deprecated !== "boolean") return null;
  if (wkt2 !== undefined && wkt2 !== null && typeof wkt2 !== "string") return null;
  if (isApproximate !== undefined && typeof isApproximate !== "boolean") return null;
  if (source !== undefined && !(Array.isArray(source) && source.every((entry) => typeof entry === "string"))) {
    return null;
  }

  return {
    authority,
    code,
    name,
    areaName: areaName ?? "",
    deprecated: deprecated ?? false,
    bbox: { west: west as number, south: south as number, east: east as number, north: north as number },
    ...(proj4 === undefined ? {} : { proj4 }),
    ...(pipeline === undefined ? {} : { pipeline }),
    ...(wkt2 === undefined ? {} : { wkt2 }),
    ...(isApproximate === undefined ? {} : { isApproximate }),
    ...(source === undefined ? {} : { source: [...(source as string[])] }),
    ...(unit === undefined ? {} : { unit: unit as CustomProjectionDefinition["unit"] }),
  };
}

/**
 * Loads a projection definition file: a JSON array of rows, or an object with such an array in
 * `projections`. Rows that are not usable are skipped (see `readDefinition`).
 *
 * `trusted` is for the file bundled with Atlas, which is read from wherever the package is served.
 * A caller-given resource must be at an allowed location (see `assertAllowedLocation`).
 *
 * Error messages name the resource without credentials, query string or content.
 */
export async function loadCustomProjectionFile(
  resource: string | URL,
  options: { trusted?: boolean } = {},
): Promise<CustomProjectionDefinition[]> {
  let url: URL;
  try {
    url = typeof resource === "string" ? new URL(resource, import.meta.url) : resource;
  } catch {
    throw new Error("The projection resource is not a valid URL or path");
  }
  if (!options.trusted) assertAllowedLocation(url);

  const raw = await loadTextResource(url);
  if (raw.length > MAX_PROJECTION_RESOURCE_BYTES) throw tooLarge(url);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // The parser's own message quotes the text around the error.
    throw new Error(`Projection resource ${describeResource(url)} is not valid JSON`);
  }

  const rows = Array.isArray(parsed) ? parsed : isRecord(parsed) ? parsed.projections : undefined;
  if (!Array.isArray(rows)) {
    throw new Error(
      `Projection resource ${describeResource(url)} must be an array of projection definitions, ` +
      "or an object with that array in `projections`",
    );
  }

  const definitions: CustomProjectionDefinition[] = [];
  for (const row of rows) {
    const definition = readDefinition(row);
    if (definition !== null) definitions.push(definition);
  }
  return definitions;
}
