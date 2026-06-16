import { describe, it, expect } from "vitest";
import { buildScene } from "./scene";
import { sceneToSVG } from "./svg";
import type { AnalysisResult } from "@/lib/spectra/analyze";

function analysis(): AnalysisResult {
  return {
    normalized: Float64Array.from([1]),
    lines: [
      { lambda: 6562.8, level: 1.8, kind: "emission", match: null },
      { lambda: 4861.3, level: 0.5, kind: "absorption", match: null },
    ],
    fingerprint: [
      { element: "H", label: "Hα", restLambda: 6562.8, observedLambda: 6562.8, kind: "emission" },
    ],
  };
}

describe("sceneToSVG", () => {
  const scene = buildScene(analysis(), { size: 1000 });
  const svg = sceneToSVG(scene, { printInches: 10 });

  it("produces a well-formed root svg element", () => {
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("sizes the document for 10x10 inch print", () => {
    expect(svg).toContain('width="10in"');
    expect(svg).toContain('height="10in"');
    expect(svg).toContain(`viewBox="0 0 ${scene.width} ${scene.height}"`);
  });

  it("renders one circle per ring plus a background rect", () => {
    const circles = (svg.match(/<circle/g) || []).length;
    expect(circles).toBe(scene.rings.length);
    expect(svg).toContain("<rect");
  });

  it("embeds each ring's color", () => {
    for (const ring of scene.rings) {
      const hex = `#${[ring.color.r, ring.color.g, ring.color.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
      expect(svg.toLowerCase()).toContain(hex);
    }
  });

  it("is deterministic", () => {
    expect(sceneToSVG(scene, { printInches: 10 })).toBe(sceneToSVG(scene, { printInches: 10 }));
  });

  it("contains no script or external resource references (safe static asset)", () => {
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("<image");
    expect(svg).not.toContain("xlink:href");
    expect(svg).not.toContain("<foreignObject");
  });
});
