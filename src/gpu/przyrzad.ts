import { tgpu, d, std } from 'typegpu';
import type { TgpuRoot } from 'typegpu';
import { POLE, WYCINEK_SZKLA } from './wspolne.ts';
import type { KolorSceny } from './obraz.ts';

/**
 * PRZYRZAD POMIAROWY, NIE KOD GRY.
 *
 * Siatka probek rozpieta na CALYM POLU DO ZABAWY, z ktorej bramki czytaja srednia barwe, jasnosc
 * i blask wycinka. Wydzielone ze `scena.ts` (zadanie C2, uwaga W3): scena nie ma powodu wiedziec,
 * jak mierzy sie jej wlasny obraz, a `scena.ts` urosl przez to do 706 linii.
 *
 * ⚠️ SIATKA IDZIE PO `POLE`, NIE PO OBSZARZE LICZONYM. Odkad mianownikiem pokrycia jest czolo
 * chmurki, siatka rozpieta na nim nie widzialaby ani swiecacej powierzchni, ani gruntu kafla —
 * czyli niczego, co bramki mierza. Pole obejmuje jedno i drugie.
 *
 * ⚠️ DLACZEGO NIE `drawImage` Z KANWY. Zmierzone w zadaniu C: przerysowanie kanwy WebGPU do
 * `OffscreenCanvas` daje obraz CALKOWICIE PRZEZROCZYSTY (wszystkie cztery skladowe zerowe, takze
 * w srodku swiecacego pola) — kontekst nie zachowuje bufora. Zamiast kombinowac z flagami kanwy
 * potok obliczeniowy wola TE SAMA funkcje `kolorSceny`, ktorej uzywa fragment.
 *
 * ⚠️ Czego ten przyrzad NIE widzi: tego, ze potok renderujacy w ogole rysuje. Od tego sa zrzuty
 * ekranu i osobny pomiar luminancji po stronie Node'a (`scripts/luminancja-png.mjs`).
 */

/** Bok siatki, ktora przyrzad rozpina na polu do zabawy. 64x64 = 4096 probek. */
const PROBEK_NA_BOK = 64;

/** Usredniona barwa wycinka kadru, skladowe 0..1. */
export interface Barwa {
  r: number;
  g: number;
  b: number;
}

export interface PrzyrzadKadru {
  /** Odpala potok probkujacy i sciaga siatke na CPU. Wolane co kilkanascie klatek z petli. */
  odswiez: () => Promise<void>;
  /**
   * Srednia barwa wycinka podanego w przestrzeni MASKI; domyslnie cale pole do zabawy.
   * ⛔ RZUCA, gdy wycinek nie ma czesci wspolnej z siatka albo gdy siatka nie zostala jeszcze
   * odczytana — patrz `sredniaBarwa`.
   */
  barwa: (x0?: number, y0?: number, x1?: number, y1?: number) => Barwa;
  /** Srednia luminancja wycinka; domyslnie SAMO SWIECACE POLE, patrz `WYCINEK_SZKLA`. */
  jasnosc: (x0?: number, y0?: number, x1?: number, y1?: number) => number;
  /**
   * ⛔ MIARA BRAMKI 1: maksimum ze srednich skladowych wycinka, domyslnie `WYCINEK_SZKLA`.
   *
   * Dlaczego nie `jasnosc`. Pole swieci barwa NASYCONA — pomaranczem w dzien, blekitem w nocy —
   * a luminancja jest miara SZAROSCIOWA: bialy krem ma wieksza luminancje niz gleboki pomarancz.
   * Na obrzezu pola, gdzie emisja jest slabsza, zakrycie kremem PODNOSILO luminancje, choc blask
   * gasl. Zmierzone 2026-08-27, wycinek [0,10; 0,16]..[0,20; 0,42], pokrycie 51,8%:
   *
   *   luminancja  0,7235 → 0,7799 (W GORE, mimo zgaszonej emisji)
   *   maksimum    0,8987 → 0,8463 (w dol, zgodnie z mechanika)
   *
   * Maksimum skladowych idzie za emisja niezaleznie od odcienia, wiec to ono mowi o blasku.
   * Bramka mierzaca luminancje mierzylaby wypadkowa dwoch przeciwnych efektow — dokladnie ten sam
   * blad ksztaltu, przez ktory poprzednia bramka usredniala razem szklo, obudowe i chmurke.
   */
  blask: (x0?: number, y0?: number, x1?: number, y1?: number) => number;
}

export function stworzPrzyrzadKadru(root: TgpuRoot, kolorSceny: KolorSceny): PrzyrzadKadru {
  const probek = PROBEK_NA_BOK * PROBEK_NA_BOK;
  const wynik = root.createMutable(d.arrayOf(d.vec4f, probek)).$name('proba-kadru');

  const proba = tgpu.computeFn({
    in: { gid: d.builtin.globalInvocationId },
    workgroupSize: [8, 8],
  })((we) => {
    'use gpu';
    const t = d.vec2f(
      (d.f32(we.gid.x) + d.f32(0.5)) / d.f32(PROBEK_NA_BOK),
      (d.f32(we.gid.y) + d.f32(0.5)) / d.f32(PROBEK_NA_BOK),
    );
    const p = std.mix(d.vec2f(POLE.x0, POLE.y0), d.vec2f(POLE.x1, POLE.y1), t);
    wynik.$[we.gid.y * d.u32(PROBEK_NA_BOK) + we.gid.x] = d.vec4f(kolorSceny(p), 1);
  });
  const potok = root.createComputePipeline({ compute: proba });

  const siatkaR = new Float64Array(probek);
  const siatkaG = new Float64Array(probek);
  const siatkaB = new Float64Array(probek);
  let siatkaGotowa = false;
  let odczytWToku = false;

  async function odswiez(): Promise<void> {
    if (odczytWToku) return;
    odczytWToku = true;
    try {
      potok.dispatchWorkgroups(PROBEK_NA_BOK / 8, PROBEK_NA_BOK / 8);
      const surowe = await wynik.read();
      for (let i = 0; i < probek; i++) {
        const probka = surowe[i]!;
        siatkaR[i] = probka.x;
        siatkaG[i] = probka.y;
        siatkaB[i] = probka.z;
      }
      siatkaGotowa = true;
    } finally {
      odczytWToku = false;
    }
  }

  /**
   * Indeks komorki siatki dla wspolrzednej maski — BEZ obcinania.
   *
   * ⛔ TU SIEDZIALA USTERKA W1 („nieudany odczyt udajacy zero"). Poprzednia wersja obcinala wynik
   * do `[0, 64]` WLACZNIE, wiec dla wycinka lezacego w calosci po PRAWEJ albo PONIZEJ pola
   * wychodzilo `ix0 = 64`, `ix1 = 65`, petla `for (i = ix0; i < min(ix1, 64))` nie robila
   * ani jednego obrotu, `ile` zostawalo zerem i funkcja zwracala wiarygodnie wygladajaca CZERN.
   * Po lewej i u gory obciecie do zera dzialalo poprawnie, wiec bledne zachowanie bylo jeszcze
   * do tego niesymetryczne, a komentarz obiecywal „to, co na brzegu".
   *
   * Teraz obcinanie robi `sredniaBarwa` — swiadomie, na czesci wspolnej wycinka z siatka — a brak
   * czesci wspolnej konczy sie wyjatkiem, nie kolorem.
   */
  function komorka(wartosc: number, od: number, do_: number): number {
    return Math.round(((wartosc - od) / (do_ - od)) * PROBEK_NA_BOK);
  }

  function sredniaBarwa(x0: number, y0: number, x1: number, y1: number): Barwa {
    if (!siatkaGotowa) {
      // ⛔ NIE `{r:0,g:0,b:0}`. Przed pierwszym odczytem siatki nie ma czego usredniac, a zwrocenie
      // zer daloby bramce czern nie do odroznienia od prawdziwie czarnego kadru.
      throw new Error('siatka probek kadru nie zostala jeszcze odczytana z GPU');
    }
    const surowyX0 = komorka(Math.min(x0, x1), POLE.x0, POLE.x1);
    const surowyX1 = Math.max(surowyX0 + 1, komorka(Math.max(x0, x1), POLE.x0, POLE.x1));
    const surowyY0 = komorka(Math.min(y0, y1), POLE.y0, POLE.y1);
    const surowyY1 = Math.max(surowyY0 + 1, komorka(Math.max(y0, y1), POLE.y0, POLE.y1));
    const ix0 = Math.max(0, surowyX0);
    const ix1 = Math.min(PROBEK_NA_BOK, surowyX1);
    const iy0 = Math.max(0, surowyY0);
    const iy1 = Math.min(PROBEK_NA_BOK, surowyY1);
    if (ix1 <= ix0 || iy1 <= iy0) {
      throw new Error(
        `wycinek [${x0}, ${y0}]..[${x1}, ${y1}] nie ma czesci wspolnej z polem do zabawy `
        + `[${POLE.x0}, ${POLE.y0}]..[${POLE.x1}, ${POLE.y1}] — siatka probek pokrywa tylko je`,
      );
    }
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let ile = 0;
    for (let j = iy0; j < iy1; j++) {
      for (let i = ix0; i < ix1; i++) {
        const k = j * PROBEK_NA_BOK + i;
        sr += siatkaR[k]!;
        sg += siatkaG[k]!;
        sb += siatkaB[k]!;
        ile++;
      }
    }
    // Straznik ostatniej szansy: przy poprawnych granicach `ile` nie moze byc zerem, ale gdyby
    // kiedys mogl, ma o tym powiedziec, a nie oddac czern.
    if (ile === 0) throw new Error('siatka probek kadru: pusty wycinek mimo poprawnych granic');
    return { r: sr / ile, g: sg / ile, b: sb / ile };
  }

  return {
    odswiez,
    barwa: (x0 = POLE.x0, y0 = POLE.y0, x1 = POLE.x1, y1 = POLE.y1) =>
      sredniaBarwa(x0, y0, x1, y1),
    jasnosc: (
      x0 = WYCINEK_SZKLA.x0,
      y0 = WYCINEK_SZKLA.y0,
      x1 = WYCINEK_SZKLA.x1,
      y1 = WYCINEK_SZKLA.y1,
    ) => {
      const { r, g, b } = sredniaBarwa(x0, y0, x1, y1);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },
    blask: (
      x0 = WYCINEK_SZKLA.x0,
      y0 = WYCINEK_SZKLA.y0,
      x1 = WYCINEK_SZKLA.x1,
      y1 = WYCINEK_SZKLA.y1,
    ) => {
      // ⚠️ MAKSIMUM ZE SREDNICH, NIE SREDNIA Z MAKSIMOW. Ta pierwsza kolejnosc mierzy „jak mocno
      // swieci najjasniejszy KANAL calego wycinka"; druga mierzylaby najjasniejszy PIKSEL i przy
      // jednym przepalonym tekselu dawalaby 1,0 niezaleznie od tego, ile kremu lezy dokola.
      const { r, g, b } = sredniaBarwa(x0, y0, x1, y1);
      return Math.max(r, g, b);
    },
  };
}
