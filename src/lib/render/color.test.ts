import { describe, it, expect } from "vitest";
import { wavelengthToRGB, rgbToHex } from "./color";

describe("wavelengthToRGB", () => {
  it("maps ~680nm to a red-dominant color", () => {
    const c = wavelengthToRGB(6800); // 680 nm
    expect(c.r).toBeGreaterThan(c.b);
    expect(c.r).toBeGreaterThan(c.g);
  });

  it("maps ~470nm to a blue-dominant color", () => {
    const c = wavelengthToRGB(4700); // 470 nm
    expect(c.b).toBeGreaterThan(c.r);
  });

  it("maps ~530nm to a green-dominant color", () => {
    const c = wavelengthToRGB(5300); // 530 nm
    expect(c.g).toBeGreaterThanOrEqual(c.r);
    expect(c.g).toBeGreaterThan(c.b);
  });

  it("returns channels in [0,255]", () => {
    for (const wl of [3000, 3800, 5500, 7000, 9000]) {
      const c = wavelengthToRGB(wl);
      for (const ch of [c.r, c.g, c.b]) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });

  it("is deterministic", () => {
    expect(wavelengthToRGB(5500)).toEqual(wavelengthToRGB(5500));
  });
});

describe("rgbToHex", () => {
  it("formats as #rrggbb", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 16 })).toBe("#ff0010");
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
  });
});
