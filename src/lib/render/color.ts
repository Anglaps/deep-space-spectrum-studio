export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Approximate the perceived color of a wavelength of visible light, using the
 * standard piecewise approximation (after Dan Bruton). Input is in Angstrom.
 *
 * The visible range is ~3800-7800 A. Wavelengths outside that still need a
 * stable color for the artwork, so they clamp to the nearest visible edge hue
 * (deep violet below, deep red above) rather than fading to black.
 */
export function wavelengthToRGB(angstrom: number): RGB {
  const nm = angstrom / 10;
  // Clamp to the visible band edges so UV/IR features keep an edge hue.
  const w = Math.max(380, Math.min(780, nm));

  let r = 0;
  let g = 0;
  let b = 0;
  if (w < 440) {
    r = -(w - 440) / (440 - 380);
    b = 1;
  } else if (w < 490) {
    g = (w - 440) / (490 - 440);
    b = 1;
  } else if (w < 510) {
    g = 1;
    b = -(w - 510) / (510 - 490);
  } else if (w < 580) {
    r = (w - 510) / (580 - 510);
    g = 1;
  } else if (w < 645) {
    r = 1;
    g = -(w - 645) / (645 - 580);
  } else {
    r = 1;
  }

  // Intensity falls off near the limits of human vision.
  let factor = 1;
  if (w < 420) factor = 0.3 + (0.7 * (w - 380)) / (420 - 380);
  else if (w > 700) factor = 0.3 + (0.7 * (780 - w)) / (780 - 700);

  const gamma = 0.8;
  const adjust = (c: number) => (c <= 0 ? 0 : Math.round(255 * (c * factor) ** gamma));
  return { r: adjust(r), g: adjust(g), b: adjust(b) };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
