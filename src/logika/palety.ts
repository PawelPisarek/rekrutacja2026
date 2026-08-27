/** Kolor jako trojka RGB w zakresie 0..1 — format, ktorego oczekuje TypeGPU/WGSL. */
export type Kolor = [number, number, number];

const WZORZEC_HEX_SZESC_CYFR = /^#[0-9a-fA-F]{6}$/;

/** Zamienia zapis `#rrggbb` na trojke 0..1. Zly zapis (skrocony, bez krzyzyka, zle cyfry) RZUCA —
 *  nigdy nie zwraca `NaN`, bo `NaN` przeciekloby cicho do shadera i dalo martwy piksel bez sladu. */
export function hexNaRgb(hex: string): Kolor {
  if (!WZORZEC_HEX_SZESC_CYFR.test(hex)) {
    throw new Error(`zly zapis koloru (oczekiwano #rrggbb): ${hex}`);
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

/** Kolory dnia — zmierzone z renderow produktu SPF50. Nie dobierac, nie zaokraglac. */
export const PALETA_DZIEN: Record<string, Kolor> = {
  piasek: hexNaRgb('#caaa9c'),
  piasekCien: hexNaRgb('#c4a69b'),
  krem: hexNaRgb('#f5e2d3'),
  kremCieply: hexNaRgb('#f3dccd'),
  brzoskwinia: hexNaRgb('#f3d4ac'),
  brzoskwiniaCien: hexNaRgb('#eccbab'),
};

/**
 * Kolory nocy — zmierzone z renderow produktu Sleeping.
 *
 * ⚠️ `poduszka*`/`lawenda*` powstaly z kwantyzacji CALEGO zdjecia (tlo + poduszka), NIE ze
 * slociczka — sa poprawne jako barwy TLA sceny nocnej, ale nie wolno ich uzywac jako koloru
 * kremu. `wieczko*`/`korpus*` zmierzone dzis ponownie, kadrujac do samego opakowania
 * (skan pasami, kadr zweryfikowany) — to one sa barwa produktu i to do nich dojrzewa krem.
 * Nie dobierac, nie zaokraglac.
 */
export const PALETA_NOC: Record<string, Kolor> = {
  poduszka: hexNaRgb('#cbcbcc'),
  poduszkaJasna: hexNaRgb('#d4d4d4'),
  poduszkaCien: hexNaRgb('#c4c4c4'),
  poduszkaGleboka: hexNaRgb('#bbbbbc'),
  lawendaJasna: hexNaRgb('#c9cbea'),
  lawendaSrednia: hexNaRgb('#c4c4e5'),
  lawendaCiemna: hexNaRgb('#babbdd'),
  lawenda: hexNaRgb('#9b9abd'),
  /** Wieczko slociczka — jasny liliowy. Docelowa barwa dojrzalego kremu nocnego. */
  wieczko: hexNaRgb('#eee1fa'),
  wieczkoJasne: hexNaRgb('#f2e4fb'),
  wieczkoCien: hexNaRgb('#d9c4ec'),
  /** Korpus slociczka — ciepla kremowa biel. Druga nuta dojrzalego kremu. */
  korpus: hexNaRgb('#ede1dc'),
  korpusCien: hexNaRgb('#ebdeda'),
  korpusGleboki: hexNaRgb('#eadbd6'),
};
