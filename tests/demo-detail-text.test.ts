import { describe, expect, it } from "vitest";

import { wktText } from "../demo/detail-text.ts";

describe("demo detail: WKT text", () => {
  it("shows the WKT2 text when the row has one", () => {
    expect(wktText({ wkt2: "PROJCRS[...]", definitionType: "projdb" })).toBe("PROJCRS[...]");
  });

  it("explains a missing WKT2 for a custom projection", () => {
    expect(wktText({ wkt2: null, definitionType: "custom" })).toBe("No WKT2 definition for this custom projection.");
    expect(wktText({ wkt2: null, definitionType: "user" })).toBe("No WKT2 definition for this user projection.");
  });

  it("does not call a proj.db row a custom projection when its WKT2 cannot be produced", () => {
    const text = wktText({ wkt2: null, definitionType: "projdb" });
    expect(text).not.toContain("custom");
    expect(text).toBe("WKT2 is not available for this proj.db entry in the bundled proj-wasm runtime.");
  });
});
