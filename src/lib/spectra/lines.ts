/**
 * Rest-frame wavelengths (Angstrom, in air) of spectral lines used to identify
 * elements and molecules in a spectrum. Values are standard optical references.
 * `type` marks whether the feature is typically seen in absorption or emission;
 * some appear as both, marked "both".
 */
export interface SpectralLine {
  element: string;
  label: string;
  lambda: number;
  kind: "absorption" | "emission" | "both";
}

export const SPECTRAL_LINES: SpectralLine[] = [
  // Hydrogen Balmer series
  { element: "H", label: "Hα", lambda: 6562.8, kind: "both" },
  { element: "H", label: "Hβ", lambda: 4861.3, kind: "both" },
  { element: "H", label: "Hγ", lambda: 4340.5, kind: "both" },
  { element: "H", label: "Hδ", lambda: 4101.7, kind: "both" },
  // Calcium
  { element: "Ca", label: "Ca K", lambda: 3933.7, kind: "absorption" },
  { element: "Ca", label: "Ca H", lambda: 3968.5, kind: "absorption" },
  // Magnesium
  { element: "Mg", label: "Mg b", lambda: 5175.4, kind: "absorption" },
  // Sodium
  { element: "Na", label: "Na D", lambda: 5892.9, kind: "absorption" },
  // Oxygen (nebular, emission)
  { element: "O", label: "[O III]", lambda: 5006.8, kind: "emission" },
  { element: "O", label: "[O III]b", lambda: 4958.9, kind: "emission" },
  { element: "O", label: "[O II]", lambda: 3727.4, kind: "emission" },
  // Nitrogen / Sulfur (nebular, emission)
  { element: "N", label: "[N II]", lambda: 6583.5, kind: "emission" },
  { element: "S", label: "[S II]", lambda: 6716.4, kind: "emission" },
  // Iron (stellar absorption, representative)
  { element: "Fe", label: "Fe I", lambda: 5269.5, kind: "absorption" },
];

/** Find the closest spectral line within `tolerance` Angstrom, or null. */
export function matchLine(
  lambda: number,
  tolerance: number,
  kind?: "absorption" | "emission",
): SpectralLine | null {
  let best: SpectralLine | null = null;
  let bestDist = tolerance;
  for (const line of SPECTRAL_LINES) {
    if (kind && line.kind !== kind && line.kind !== "both") continue;
    const d = Math.abs(line.lambda - lambda);
    if (d <= bestDist) {
      best = line;
      bestDist = d;
    }
  }
  return best;
}
