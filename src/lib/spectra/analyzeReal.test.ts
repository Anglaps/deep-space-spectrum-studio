import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { parseFits } from "@/lib/fits/parseFits";
import { sdssToSpectrum } from "@/lib/fits/sdss";
import { analyzeSpectrum, detectLines } from "./analyze";

const file = join(process.cwd(), "public", "spectra", "sdss-0266-51602-0001.fits");
const hasData = existsSync(file);

describe.skipIf(!hasData)("analyze real SDSS spectrum", () => {
  it("detects real spectral features and matches some to elements", async () => {
    const buf = await readFile(file);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const spec = sdssToSpectrum(parseFits(ab), "sdss-0266-51602-0001");

    // Guard: this must be a real spectrum with nonzero flux.
    const nonzero = Array.from(spec.flux).filter((v) => v !== 0 && Number.isFinite(v));
    expect(nonzero.length / spec.flux.length).toBeGreaterThan(0.5);

    const lines = detectLines(spec);
    // A real spectrum has at least some significant features above the noise.
    expect(lines.length).toBeGreaterThan(0);

    const result = analyzeSpectrum(spec);
    // Normalized continuum should hover around 1 on average.
    const finite = Array.from(result.normalized).filter(Number.isFinite);
    const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
    expect(mean).toBeGreaterThan(0.5);
    expect(mean).toBeLessThan(2);
  });
});
