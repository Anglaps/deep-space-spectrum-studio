"use client";

import { useMemo, useState } from "react";
import type { SpectrumDTO } from "@/lib/spectra/load";

/** Rest-frame wavelengths (Angstrom) of common spectral lines for annotation. */
const LINES: { label: string; lambda: number }[] = [
  { label: "Hα", lambda: 6562.8 },
  { label: "Hβ", lambda: 4861.3 },
  { label: "Hγ", lambda: 4340.5 },
  { label: "Ca K", lambda: 3933.7 },
  { label: "Ca H", lambda: 3968.5 },
  { label: "Mg b", lambda: 5175.4 },
  { label: "Na D", lambda: 5892.9 },
  { label: "[O III]", lambda: 5006.8 },
];

const W = 900;
const H = 420;
const PAD = { top: 24, right: 20, bottom: 44, left: 64 };

interface Props {
  spectrum: SpectrumDTO;
}

export default function SpectrumChart({ spectrum }: Props) {
  const [showLines, setShowLines] = useState(true);

  const { path, xMin, xMax, yMin, yMax, xScale, yScale } = useMemo(() => {
    const wl = spectrum.wavelength;
    const fl = spectrum.flux;

    const xMin = wl[0];
    const xMax = wl[wl.length - 1];

    // Robust flux range: clip to the 1st/99th percentile so a few cosmic-ray
    // spikes do not flatten the whole spectrum.
    const sorted = [...fl].filter(Number.isFinite).sort((a, b) => a - b);
    const yMin = sorted[Math.floor(sorted.length * 0.01)] ?? 0;
    const yMax = sorted[Math.floor(sorted.length * 0.99)] ?? 1;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const xScale = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin)) * plotW;
    const yScale = (y: number) =>
      PAD.top + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH;

    let path = "";
    for (let i = 0; i < wl.length; i++) {
      if (!Number.isFinite(fl[i])) continue;
      const cmd = path === "" ? "M" : "L";
      path += `${cmd}${xScale(wl[i]).toFixed(1)} ${yScale(fl[i]).toFixed(1)} `;
    }
    return { path, xMin, xMax, yMin, yMax, xScale, yScale };
  }, [spectrum]);

  const xTicks = niceTicks(xMin, xMax, 7);
  const yTicks = niceTicks(yMin, yMax, 5);

  return (
    <figure className="w-full">
      <div className="mb-3 flex items-center justify-between gap-4">
        <figcaption className="text-sm text-starlight/60">
          Flux vs wavelength
          <span className="ml-2 text-starlight/35">
            {spectrum.meta.fluxUnit} · Å
          </span>
        </figcaption>
        <button
          type="button"
          onClick={() => setShowLines((v) => !v)}
          className="rounded-md border border-starlight/15 px-3 py-1 text-xs text-starlight/70 transition-colors hover:border-starlight/35 hover:text-starlight"
        >
          {showLines ? "Hide" : "Show"} spectral lines
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg border border-starlight/10 bg-cosmos/60"
        role="img"
        aria-label={`Spectrum of ${spectrum.meta.object ?? spectrum.id}, flux against wavelength in Angstroms`}
      >
        {/* y grid + labels */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="#e8ecff"
              strokeOpacity={0.06}
            />
            <text
              x={PAD.left - 10}
              y={yScale(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-starlight/40"
              fontSize={11}
            >
              {formatTick(t)}
            </text>
          </g>
        ))}

        {/* x ticks + labels */}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line
              x1={xScale(t)}
              x2={xScale(t)}
              y1={H - PAD.bottom}
              y2={H - PAD.bottom + 5}
              stroke="#e8ecff"
              strokeOpacity={0.25}
            />
            <text
              x={xScale(t)}
              y={H - PAD.bottom + 20}
              textAnchor="middle"
              className="fill-starlight/40"
              fontSize={11}
            >
              {Math.round(t)}
            </text>
          </g>
        ))}

        {/* spectral line markers */}
        {showLines &&
          LINES.filter((l) => l.lambda >= xMin && l.lambda <= xMax).map((l) => (
            <g key={l.label}>
              <line
                x1={xScale(l.lambda)}
                x2={xScale(l.lambda)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="#8aa0ff"
                strokeOpacity={0.35}
                strokeDasharray="3 4"
              />
              <text
                x={xScale(l.lambda) + 3}
                y={PAD.top + 10}
                className="fill-[#8aa0ff]"
                fontSize={10}
              >
                {l.label}
              </text>
            </g>
          ))}

        {/* flux trace */}
        <path d={path} fill="none" stroke="#e8ecff" strokeWidth={1} strokeOpacity={0.9} />

        {/* axis labels */}
        <text
          x={PAD.left + (W - PAD.left - PAD.right) / 2}
          y={H - 6}
          textAnchor="middle"
          className="fill-starlight/55"
          fontSize={12}
        >
          Wavelength (Å)
        </text>
      </svg>
    </figure>
  );
}

/** Generate "nice" round tick values across [min, max]. */
function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 1e-6; t += step) ticks.push(t);
  return ticks;
}

function formatTick(v: number): string {
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.01 || a >= 1000)) return v.toExponential(1);
  return v.toFixed(a < 10 ? 1 : 0);
}
