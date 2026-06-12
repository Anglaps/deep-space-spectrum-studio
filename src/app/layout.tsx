import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deep Space Spectrum & Chemical Fingerprint Studio",
  description:
    "Generative engineering suite that decodes real NASA spectroscopic FITS files into print-ready chemical-fingerprint vector art.",
  applicationName: "Deep Space Spectrum Studio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-void text-starlight">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
