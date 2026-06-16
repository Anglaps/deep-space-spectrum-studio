import { readManifest } from "@/lib/spectra/load";

export default async function Home() {
  const { spectra } = await readManifest();
  const firstSpectrum = spectra[0]?.id ?? "";
  const phases = [
    { phase: "0", label: "Bootstrap", done: true },
    { phase: "1", label: "MAST data", done: true },
    { phase: "2", label: "FITS parser", done: true },
    { phase: "3", label: "Signal proc.", done: false },
    { phase: "4", label: "Renderer", done: false },
    { phase: "5", label: "Dashboard", done: false },
    { phase: "6", label: "Print PDF", done: false },
    { phase: "7", label: "Ship", done: false },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-6 text-xs uppercase tracking-[0.35em] text-starlight/50">
        Stardance Hack Club · Phase 2
      </p>
      <h1 className="mb-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Deep Space Spectrum <br /> &amp; Chemical Fingerprint Studio
      </h1>
      <p className="mb-8 max-w-xl text-balance text-starlight/70">
        A web studio that ingests real NASA FITS spectra, isolates their
        chemical fingerprints, and exports print-ready 10&times;10 inch
        vector art.
      </p>

      <a
        href={`/spectrum/${firstSpectrum}`}
        className="mb-12 rounded-md border border-starlight/20 px-5 py-2 text-sm text-starlight transition-colors hover:border-starlight/50 hover:bg-nebula/30"
      >
        View a decoded spectrum →
      </a>

      <div className="grid w-full max-w-lg grid-cols-2 gap-3 text-left text-xs sm:grid-cols-4">
        {phases.map((step) => (
          <div
            key={step.phase}
            className={`rounded-md border px-3 py-2 ${
              step.done
                ? "border-starlight/25 bg-nebula/30"
                : "border-starlight/10 bg-cosmos/40"
            }`}
          >
            <div className="flex items-center justify-between text-starlight/40">
              <span>Phase {step.phase}</span>
              {step.done && <span className="text-starlight/70">✓</span>}
            </div>
            <div className={step.done ? "text-starlight" : "text-starlight/90"}>
              {step.label}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-12 text-xs text-starlight/40">
        Next.js 14 · TypeScript · Tailwind · hand-rolled FITS parser · real SDSS DR17 data
      </p>
    </main>
  );
}
