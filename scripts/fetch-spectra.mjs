// Downloads a small curated bundle of real public SDSS DR17 spectra into
// public/spectra/. No auth required (SDSS DR17 is open access).
//
// Usage: node scripts/fetch-spectra.mjs
//
// Each candidate is fetched over plain HTTPS, then validated: a spectrum whose
// flux column is essentially all zeros (a dead or sky fiber) is rejected so it
// never enters the bundle. Surviving spectra are written to
// public/spectra/<id>.fits and summarized into public/spectra/manifest.json.

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "spectra");

/** @type {{id:string,instrument:string,object:string,url:string}[]} */
const SOURCES = [
  {
    id: "sdss-0266-51602-0001",
    instrument: "SDSS legacy",
    object: "SDSS DR17 plate 266, fiber 1",
    url: "https://data.sdss.org/sas/dr17/sdss/spectro/redux/26/spectra/lite/0266/spec-0266-51602-0001.fits",
  },
  {
    id: "sdss-0266-51602-0050",
    instrument: "SDSS legacy",
    object: "SDSS DR17 plate 266, fiber 50",
    url: "https://data.sdss.org/sas/dr17/sdss/spectro/redux/26/spectra/lite/0266/spec-0266-51602-0050.fits",
  },
  {
    id: "sdss-0285-51930-0200",
    instrument: "SDSS legacy",
    object: "SDSS DR17 plate 285, fiber 200",
    url: "https://data.sdss.org/sas/dr17/sdss/spectro/redux/26/spectra/lite/0285/spec-0285-51930-0200.fits",
  },
  {
    id: "sdss-0301-51942-0300",
    instrument: "SDSS legacy",
    object: "SDSS DR17 plate 301, fiber 300",
    url: "https://data.sdss.org/sas/dr17/sdss/spectro/redux/26/spectra/lite/0301/spec-0301-51942-0300.fits",
  },
];

/**
 * Minimal check that the COADD flux column is not all zeros. Locates the first
 * BINTABLE with a `flux` column (TFORM 'E', the SDSS layout), then samples its
 * values. Returns the fraction of nonzero flux samples. Independent of the app
 * parser on purpose, so a parser regression can't mask a dead fiber here.
 */
function nonzeroFluxFraction(buf) {
  const text = buf.toString("latin1");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const BLOCK = 2880;

  // Walk header blocks to find the BINTABLE whose first column is FLUX.
  for (let p = 0; p + BLOCK <= buf.length; ) {
    const headerText = text.slice(p, p + BLOCK * 4); // headers are small
    if (!headerText.startsWith("XTENSION= 'BINTABLE'") && !text.slice(p, p + 6).includes("XTENSI")) {
      // not a header start we care about; jump a block
    }
    // Find END within a bounded number of blocks.
    let endPos = -1;
    for (let q = p; q < Math.min(buf.length, p + BLOCK * 6); q += 80) {
      if (text.slice(q, q + 3) === "END" && text.slice(q + 3, q + 4).trim() === "") {
        endPos = q;
        break;
      }
    }
    if (endPos < 0) {
      p += BLOCK;
      continue;
    }
    const hdr = text.slice(p, endPos);
    const isBinTable = hdr.includes("'BINTABLE'");
    const fluxIsCol1 = /TTYPE1\s*=\s*'flux/.test(hdr);
    const naxis2 = Number((hdr.match(/NAXIS2\s*=\s*(\d+)/) || [])[1] || 0);
    const naxis1 = Number((hdr.match(/NAXIS1\s*=\s*(\d+)/) || [])[1] || 0);
    const dataStart = p + Math.ceil((endPos + 80 - p) / BLOCK) * BLOCK;

    if (isBinTable && fluxIsCol1 && naxis2 > 100 && naxis1 >= 4) {
      let nonzero = 0;
      for (let r = 0; r < naxis2; r++) {
        const v = dv.getFloat32(dataStart + r * naxis1, false); // flux @ col offset 0
        if (v !== 0 && Number.isFinite(v)) nonzero++;
      }
      return nonzero / naxis2;
    }

    // advance past this HDU's data
    const dataBytes = naxis1 * naxis2;
    p = dataStart + Math.ceil(dataBytes / BLOCK) * BLOCK;
    if (dataBytes === 0) p = dataStart;
  }
  return 0;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = [];

  for (const src of SOURCES) {
    process.stdout.write(`Fetching ${src.id} ... `);
    let res;
    try {
      res = await fetch(src.url);
    } catch (err) {
      console.error(`network error: ${err.message}`);
      process.exitCode = 1;
      continue;
    }
    if (!res.ok) {
      console.error(`FAILED (${res.status})`);
      process.exitCode = 1;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());

    const frac = nonzeroFluxFraction(buf);
    if (frac < 0.5) {
      console.error(`REJECTED (only ${(frac * 100).toFixed(0)}% nonzero flux — dead/sky fiber)`);
      process.exitCode = 1;
      continue;
    }

    const file = `${src.id}.fits`;
    await writeFile(join(OUT_DIR, file), buf);
    console.log(`${(buf.length / 1024).toFixed(0)} KB, ${(frac * 100).toFixed(0)}% real -> ${file}`);
    manifest.push({
      id: src.id,
      instrument: src.instrument,
      object: src.object,
      file,
      bytes: buf.length,
      source: src.url,
    });
  }

  await writeFile(
    join(OUT_DIR, "manifest.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), spectra: manifest }, null, 2) + "\n",
  );
  console.log(`\nWrote manifest with ${manifest.length} validated spectra.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
