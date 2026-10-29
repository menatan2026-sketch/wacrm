import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCss } from "../scripts/build-css";
import { CONTRAST_PAIRS, contrastRatio, themes } from "../src/index";

describe("design tokens", () => {
  for (const theme of ["light", "dark"] as const) {
    it.each(CONTRAST_PAIRS)(`${theme}: $fg on $bg meets $min:1`, ({ fg, bg, min }) => {
      const ratio = contrastRatio(themes[theme][fg]!, themes[theme][bg]!);
      expect(ratio, `${fg}/${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    });
  }

  it("defines the same roles in both themes", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it("generated CSS is up to date (run scripts/build-css.ts)", () => {
    expect(readFileSync(new URL("../src/tokens.css", import.meta.url), "utf8")).toBe(buildCss());
  });
});
