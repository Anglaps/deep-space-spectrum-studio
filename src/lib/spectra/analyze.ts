import type { Spectrum } from "@/lib/fits/types";
import { matchLine, type SpectralLine } from "./lines";

export interface DetectedLine {
  lambda: number;
  /** Normalized depth/height: <1 absorption, >1 emission. */
  level: number;
  kind: "absorption" | "emission";
  match: SpectralLine | null;
}

export interface FingerprintEntry {
  element: string;
  label: string;
  restLambda: number;
  observedLambda: number;
  kind: "absorption" | "emission";
}

export interface AnalysisResult {
  normalized: Float64Array;
  lines: DetectedLine[];
  fingerprint: FingerprintEntry[];
}

/**
 * Estimate the continuum with a sliding median and divide it out, returning a
 * normalized spectrum that sits near 1.0 where there are no features. The
 * median window is wide enough to span over individual lines but narrow enough
 * to follow the broad continuum shape.
 */
export function normalizeContinuum(spectrum: Spectrum, windowFraction = 0.05): Float64Array {
  const flux = spectrum.flux;
  const n = flux.length;
  const half = Math.max(2, Math.floor((n * windowFraction) / 2));
  const continuum = slidingMedian(flux, half);

  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const c = continuum[i];
    out[i] = c !== 0 && Number.isFinite(c) ? flux[i] / c : 1;
  }
  return out;
}

/**
 * Detect absorption and emission lines in a spectrum. The spectrum is
 * continuum-normalized, then samples deviating from 1.0 by more than
 * `sigmaThreshold` times the robust noise level are grouped into features.
 * Each feature's center is the wavelength of its extremum.
 */
export function detectLines(spectrum: Spectrum, sigmaThreshold = 5): DetectedLine[] {
  const wl = spectrum.wavelength;
  const norm = normalizeContinuum(spectrum);
  const n = norm.length;

  // Robust noise estimate from the median absolute deviation of (norm - 1).
  const resid = new Float64Array(n);
  for (let i = 0; i < n; i++) resid[i] = norm[i] - 1;
  const noise = 1.4826 * medianAbsoluteDeviation(resid);
  const threshold = Math.max(sigmaThreshold * noise, 1e-6);

  const lines: DetectedLine[] = [];
  let i = 0;
  while (i < n) {
    const dev = norm[i] - 1;
    if (Math.abs(dev) <= threshold) {
      i++;
      continue;
    }
    const sign = Math.sign(dev);
    // Extend over the contiguous run that keeps the same sign and stays above threshold.
    let j = i;
    let extIdx = i;
    let extVal = norm[i];
    while (j < n && Math.sign(norm[j] - 1) === sign && Math.abs(norm[j] - 1) > threshold) {
      if (sign > 0 ? norm[j] > extVal : norm[j] < extVal) {
        extVal = norm[j];
        extIdx = j;
      }
      j++;
    }
    const kind = sign > 0 ? "emission" : "absorption";
    lines.push({
      lambda: wl[extIdx],
      level: extVal,
      kind,
      match: matchLine(wl[extIdx], lineTolerance(wl, extIdx), kind),
    });
    i = j;
  }
  return lines;
}

/** Full analysis: normalized flux, detected lines, and the element fingerprint. */
export function analyzeSpectrum(spectrum: Spectrum, sigmaThreshold = 5): AnalysisResult {
  const normalized = normalizeContinuum(spectrum);
  const lines = detectLines(spectrum, sigmaThreshold);

  const fingerprint: FingerprintEntry[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.match) continue;
    const key = `${line.match.label}:${line.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fingerprint.push({
      element: line.match.element,
      label: line.match.label,
      restLambda: line.match.lambda,
      observedLambda: line.lambda,
      kind: line.kind,
    });
  }
  return { normalized, lines, fingerprint };
}

/** Per-sample wavelength spacing scaled to a few pixels, for match tolerance. */
function lineTolerance(wl: Float64Array, idx: number): number {
  const i = Math.min(idx, wl.length - 2);
  const dispersion = Math.abs(wl[i + 1] - wl[i]) || 1;
  return Math.max(3 * dispersion, 5);
}

/** Sliding-window median; `half` is the half-window in samples. */
function slidingMedian(data: Float64Array, half: number): Float64Array {
  const n = data.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    const window: number[] = [];
    for (let k = lo; k <= hi; k++) if (Number.isFinite(data[k])) window.push(data[k]);
    out[i] = median(window);
  }
  return out;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function medianAbsoluteDeviation(data: Float64Array): number {
  const arr = Array.from(data).filter(Number.isFinite);
  const m = median(arr);
  const dev = arr.map((v) => Math.abs(v - m));
  return median(dev);
}
