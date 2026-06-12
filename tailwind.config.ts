import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Spectral palette — cool dark, like an observatory control room
        void: "#05060a",
        cosmos: "#0b0e1a",
        nebula: "#1a1f3a",
        starlight: "#e8ecff",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
