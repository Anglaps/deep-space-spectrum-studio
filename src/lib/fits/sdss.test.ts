import { describe, it, expect } from "vitest";
import type { FitsColumn, FitsFile } from "./types";
import { sdssToSpectrum } from "./sdss";

function col(name: string, values: number[]): FitsColumn {
  return { name, type: "float64", data: Float64Array.from(values) };
}

/** A fake parsed SDSS file: primary HDU + COADD bintable with flux/loglam/ivar. */
function fakeSdss(): FitsFile {
  return {
    hdus: [
      { header: { SIMPLE: true }, rowCount: 0 },
      {
        header: { XTENSION: "BINTABLE", NAXIS2: 3 },
        rowCount: 3,
        table: {
          flux: col("flux", [10, 20, 30]),
          loglam: col("loglam", [3, 3.5, 4]), // 10^ -> 1000, ~3162.28, 10000 Å
          ivar: col("ivar", [4, 0, 25]), // -> err 0.5, Infinity (masked), 0.2
        },
      },
    ],
  };
}

describe("sdssToSpectrum", () => {
  it("converts loglam to wavelength in Angstroms", () => {
    const s = sdssToSpectrum(fakeSdss(), "test-1");
    expect(s.wavelength[0]).toBeCloseTo(1000, 6);
    expect(s.wavelength[1]).toBeCloseTo(3162.2776, 3);
    expect(s.wavelength[2]).toBeCloseTo(10000, 6);
    expect(s.meta.wavelengthUnit).toBe("Angstrom");
  });

  it("passes flux through unchanged", () => {
    const s = sdssToSpectrum(fakeSdss(), "test-1");
    expect(Array.from(s.flux)).toEqual([10, 20, 30]);
  });

  it("derives 1-sigma error from inverse variance", () => {
    const s = sdssToSpectrum(fakeSdss(), "test-1");
    expect(s.error[0]).toBeCloseTo(0.5, 6);
    expect(s.error[1]).toBe(Infinity); // ivar == 0 -> masked
    expect(s.error[2]).toBeCloseTo(0.2, 6);
  });

  it("sets id and instrument metadata", () => {
    const s = sdssToSpectrum(fakeSdss(), "spec-10000");
    expect(s.id).toBe("spec-10000");
    expect(s.meta.instrument).toMatch(/SDSS/i);
  });

  it("throws when the COADD table is missing", () => {
    const noTable: FitsFile = { hdus: [{ header: { SIMPLE: true }, rowCount: 0 }] };
    expect(() => sdssToSpectrum(noTable, "x")).toThrow(/coadd|bintable|table/i);
  });
});
