import { describe, it, expect } from "vitest";
import { buildScene } from "./scene";
import type { AnalysisResult } from "@/lib/spectra/analyze";

function fakeAnalysis(): AnalysisResult {
  return {
    normalized: Float64Array.from([1, 1, 1]),
    lines: [
      { lambda: 6562.8, level: 1.8, kind: "emission", match: null },
      { lambda: 4861.3, level: 0.4, kind: "absorption", match: null },
      { lambda: 5006.8, level: 2.2, kind: "emission", match: null },
    ],
    fingerprint: [
      { element: "H", label: "Hα", restLambda: 6562.8, observedLambda: 6562.8, kind: "emission" },
    ],
  };
}

describe("buildScene", () => {
  it("creates one ring per detected line", () => {
    const scene = buildScene(fakeAnalysis(), { size: 720 });
    expect(scene.rings).toHaveLength(3);
  });

  it("uses a square canvas of the requested size", () => {
    const scene = buildScene(fakeAnalysis(), { size: 720 });
    expect(scene.width).toBe(720);
    expect(scene.height).toBe(720);
  });

  it("assigns stronger lines a heavier stroke", () => {
    const scene = buildScene(fakeAnalysis(), { size: 720 });
    // Line 3 (level 2.2 -> strength 1.2) is stronger than line 2 (0.6).
    const byStrength = [...scene.rings].sort((a, b) => b.strength - a.strength);
    expect(byStrength[0].strength).toBeGreaterThan(byStrength[1].strength);
    expect(byStrength[0].strokeWidth).toBeGreaterThan(byStrength[1].strokeWidth);
  });

  it("orders ring radius by wavelength (concentric spectral nesting)", () => {
    const scene = buildScene(fakeAnalysis(), { size: 720 });
    const byLambda = [...scene.rings].sort((a, b) => a.lambda - b.lambda);
    for (let i = 1; i < byLambda.length; i++) {
      expect(byLambda[i].radius).toBeGreaterThanOrEqual(byLambda[i - 1].radius);
    }
  });

  it("colors rings by wavelength (Halpha redder than Hbeta)", () => {
    const scene = buildScene(fakeAnalysis(), { size: 720 });
    const ha = scene.rings.find((r) => Math.round(r.lambda) === 6563)!;
    const hb = scene.rings.find((r) => Math.round(r.lambda) === 4861)!;
    expect(ha.color.r).toBeGreaterThan(hb.color.r);
  });

  it("is fully deterministic", () => {
    expect(buildScene(fakeAnalysis(), { size: 512 })).toEqual(
      buildScene(fakeAnalysis(), { size: 512 }),
    );
  });

  it("keeps all geometry within the canvas bounds", () => {
    const scene = buildScene(fakeAnalysis(), { size: 720 });
    for (const ring of scene.rings) {
      expect(ring.cx - ring.radius).toBeGreaterThanOrEqual(0);
      expect(ring.cx + ring.radius).toBeLessThanOrEqual(scene.width);
      expect(ring.cy - ring.radius).toBeGreaterThanOrEqual(0);
      expect(ring.cy + ring.radius).toBeLessThanOrEqual(scene.height);
    }
  });
});
