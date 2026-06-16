/** Core types for the hand-rolled FITS reader and decoded spectra. */

/** A parsed FITS header: keyword -> value (string | number | boolean). */
export type FitsHeader = Record<string, string | number | boolean>;

/** Supported BINTABLE column element types, derived from TFORM. */
export type FitsColumnType = "float64" | "float32" | "int16" | "int32" | "string";

/** One decoded BINTABLE column. Numeric columns are typed arrays. */
export interface FitsColumn {
  name: string;
  type: FitsColumnType;
  unit?: string;
  /** Scalar columns (TFORM repeat count 1) hold one value per row. */
  data: Float64Array | Int32Array | string[];
}

/** One Header/Data Unit. `table` is present only for BINTABLE extensions. */
export interface FitsHDU {
  header: FitsHeader;
  /** Column name -> column, for BINTABLE HDUs. */
  table?: Record<string, FitsColumn>;
  /** Number of rows (NAXIS2) for a BINTABLE, else 0. */
  rowCount: number;
}

export interface FitsFile {
  hdus: FitsHDU[];
}

/**
 * A decoded 1D spectrum in physical units, instrument-agnostic.
 * Wavelength in Angstroms, flux and error in the instrument's flux units.
 */
export interface Spectrum {
  id: string;
  wavelength: Float64Array;
  flux: Float64Array;
  /** 1-sigma error per sample; same length as flux. */
  error: Float64Array;
  meta: {
    instrument: string;
    fluxUnit: string;
    wavelengthUnit: "Angstrom";
    source?: string;
    object?: string;
  };
}
