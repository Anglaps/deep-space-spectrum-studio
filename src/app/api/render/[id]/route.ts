import { loadSpectrum } from "@/lib/spectra/load";
import { analyzeSpectrum } from "@/lib/spectra/analyze";
import { buildScene } from "@/lib/render/scene";
import { sceneToSVG } from "@/lib/render/svg";

/**
 * GET /api/render/[id].svg
 * Returns the print-ready chemical-fingerprint SVG for a spectrum.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const spectrum = await loadSpectrum(params.id);
  if (!spectrum) {
    return new Response("Unknown spectrum id", { status: 404 });
  }

  const analysis = analyzeSpectrum(spectrum);
  const scene = buildScene(analysis, { size: 1000 });
  const svg = sceneToSVG(scene, { printInches: 10 });

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `inline; filename="${params.id}-fingerprint.svg"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
