import { describe, it, expect } from "vitest";
import { normalizeContinuum, detectLines, analyzeSpectrum } from "./analyze";
import type { Spectrum } from "@/lib/fits/types";

/** Build a synthetic spectrum: flat continuum + optional Gaussian features. */
function synth(opts: {
  lambdaStart?: number;
  lambdaEnd?: number;
  n?: number;
  continuum?: number;
  features?: { center: number; amp: number; sigma?: number }[];
  noise?: number;
}): Spectrum {
  const { lambdaStart = 4000, lambdaEnd = 7000, n = 1500, continuum = 100 } = opts;
  const features = opts.features ?? [];
  const wavelength = new Float64Array(n);
  const flux = new Float64Array(n);
  const error = new Float64Array(n);
  const step = (lambdaEnd - lambdaStart) / (n - 1);
  for (let i = 0; i < n; i++) {
    const wl = lambdaStart + i * step;
    wavelength[i] = wl;
    let f = continuum;
    for (const ft of features) {
      const sigma = ft.sigma ?? 3;
      f += ft.amp * Math.exp(-((wl - ft.center) ** 2) / (2 * sigma * sigma));
    }
    // Deterministic tiny ripple instead of random noise, for reproducible tests.
    if (opts.noise) f += opts.noise * Math.sin(i * 0.7);
    flux[i] = f;
    error[i] = 1;
  }
  return {
    id: "synth",
    wavelength,
    flux,
    error,
    meta: { instrument: "synthetic", fluxUnit: "arb", wavelengthUnit: "Angstrom" },
  };
}

describe("normalizeContinuum", () => {
  it("flattens a flat spectrum to ~1.0", () => {
    const s = synth({ continuum: 250 });
    const norm = normalizeContinuum(s);
    const mid = norm.slice(100, -100);
    for (const v of mid) expect(v).toBeCloseTo(1, 1);
  });

  it("preserves an absorption dip as a value below 1", () => {
    const s = synth({ continuum: 100, features: [{ center: 5500, amp: -60, sigma: 4 }] });
    const norm = normalizeContinuum(s);
    // Find index nearest 5500 A.
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < s.wavelength.length; i++) {
      const d = Math.abs(s.wavelength[i] - 5500);
      if (d < best) (best = d), (idx = i);
    }
    expect(norm[idx]).toBeLessThan(0.8);
  });
});

describe("detectLines", () => {
  it("detects an emission line near its injected center", () => {
    const s = synth({ continuum: 100, features: [{ center: 5006.8, amp: 80, sigma: 3 }] });
    const lines = detectLines(s);
    const emission = lines.filter((l) => l.kind === "emission");
    expect(emission.length).toBeGreaterThanOrEqual(1);
    const near = emission.find((l) => Math.abs(l.lambda - 5006.8) < 5);
    expect(near).toBeTruthy();
  });

  it("detects an absorption line near its injected center", () => {
    const s = synth({ continuum: 100, features: [{ center: 4861.3, amp: -70, sigma: 3 }] });
    const lines = detectLines(s);
    const near = lines.find(
      (l) => l.kind === "absorption" && Math.abs(l.lambda - 4861.3) < 5,
    );
    expect(near).toBeTruthy();
  });

  it("finds nothing significant in a featureless spectrum", () => {
    const s = synth({ continuum: 100, noise: 0.5 });
    const lines = detectLines(s);
    expect(lines.length).toBe(0);
  });
});

describe("analyzeSpectrum", () => {
  it("matches detected lines to elements", () => {
    const s = synth({
      continuum: 100,
      features: [
        { center: 5006.8, amp: 90, sigma: 3 }, // [O III]
        { center: 4861.3, amp: -70, sigma: 3 }, // Hβ
      ],
    });
    const result = analyzeSpectrum(s);
    const elements = new Set(result.fingerprint.map((f) => f.element));
    expect(elements.has("O")).toBe(true);
    expect(elements.has("H")).toBe(true);
  });
});
