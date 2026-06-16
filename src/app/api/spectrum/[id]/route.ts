import { NextResponse } from "next/server";
import { loadSpectrum, toDTO } from "@/lib/spectra/load";

/**
 * GET /api/spectrum/[id]
 * Returns the decoded spectrum as JSON (downsampled for transport).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const spectrum = await loadSpectrum(params.id);
    if (!spectrum) {
      return NextResponse.json({ error: "Unknown spectrum id" }, { status: 404 });
    }
    return NextResponse.json(toDTO(spectrum));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to decode spectrum";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
