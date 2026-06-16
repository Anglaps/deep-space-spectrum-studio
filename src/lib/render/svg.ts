import type { Scene, Ring } from "./scene";
import { rgbToHex } from "./color";

export interface SVGOptions {
  /** Physical print size in inches (square). Defaults to 10. */
  printInches?: number;
}

/**
 * Render a Scene to a standalone, print-ready SVG string. The document is sized
 * in inches for printing while the coordinate system stays in scene pixels via
 * viewBox, so the same geometry scales cleanly to any output resolution. The
 * output is a pure static asset: no scripts, no external references.
 */
export function sceneToSVG(scene: Scene, opts: SVGOptions = {}): string {
  const inches = opts.printInches ?? 10;
  const { width, height, rings, background } = scene;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${inches}in" height="${inches}in" ` +
      `viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${background}"/>`);

  for (const ring of rings) {
    parts.push(renderRing(ring));
  }

  parts.push("</svg>");
  return parts.join("\n");
}

function renderRing(ring: Ring): string {
  const hex = rgbToHex(ring.color);
  const r = round(ring.radius);
  const cx = round(ring.cx);
  const cy = round(ring.cy);
  const sw = round(ring.strokeWidth);

  const g: string[] = ["<g>"];

  // Emission rings get a faint fill; absorption rings are stroke-only outlines.
  if (ring.kind === "emission") {
    g.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${hex}" fill-opacity="0.06" ` +
        `stroke="${hex}" stroke-width="${sw}" stroke-opacity="0.9"/>`,
    );
  } else {
    g.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" ` +
        `stroke="${hex}" stroke-width="${sw}" stroke-opacity="0.85" stroke-dasharray="${round(r * 0.04)} ${round(r * 0.03)}"/>`,
    );
  }

  // Matched elements: radial ticks around the ring, pointing out (emission) or
  // in (absorption), placed deterministically from the ring's phase.
  if (ring.ticks > 0) {
    const dir = ring.kind === "emission" ? 1 : -1;
    const len = round(r * 0.06 + 4);
    for (let t = 0; t < ring.ticks; t++) {
      const a = ring.phase + (t / ring.ticks) * Math.PI * 2;
      const x1 = round(cx + Math.cos(a) * r);
      const y1 = round(cy + Math.sin(a) * r);
      const x2 = round(cx + Math.cos(a) * (r + dir * len));
      const y2 = round(cy + Math.sin(a) * (r + dir * len));
      g.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${hex}" stroke-width="${sw}"/>`);
    }
  }

  g.push("</g>");
  return g.join("");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
