import type { FitsColumn, FitsFile, Spectrum } from "./types";

/**
 * Convert a parsed SDSS DR17 "lite" spectrum file into a physical Spectrum.
 *
 * The coadded spectrum lives in the first BINTABLE HDU (the COADD table) with
 * columns:
 *   flux   - calibrated flux (10^-17 erg/s/cm^2/Angstrom)
 *   loglam - log10(wavelength / Angstrom)
 *   ivar   - inverse variance of flux
 *
 * Wavelength = 10^loglam. Error = 1/sqrt(ivar); ivar == 0 marks a masked
 * sample and yields Infinity (callers can treat non-finite error as a gap).
 */
export function sdssToSpectrum(file: FitsFile, id: string): Spectrum {
  const table = findCoaddTable(file);

  const flux = numericColumn(table, "flux");
  const loglam = numericColumn(table, "loglam");
  const ivar = numericColumn(table, "ivar");

  const n = flux.length;
  const wavelength = new Float64Array(n);
  const error = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    wavelength[i] = 10 ** loglam[i];
    error[i] = ivar[i] > 0 ? 1 / Math.sqrt(ivar[i]) : Infinity;
  }

  return {
    id,
    wavelength,
    flux: Float64Array.from(flux),
    error,
    meta: {
      instrument: "SDSS BOSS/eBOSS spectrograph",
      fluxUnit: "10^-17 erg/s/cm^2/Angstrom",
      wavelengthUnit: "Angstrom",
      source: "SDSS DR17",
    },
  };
}

/** First BINTABLE HDU that has flux + loglam + ivar columns. */
function findCoaddTable(file: FitsFile): Record<string, FitsColumn> {
  for (const hdu of file.hdus) {
    if (!hdu.table) continue;
    const names = new Set(Object.keys(hdu.table).map((k) => k.toLowerCase()));
    if (names.has("flux") && names.has("loglam") && names.has("ivar")) {
      return hdu.table;
    }
  }
  throw new Error("No SDSS COADD bintable (flux/loglam/ivar) found in file");
}

/** Case-insensitive numeric column lookup as a plain number array. */
function numericColumn(table: Record<string, FitsColumn>, name: string): number[] | Float64Array {
  const key = Object.keys(table).find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) throw new Error(`Missing column "${name}"`);
  const col = table[key];
  if (Array.isArray(col.data)) {
    throw new Error(`Column "${name}" is not numeric`);
  }
  return col.data as Float64Array;
}
