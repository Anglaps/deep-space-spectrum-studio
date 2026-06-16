import type {
  FitsColumn,
  FitsColumnType,
  FitsFile,
  FitsHDU,
  FitsHeader,
} from "./types";

const BLOCK = 2880;
const CARD = 80;

/**
 * Parse a FITS file from an ArrayBuffer.
 *
 * Scope: scalar-column BINTABLE extensions (repeat count 1) with E/D/I/J/A
 * formats, plus header-only image HDUs. This covers 1D spectra from SDSS,
 * JWST NIRSpec x1d, and first-order HST STIS x1d. Variable-length array
 * columns (TFORM 'P'/'Q') and multi-element repeats are out of scope.
 */
export function parseFits(buffer: ArrayBuffer): FitsFile {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const hdus: FitsHDU[] = [];

  // A valid FITS file must begin with the SIMPLE keyword in the first card.
  // Check up front so non-FITS input fails fast with a clear message rather
  // than running off the end looking for an END card.
  if (asciiSlice(bytes, 0, 6) !== "SIMPLE") {
    throw new Error("Not a FITS file: first card is not SIMPLE");
  }

  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const { header, dataStart } = readHeader(bytes, offset);

    if (first) {
      if (header.SIMPLE !== true) {
        throw new Error("Not a FITS file: primary header SIMPLE is not T");
      }
      first = false;
    }

    const dataBytes = hduDataBytes(header);
    const hdu: FitsHDU = { header, rowCount: 0 };

    if (header.XTENSION === "BINTABLE") {
      hdu.rowCount = Number(header.NAXIS2) || 0;
      hdu.table = readBinTable(view, dataStart, header);
    }

    hdus.push(hdu);

    // Advance past this HDU's data, padded to a block boundary.
    const padded = Math.ceil(dataBytes / BLOCK) * BLOCK;
    offset = dataStart + padded;

    // Stop if there's no room for another full header block.
    if (offset + BLOCK > bytes.length && dataBytes === 0 && hdus.length > 0) break;
  }

  return { hdus };
}

/** Read 80-char cards from `start` until END; return the parsed header and the byte offset where data begins. */
function readHeader(
  bytes: Uint8Array,
  start: number,
): { header: FitsHeader; dataStart: number } {
  const header: FitsHeader = {};
  let pos = start;

  for (;;) {
    if (pos + CARD > bytes.length) {
      throw new Error("Unexpected end of file while reading header");
    }
    const cardText = asciiSlice(bytes, pos, CARD);
    pos += CARD;

    const keyword = cardText.slice(0, 8).trim();
    if (keyword === "END") break;
    if (keyword === "" || cardText[8] !== "=") continue; // comment / blank / COMMENT

    const { value } = parseCardValue(cardText.slice(10));
    if (keyword) header[keyword] = value;
  }

  // Data starts at the next 2880-byte boundary after the header.
  const headerBytes = pos - start;
  const dataStart = start + Math.ceil(headerBytes / BLOCK) * BLOCK;
  return { header, dataStart };
}

/** Parse the value field of a card (everything after `KEYWORD = `). */
function parseCardValue(field: string): { value: string | number | boolean } {
  const noComment = stripComment(field).trim();

  if (noComment.startsWith("'")) {
    const end = noComment.indexOf("'", 1);
    return { value: end >= 0 ? noComment.slice(1, end).trim() : noComment.slice(1).trim() };
  }
  if (noComment === "T") return { value: true };
  if (noComment === "F") return { value: false };

  const num = Number(noComment);
  if (noComment !== "" && !Number.isNaN(num)) return { value: num };
  return { value: noComment };
}

/** Remove a trailing ` / comment`, but not slashes inside quoted strings. */
function stripComment(field: string): string {
  let inString = false;
  for (let i = 0; i < field.length; i++) {
    const c = field[i];
    if (c === "'") inString = !inString;
    else if (c === "/" && !inString) return field.slice(0, i);
  }
  return field;
}

/** Bytes of data for an HDU, per BITPIX/NAXIS (BINTABLE: NAXIS1 * NAXIS2). */
function hduDataBytes(header: FitsHeader): number {
  const naxis = Number(header.NAXIS) || 0;
  if (naxis === 0) return 0;
  let count = 1;
  for (let i = 1; i <= naxis; i++) count *= Number(header[`NAXIS${i}`]) || 0;
  const bitpix = Number(header.BITPIX) || 8;
  return count * (Math.abs(bitpix) / 8);
}

interface ColumnSpec {
  name: string;
  /** Decodable element type, or undefined for columns we only walk past. */
  type?: FitsColumnType;
  /** Total bytes this column occupies in a row (element width * repeat). */
  byteWidth: number;
  unit?: string;
}

// Per-element byte width for each FITS BINTABLE format code.
const TFORM_WIDTH: Record<string, number> = {
  L: 1, // logical
  B: 1, // unsigned byte
  I: 2, // int16
  J: 4, // int32
  K: 8, // int64
  E: 4, // float32
  D: 8, // float64
  A: 1, // char (width = repeat count)
};

// Element types we decode into numeric columns. Codes with a width but no
// entry here (e.g. B, K masks, or multi-element columns) are walked over to
// keep row offsets aligned but not materialized.
const NUMERIC_TYPE: Record<string, FitsColumnType> = {
  I: "int16",
  J: "int32",
  E: "float32",
  D: "float64",
};

/** Build column specs from TFIELDS / TFORMn / TTYPEn header cards. */
function columnSpecs(header: FitsHeader): ColumnSpec[] {
  const fields = Number(header.TFIELDS) || 0;
  const specs: ColumnSpec[] = [];
  for (let i = 1; i <= fields; i++) {
    const tform = String(header[`TFORM${i}`] ?? "").trim();
    const name = String(header[`TTYPE${i}`] ?? `col${i}`).trim();
    const unit = header[`TUNIT${i}`] ? String(header[`TUNIT${i}`]).trim() : undefined;

    const match = tform.match(/^(\d*)([A-Z])/);
    if (!match) throw new Error(`Unsupported TFORM${i}: "${tform}"`);
    const repeat = match[1] === "" ? 1 : Number(match[1]);
    const code = match[2];

    const elemWidth = TFORM_WIDTH[code];
    if (elemWidth === undefined) {
      throw new Error(`Unsupported TFORM code "${code}" in TFORM${i}`);
    }

    // Strings: one column of `repeat` chars.
    if (code === "A") {
      specs.push({ name, type: "string", byteWidth: repeat, unit });
      continue;
    }

    const byteWidth = elemWidth * repeat;
    // Decode only scalar numeric columns; reserve width for everything else
    // (multi-element arrays, 64-bit and byte masks) so row offsets stay aligned.
    const type = repeat === 1 ? NUMERIC_TYPE[code] : undefined;
    specs.push({ name, type, byteWidth, unit });
  }
  return specs;
}

/** Decode a scalar-column BINTABLE into named columns (big-endian). */
function readBinTable(
  view: DataView,
  dataStart: number,
  header: FitsHeader,
): Record<string, FitsColumn> {
  const rows = Number(header.NAXIS2) || 0;
  const rowBytes = Number(header.NAXIS1) || 0;
  const specs = columnSpecs(header);

  // Byte offset of each column within a row.
  const colOffsets: number[] = [];
  let running = 0;
  for (const spec of specs) {
    colOffsets.push(running);
    running += spec.byteWidth;
  }

  const table: Record<string, FitsColumn> = {};
  for (let c = 0; c < specs.length; c++) {
    const spec = specs[c];
    const base = dataStart + colOffsets[c];

    if (spec.type === "string") {
      const data: string[] = new Array(rows);
      for (let r = 0; r < rows; r++) {
        const off = base + r * rowBytes;
        let s = "";
        for (let b = 0; b < spec.byteWidth; b++) s += String.fromCharCode(view.getUint8(off + b));
        data[r] = s.trim();
      }
      table[spec.name] = { name: spec.name, type: spec.type, unit: spec.unit, data };
      continue;
    }

    // Columns with no decodable type (multi-element arrays, 64-bit/byte masks)
    // had their width reserved in colOffsets; skip materializing them.
    if (spec.type === undefined) continue;

    // Numeric columns are promoted to Float64Array for a uniform downstream type.
    const data = new Float64Array(rows);
    for (let r = 0; r < rows; r++) {
      const off = base + r * rowBytes;
      data[r] = readScalar(view, off, spec.type);
    }
    table[spec.name] = { name: spec.name, type: spec.type, unit: spec.unit, data };
  }
  return table;
}

function readScalar(view: DataView, off: number, type: FitsColumnType): number {
  switch (type) {
    case "float32":
      return view.getFloat32(off, false);
    case "float64":
      return view.getFloat64(off, false);
    case "int32":
      return view.getInt32(off, false);
    case "int16":
      return view.getInt16(off, false);
    default:
      throw new Error(`readScalar: unexpected type ${type}`);
  }
}

function asciiSlice(bytes: Uint8Array, start: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[start + i]);
  return s;
}
