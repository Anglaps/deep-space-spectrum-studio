export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-6 text-xs uppercase tracking-[0.35em] text-starlight/50">
        Stardance Hack Club · Phase 0
      </p>
      <h1 className="mb-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Deep Space Spectrum <br /> &amp; Chemical Fingerprint Studio
      </h1>
      <p className="mb-12 max-w-xl text-balance text-starlight/70">
        A web studio that ingests real NASA FITS spectra, isolates their
        chemical fingerprints, and exports print-ready 10&times;10 inch
        vector art.
      </p>

      <div className="grid w-full max-w-lg grid-cols-2 gap-3 text-left text-xs sm:grid-cols-4">
        {[
          { phase: "0", label: "Bootstrap" },
          { phase: "1", label: "MAST data" },
          { phase: "2", label: "FITS parser" },
          { phase: "3", label: "Signal proc." },
          { phase: "4", label: "Renderer" },
          { phase: "5", label: "Dashboard" },
          { phase: "6", label: "Print PDF" },
          { phase: "7", label: "Ship" },
        ].map((step) => (
          <div
            key={step.phase}
            className="rounded-md border border-starlight/10 bg-cosmos/40 px-3 py-2"
          >
            <div className="text-starlight/40">Phase {step.phase}</div>
            <div className="text-starlight/90">{step.label}</div>
          </div>
        ))}
      </div>

      <p className="mt-12 text-xs text-starlight/40">
        Next.js 14 · TypeScript · Tailwind · 8 phases · ~95 hours · 55 PRs
      </p>
    </main>
  );
}
