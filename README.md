# Deep Space Spectrum & Chemical Fingerprint Studio

A generative engineering suite that ingests real NASA spectroscopic FITS files
(Hubble, JWST, IUE) and exports print-ready chemical-fingerprint vector art.

Built for the **Stardance Hack Club** as a months-long solo project.

## What it does (planned)

- Loads curated spectra from MAST (Hubble STIS, JWST NIRSpec, IUE).
- Parses FITS binary tables to get wavelength / flux / error arrays.
- Runs a signal-processing pipeline to isolate elemental and molecular
  absorption / emission lines (H, He, Fe, Na, [O III], CH₄, ...).
- Feeds those lines into a generative vector renderer with a small
  dashboard of 8–10 controls.
- Exports a 10×10 inch print-ready SVG and a tagged-sRGB PDF
  (with an OutputIntent ICC profile).

## Status

Phase 0 of 8: bootstrapping.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Deploy target: Vercel
- CI: GitHub Actions (lint, typecheck, test, build)

## License

Code: MIT. Bundled FITS data: see `public/spectra/ATTRIBUTIONS.md`
(MAST public domain / CC BY 4.0).
