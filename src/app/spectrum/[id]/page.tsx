import { notFound } from "next/navigation";
import Link from "next/link";
import { loadSpectrum, readManifest, toDTO } from "@/lib/spectra/load";
import { analyzeSpectrum } from "@/lib/spectra/analyze";
import SpectrumChart from "@/components/SpectrumChart";

export async function generateStaticParams() {
  const { spectra } = await readManifest();
  return spectra.map((s) => ({ id: s.id }));
}

export default async function SpectrumPage({
  params,
}: {
  params: { id: string };
}) {
  const spectrum = await loadSpectrum(params.id);
  if (!spectrum) notFound();

  const dto = toDTO(spectrum);
  const sampleCount = spectrum.wavelength.length;
  const analysis = analyzeSpectrum(spectrum);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/"
        className="text-xs text-starlight/45 transition-colors hover:text-starlight/80"
      >
        ← Studio
      </Link>

      <header className="mb-8 mt-4">
        <p className="mb-2 text-xs uppercase tracking-[0.3em] text-starlight/40">
          {spectrum.meta.instrument}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {spectrum.meta.object ?? spectrum.id}
        </h1>
        <p className="mt-2 text-sm text-starlight/50">
          {sampleCount.toLocaleString()} samples ·{" "}
          {Math.round(spectrum.wavelength[0])}–
          {Math.round(spectrum.wavelength[sampleCount - 1])} Å ·{" "}
          {spectrum.meta.source}
        </p>
      </header>

      <SpectrumChart spectrum={dto} />

      <section className="mt-10">
        <h2 className="text-sm uppercase tracking-[0.2em] text-starlight/40">
          Chemical fingerprint
        </h2>
        <p className="mt-2 text-sm text-starlight/50">
          {analysis.lines.length} features detected above the noise ·{" "}
          {analysis.fingerprint.length} matched to known transitions
        </p>

        {analysis.fingerprint.length > 0 ? (
          <ul className="mt-5 divide-y divide-starlight/10 border-y border-starlight/10">
            {analysis.fingerprint.map((f) => (
              <li
                key={`${f.label}-${f.kind}`}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <span className="font-medium text-starlight">
                  {f.element}{" "}
                  <span className="text-starlight/55">{f.label}</span>
                </span>
                <span className="text-sm tabular-nums text-starlight/55">
                  {f.kind} · obs {f.observedLambda.toFixed(1)} Å (rest{" "}
                  {f.restLambda} Å)
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-starlight/45">
            No catalogued transitions matched within tolerance. Redshift
            correction and a fuller line list (a later phase) will recover more.
          </p>
        )}
      </section>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-starlight/45">
        Decoded from the raw FITS binary table by the studio&apos;s own parser,
        then continuum-normalized and scanned for absorption and emission lines.
        Dashed markers on the chart show rest-frame line positions; matched
        features above feed the generative renderer in the next phase.
      </p>
    </main>
  );
}
