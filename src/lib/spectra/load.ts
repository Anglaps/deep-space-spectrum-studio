import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFits } from "@/lib/fits/parseFits";
import { sdssToSpectrum } from "@/lib/fits/sdss";
import type { Spectrum } from "@/lib/fits/types";

const SPECTRA_DIR = join(process.cwd(), "public", "spectra");

export interface ManifestEntry {
  id: string;
  instrument: string;
  object: string;
  file: string;
  bytes: number;
  source: string;
}

interface Manifest {
  generatedAt: string;
  spectra: ManifestEntry[];
}

/** Read the curated spectra manifest (written by scripts/fetch-spectra.mjs). */
export async function readManifest(): Promise<Manifest> {
  const raw = await readFile(join(SPECTRA_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw) as Manifest;
}

/** Look up one manifest entry by id, or null if unknown. */
export async function findEntry(id: string): Promise<ManifestEntry | null> {
  const { spectra } = await readManifest();
  return spectra.find((s) => s.id === id) ?? null;
}

/**
 * Load and decode a curated spectrum by id. Reads the FITS file from
 * public/spectra/, parses it, and adapts it to a physical Spectrum.
 * Returns null if the id is not in the manifest.
 */
export async function loadSpectrum(id: string): Promise<Spectrum | null> {
  const entry = await findEntry(id);
  if (!entry) return null;

  const buf = await readFile(join(SPECTRA_DIR, entry.file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const spectrum = sdssToSpectrum(parseFits(ab), id);
  spectrum.meta.object = entry.object;
  spectrum.meta.source = entry.source;
  return spectrum;
}

/** Serializable form of a spectrum for JSON responses and client props. */
export interface SpectrumDTO {
  id: string;
  wavelength: number[];
  flux: number[];
  error: number[];
  meta: Spectrum["meta"];
}

/**
 * Convert a Spectrum to a JSON-friendly DTO, optionally downsampling to at
 * most `maxPoints` samples by simple striding (keeps payloads small for the
 * chart). Non-finite errors become null so JSON stays valid.
 */
export function toDTO(spectrum: Spectrum, maxPoints = 4000): SpectrumDTO {
  const n = spectrum.wavelength.length;
  const stride = Math.max(1, Math.ceil(n / maxPoints));

  const wavelength: number[] = [];
  const flux: number[] = [];
  const error: number[] = [];
  for (let i = 0; i < n; i += stride) {
    wavelength.push(spectrum.wavelength[i]);
    flux.push(spectrum.flux[i]);
    const e = spectrum.error[i];
    error.push(Number.isFinite(e) ? e : 0);
  }
  return { id: spectrum.id, wavelength, flux, error, meta: spectrum.meta };
}
