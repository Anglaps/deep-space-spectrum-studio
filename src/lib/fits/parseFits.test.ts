import { describe, it, expect } from "vitest";
import { parseFits } from "./parseFits";

const BLOCK = 2880;
const CARD = 80;

/** Pad an ASCII string to a full 80-char FITS card. */
function card(s: string): string {
  if (s.length > CARD) throw new Error(`card too long: ${s}`);
  return s.padEnd(CARD, " ");
}

/** Format `KEYWORD = value` style cards the way FITS expects (value right-justified to col 30). */
function kv(key: string, value: string): string {
  return card(`${key.padEnd(8, " ")}= ${value.padStart(20, " ")}`);
}

function strCard(key: string, value: string): string {
  return card(`${key.padEnd(8, " ")}= '${value}'`);
}

/** Concatenate cards and pad the header to a 2880-byte boundary with spaces. */
function buildHeader(cards: string[]): Buffer {
  const text = cards.join("") + card("END");
  const padded = text.padEnd(Math.ceil(text.length / BLOCK) * BLOCK, " ");
  return Buffer.from(padded, "ascii");
}

/**
 * Build a minimal valid FITS file:
 *   - Primary HDU (no data)
 *   - BINTABLE extension with 3 columns: FLUX (E/f32), LOGLAM (D/f64), IVAR (E/f32)
 * Returns an ArrayBuffer, big-endian table data, padded to blocks.
 */
function buildFixture(rows: {
  flux: number[];
  loglam: number[];
  ivar: number[];
}): ArrayBuffer {
  const n = rows.flux.length;

  const primary = buildHeader([
    card("SIMPLE  =                    T"),
    kv("BITPIX", "8"),
    kv("NAXIS", "0"),
  ]);

  // Row layout: FLUX f32 (4) + LOGLAM f64 (8) + IVAR f32 (4) = 16 bytes/row
  const rowBytes = 16;
  const tableHeader = buildHeader([
    strCard("XTENSION", "BINTABLE"),
    kv("BITPIX", "8"),
    kv("NAXIS", "2"),
    kv("NAXIS1", String(rowBytes)),
    kv("NAXIS2", String(n)),
    kv("PCOUNT", "0"),
    kv("GCOUNT", "1"),
    kv("TFIELDS", "3"),
    strCard("TTYPE1", "FLUX"),
    strCard("TFORM1", "1E"),
    strCard("TTYPE2", "LOGLAM"),
    strCard("TFORM2", "1D"),
    strCard("TTYPE3", "IVAR"),
    strCard("TFORM3", "1E"),
  ]);

  const dataLen = Math.ceil((rowBytes * n) / BLOCK) * BLOCK;
  const data = Buffer.alloc(dataLen);
  for (let i = 0; i < n; i++) {
    const off = i * rowBytes;
    data.writeFloatBE(rows.flux[i], off);
    data.writeDoubleBE(rows.loglam[i], off + 4);
    data.writeFloatBE(rows.ivar[i], off + 12);
  }

  const out = Buffer.concat([primary, tableHeader, data]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

describe("parseFits", () => {
  const fixture = buildFixture({
    flux: [1.5, 2.5, 3.5],
    loglam: [3.5, 3.6, 3.7],
    ivar: [4, 100, 25],
  });

  it("parses primary + bintable HDUs", () => {
    const file = parseFits(fixture);
    expect(file.hdus).toHaveLength(2);
    expect(file.hdus[0].header.SIMPLE).toBe(true);
    expect(file.hdus[1].header.XTENSION).toBe("BINTABLE");
  });

  it("reads NAXIS2 as row count", () => {
    const file = parseFits(fixture);
    expect(file.hdus[1].rowCount).toBe(3);
  });

  it("decodes float32 and float64 columns big-endian", () => {
    const file = parseFits(fixture);
    const t = file.hdus[1].table!;
    expect(Array.from(t.FLUX.data as Float64Array)).toEqual([1.5, 2.5, 3.5]);
    expect(Array.from(t.LOGLAM.data as Float64Array)).toEqual([3.5, 3.6, 3.7]);
    expect(Array.from(t.IVAR.data as Float64Array)).toEqual([4, 100, 25]);
  });

  it("captures column names and TFORM-derived types", () => {
    const file = parseFits(fixture);
    const t = file.hdus[1].table!;
    expect(t.FLUX.type).toBe("float32");
    expect(t.LOGLAM.type).toBe("float64");
    expect(Object.keys(t)).toEqual(["FLUX", "LOGLAM", "IVAR"]);
  });

  it("throws on a non-FITS buffer", () => {
    const bogus = new TextEncoder().encode("not a fits file at all".padEnd(2880, " "));
    expect(() => parseFits(bogus.buffer)).toThrow(/SIMPLE/i);
  });
});
