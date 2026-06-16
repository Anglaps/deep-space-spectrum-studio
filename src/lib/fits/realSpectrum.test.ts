import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { parseFits } from "./parseFits";
import { sdssToSpectrum } from "./sdss";

// Integration check against a real downloaded SDSS file. Skips automatically
// if the bundle hasn't been fetched (so CI without the data still passes the
// unit suite). Run `node scripts/fetch-spectra.mjs` to populate it.
const file = join(process.cwd(), "public", "spectra", "sdss-0266-51602-0001.fits");
const hasData = existsSync(file);

describe.skipIf(!hasData)("real SDSS spectrum", () => {
  it("decodes to a physically sensible optical spectrum", async () => {
    const buf = await readFile(file);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const spec = sdssToSpectrum(parseFits(ab), "sdss-0266-51602-0001");

    // SDSS legacy optical coverage is roughly 3800-9200 Angstrom.
    expect(spec.wavelength.length).toBeGreaterThan(1000);
    expect(spec.wavelength[0]).toBeGreaterThan(3000);
    expect(spec.wavelength[0]).toBeLessThan(4200);
    expect(spec.wavelength[spec.wavelength.length - 1]).toBeGreaterThan(8000);

    // Wavelength is monotonically increasing.
    expect(spec.wavelength[1]).toBeGreaterThan(spec.wavelength[0]);

    // Flux and error arrays line up with wavelength.
    expect(spec.flux.length).toBe(spec.wavelength.length);
    expect(spec.error.length).toBe(spec.wavelength.length);

    // Flux must be REAL data, not a dead/sky fiber: the original bundle once
    // shipped an all-zero fiber that passed a finiteness-only check, so assert
    // a substantial fraction of nonzero flux here.
    const nonzero = Array.from(spec.flux).filter((v) => v !== 0 && Number.isFinite(v));
    expect(nonzero.length / spec.flux.length).toBeGreaterThan(0.5);
  });
});
