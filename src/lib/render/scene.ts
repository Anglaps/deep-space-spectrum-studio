import type { AnalysisResult } from "@/lib/spectra/analyze";
import { wavelengthToRGB, type RGB } from "./color";

export interface Ring {
  lambda: number;
  cx: number;
  cy: number;
  radius: number;
  strokeWidth: number;
  /** |level - 1|: how far the line deviates from the continuum. */
  strength: number;
  kind: "absorption" | "emission";
  color: RGB;
  /** Number of radial ticks around the ring; 0 if unmatched to an element. */
  ticks: number;
  /** Phase angle (radians) for tick placement; derived from wavelength. */
  phase: number;
}

export interface Scene {
  width: number;
  height: number;
  rings: Ring[];
  background: string;
}

export interface SceneOptions {
  /** Canvas edge length in px (square). */
  size?: number;
}

/**
 * Map a chemical fingerprint to a deterministic set of concentric vector rings.
 * Wavelength drives color and tick phase; line strength drives radius and
 * stroke weight; matched elements add radial ticks. The same AnalysisResult
 * always produces the same Scene.
 */
export function buildScene(analysis: AnalysisResult, opts: SceneOptions = {}): Scene {
  const size = opts.size ?? 1000;
  const cx = size / 2;
  const cy = size / 2;
  const margin = size * 0.06;
  const maxRadius = size / 2 - margin;
  const minRadius = size * 0.05;

  // Sort by wavelength for stable, repeatable layering (blue core -> red edge).
  const lines = [...analysis.lines].sort((a, b) => a.lambda - b.lambda);

  // Strength normalization so the strongest line reaches near maxRadius.
  const strengths = lines.map((l) => Math.abs(l.level - 1));
  const maxStrength = Math.max(1e-6, ...strengths);

  // Quick lookup: which detected wavelengths matched an element.
  const matched = new Set(analysis.fingerprint.map((f) => Math.round(f.observedLambda)));

  const rings: Ring[] = lines.map((line, i) => {
    const strength = Math.abs(line.level - 1);
    // Radius is set by wavelength order so rings nest concentrically. Strength
    // nudges within a fraction of one band step, never enough to cross the
    // neighbouring ring, so wavelength ordering is preserved exactly.
    const band = lines.length > 1 ? i / (lines.length - 1) : 0.5;
    const bandStep = lines.length > 1 ? (maxRadius - minRadius) / (lines.length - 1) : 0;
    const base = minRadius + band * (maxRadius - minRadius);
    const radius = Math.min(maxRadius, base + 0.3 * bandStep * (strength / maxStrength));

    return {
      lambda: line.lambda,
      cx,
      cy,
      radius,
      strokeWidth: 0.5 + 3.5 * (strength / maxStrength),
      strength,
      kind: line.kind,
      color: wavelengthToRGB(line.lambda),
      ticks: matched.has(Math.round(line.lambda)) ? 12 : 0,
      phase: (line.lambda % 360) * (Math.PI / 180),
    };
  });

  return { width: size, height: size, rings, background: "#05060a" };
}
