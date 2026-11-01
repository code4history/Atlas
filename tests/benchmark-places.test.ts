/**
 * The bundled benchmark places: the facts the provenance JSON states are checked here, so the
 * dataset can change only inside the documented range and with the documented fields.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface Place {
  category: string;
  name: string;
  lon: number;
  lat: number;
}

const PLACES = JSON.parse(
  readFileSync(new URL("../demo/data/benchmark-places.json", import.meta.url), "utf8"),
) as Place[];

const KNOWN_CATEGORIES = new Set(["mountain-summit", "extreme-point"]);

describe("benchmark places dataset", () => {
  it("holds every place inside the longitude and latitude range of Japan", () => {
    const outside = PLACES.filter(
      (place) => !(place.lon >= 122 && place.lon <= 154) || !(place.lat >= 20 && place.lat <= 46),
    );
    expect(outside).toEqual([]);
  });

  it("gives every place a name and a known category", () => {
    const unnamed = PLACES.filter(
      (place) => typeof place.name !== "string" || place.name.trim() === "",
    );
    expect(unnamed).toEqual([]);

    const unknown = PLACES.filter((place) => !KNOWN_CATEGORIES.has(place.category));
    expect(unknown).toEqual([]);
  });
});
