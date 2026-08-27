import { tgpu, d, std } from 'typegpu';
import type { TgpuRoot } from 'typegpu';
import { STALE_WYSYCHANIA } from '../logika/wysychanie.ts';
import { RDZEN_PEDZLA } from '../logika/pedzel.ts';
import {
  FORMAT_MASKI, GRUPA_PROBKI, GRUPA_ROBOCZA, GRUP_NA_OS, MASKA_ROZMIAR, PROBEK_PROFILU,
  SCHEMAT_WIDOKU_MASKI, Sterowanie, TEMPO_STARZENIA, uvTeksela,
} from './wspolne.ts';
import type { WidokMaski } from './wspolne.ts';

export interface DaneSterowania {
  /** Poprzednia pozycja wskaznika w przestrzeni maski 0..1. */
  p0: [number, number];
  /** Biezaca pozycja wskaznika w przestrzeni maski 0..1. */
  p1: [number, number];
  /** Promien pedzla w przestrzeni maski. */
  promien: number;
  /** 1 = wcisniety, 0 = puszczony. */
  maluje: number;
  /** Czas kroku w sekundach. */
  dt: number;
}

/**
 * ⛔ LUSTRO `odlegloscOdOdcinka` Z `src/logika/odcinek.ts`.
 * ZMIANA JEDNEJ WERSJI WYMAGA ZMIANY DRUGIEJ. Tamta jest testowalna bez GPU i to ona jest
 * zrodlem prawdy o zachowaniu; ta liczy to samo na tekselach.
 *
 * Jedyna roznica wobec wersji z CPU jest w obsludze odcinka zdegenerowanego do punktu: tam jawny
 * warunek `dlugoscKw === 0`, tu dzielenie przez `max(dlugoscKw, 1e-20)`. Wynik jest ten sam
 * (`t = 0`, bo licznik iloczynu skalarnego tez jest wtedy zerem), ale bez galezi i bez NaN-a,
 * ktory w shaderze rozlalby sie na caly teksel.
 */
const odlegloscOdOdcinka = tgpu.fn([d.vec2f, d.vec2f, d.vec2f], d.f32)((p, a, b) => {
  'use gpu';
  const ab = std.sub(b, a);
  const ap = std.sub(p, a);
  const dlugoscKw = std.dot(ab, ab);
  const t = std.clamp(std.dot(ap, ab) / std.max(dlugoscKw, d.f32(1e-20)), d.f32(0), d.f32(1));
  return std.length(std.sub(p, std.add(a, std.mul(ab, t))));
});

/** Deterministyczny hasz punktu siatki — ziarno szumu wartosci. */
const hasz = tgpu.fn([d.vec2f], d.f32)((p) => {
  'use gpu';
  return std.fract(std.sin(std.dot(p, d.vec2f(127.1, 311.7))) * d.f32(43758.5453));
});

/** Szum wartosci: hasz na siatce calkowitej, wygladzony dwuliniowo krzywa smoothstep. */
const szumWartosci = tgpu.fn([d.vec2f], d.f32)((p) => {
  'use gpu';
  const i = std.floor(p);
  const f = std.fract(p);
  const u = std.mul(std.mul(f, f), std.sub(d.vec2f(3), std.mul(f, d.f32(2))));
  const a = hasz(i);
  const b = hasz(std.add(i, d.vec2f(1, 0)));
  const c = hasz(std.add(i, d.vec2f(0, 1)));
  const e = hasz(std.add(i, d.vec2f(1, 1)));
  return std.mix(std.mix(a, b, u.x), std.mix(c, e, u.x), u.y);
});

/** Ile platkow miesci sie na boku maski. 32 daje platki rzedu 16 tekseli, czyli okolo pieciu
 *  w poprzek smugi pedzla — widac ksztalty, a nie ziarno matrycy. */
const PLATKOW_NA_BOK = 32;

/** O ile komorek gladki szum przesuwa siatke platkow. Bez tego granice tworza widoczna kratke. */
const SILA_ZABURZENIA = 1.7;

/** Szerokosc pekniecia jako ulamek komorki. Ponizej tej odleglosci od granicy warstwa schnie
 *  najszybciej, jak umie — stad ciemne szczeliny otwierajace sie miedzy platkami. */
const SZEROKOSC_PEKNIECIA = 0.14;

/**
 * ⛔ SZUM MUSI BYC NIECIAGLY, INACZEJ WARSTWA NIE PEKA, TYLKO SIE ROZMYWA.
 *
 * Zmierzone 2026-08-27, przyrzadem `Maska.probkuj` na 256 tekselach wzdluz osi smugi po 3,6 s
 * schniecia (przy owczesnych `STALE_WYSYCHANIA` 0,14 / 0,22; po ich przepolowieniu ten sam stan
 * warstwy wypada okolo 7 s — porownanie dotyczy szumu, a nie tempa, wiec liczby nizej zostaja). Poprzednia wersja (dwie oktawy GLADKIEGO szumu wartosci, skala 11 i 29) dawala:
 * `przejscia = 2`, `maxSkok = 0.0724`. Czyli na calej dlugosci smugi byly DWA przejscia miedzy
 * „jest warstwa" a „goly ekran" — jedna ciagla plama — a najwiekszy skok miedzy sasiednimi
 * tekselami rowny byl mniej wiecej progowi `0.06`.
 *
 * To jest cala diagnoza. Ostre ciecie ponizej progu DZIALALO, ale przy gladkim polu tempa
 * jedyna nieciaglosc, jaka tworzylo, lezala tam, gdzie warstwa ma juz grubosc 0,06 — czyli
 * 6% bieli, wizualnie czern. Wszystko, co oko naprawde widzi (zakres 0,1–0,6), bylo gladkie.
 * Twarda krawedz istniala i byla niewidoczna.
 *
 * Lekarstwo nie jest w cieciu (to zostaje lustrem `krokWysychania`) ani w stalych wysychania
 * (te sa wspolne z testowana logika), tylko w POLU TEMPA: jedna stala na caly platek, wiec
 * sasiednie platki rozjezdzaja sie grubosciowo i jeden dochodzi do zera, gdy drugi jest jeszcze
 * jasny. Granice komorek dostaja tempo maksymalne, wiec pekniecia otwieraja sie pierwsze.
 * Siatka jest zaburzona gladkim szumem, zeby platki nie ulozyly sie w kratke.
 */
const szum = tgpu.fn([d.vec2f], d.f32)((uv) => {
  'use gpu';
  const p = std.mul(uv, d.f32(PLATKOW_NA_BOK));
  const wolny = std.mul(p, d.f32(0.6));
  const zaburzenie = d.vec2f(
    szumWartosci(wolny) - d.f32(0.5),
    szumWartosci(std.add(wolny, d.vec2f(37.2, 11.7))) - d.f32(0.5),
  );
  const q = std.add(p, std.mul(zaburzenie, d.f32(SILA_ZABURZENIA)));
  // Odleglosc do najblizszej granicy komorki: 0 na granicy, 0,5 w srodku platka.
  const f = std.fract(q);
  const doKrawedzi = std.min(std.min(f.x, d.f32(1) - f.x), std.min(f.y, d.f32(1) - f.y));
  const krawedz = d.f32(1) - std.smoothstep(d.f32(0), d.f32(SZEROKOSC_PEKNIECIA), doKrawedzi);
  // Wnetrze platka: JEDNA stala na caly platek. Granica: zawsze maksymalne tempo.
  return std.clamp(std.mix(hasz(std.floor(q)), d.f32(1), krawedz), d.f32(0), d.f32(1));
});

/** Odcinek, wzdluz ktorego przyrzad probkuje maske. Przestrzen maski 0..1. */
const OdcinekProbki = d.struct({ p0: d.vec2f, p1: d.vec2f });

/** Jedna probka maski sciagnieta na CPU. */
export interface ProbkaMaski {
  /** Grubosc kremu (kanal `r`), 0..1. */
  grubosc: number;
  /** Wiek warstwy (kanal `g`), 0..1. */
  wiek: number;
}

/**
 * Maska kremu: tekstura 512x512, kanal `r` = grubosc 0..1, kanal `g` = wiek warstwy 0..1.
 *
 * ⛔ STALE ROLE TEKSTUR, NIE PING-PONG. WebGPU nie pozwala w jednym przebiegu czytac i pisac tej
 * samej tekstury skladowania, wiec potrzebne sa dwie. Klasyczny ping-pong zamienialby je rolami
 * co klatke — a czytelnicy (scena, licznik pokrycia) przechwytuja widok RAZ, przy budowie potoku,
 * wiec co druga klatka czytaliby teksture nieaktualna. Objawu (migoczaca maska, licznik skaczacy
 * co klatke) szukaloby sie w shaderze, nie w zarzadzaniu teksturami. Dlatego: czytamy zawsze A,
 * piszemy zawsze do B, na koniec kroku kopiujemy B→A.
 */
export class Maska {
  readonly #teksturaA;
  readonly #teksturaB;
  readonly #widokA;
  readonly #sterowanie;
  readonly #potok;
  readonly #odcinekProbki;
  readonly #wynikProbki;
  readonly #potokProbki;

  constructor(root: TgpuRoot) {
    // A — jedyna, ktora ktokolwiek czyta. TEXTURE_BINDING do odczytu, COPY_DST na kopie z B
    // (i na `clear()`, ktore pod spodem jest `queue.writeTexture`).
    const teksturaA = root
      .createTexture({ size: [MASKA_ROZMIAR, MASKA_ROZMIAR], format: FORMAT_MASKI })
      .$overrideFlags(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST)
      .$name('maska-A-odczyt');
    // B — jedyna, do ktorej ktokolwiek pisze. STORAGE_BINDING dla potoku, COPY_SRC na kopie do A.
    const teksturaB = root
      .createTexture({ size: [MASKA_ROZMIAR, MASKA_ROZMIAR], format: FORMAT_MASKI })
      .$overrideFlags(GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC)
      .$name('maska-B-zapis');

    const widokA = teksturaA.createView(SCHEMAT_WIDOKU_MASKI);
    const widokB = teksturaB.createView(d.textureStorage2d(FORMAT_MASKI, 'write-only'));
    const sterowanie = root.createUniform(Sterowanie);

    const malowanie = tgpu.computeFn({
      in: { gid: d.builtin.globalInvocationId },
      workgroupSize: GRUPA_ROBOCZA,
    })((we) => {
      'use gpu';
      // 512 dzieli sie przez 8 bez reszty, wiec kazdy watek trafia w istniejacy teksel —
      // straznik zakresu jest zbedny.
      const xy = d.vec2u(we.gid.x, we.gid.y);
      const uv = uvTeksela(xy);
      const stary = std.textureLoad(widokA.$, xy, 0);

      // WYSYCHANIE — lustro `krokWysychania` z `src/logika/wysychanie.ts`. Stale pochodza
      // stamtad, nie sa tu wpisane po raz drugi.
      const ubytek = sterowanie.$.dt
        * (d.f32(STALE_WYSYCHANIA.baza) + szum(uv) * d.f32(STALE_WYSYCHANIA.amplituda));
      const poWysychaniu = stary.x - ubytek;
      // Ponizej progu warstwa jest scinana OSTRO do zera — stad twarde krawedzie platkow.
      const grubosc = std.select(poWysychaniu, d.f32(0), poWysychaniu < d.f32(STALE_WYSYCHANIA.prog));

      // PEDZEL — odleglosc od ODCINKA miedzy poprzednia a biezaca pozycja wskaznika.
      // ⛔ LUSTRO `sladPedzla` z `src/logika/pedzel.ts`: rdzen odcisku jest pelny do
      // `RDZEN_PEDZLA` promienia i gasnie dopiero na promieniu. Stala pochodzi stamtad, wiec test
      // pokrycia jednym przejazdem liczy dokladnie ten profil, ktory tu jest odciskany.
      const odl = odlegloscOdOdcinka(uv, sterowanie.$.p0, sterowanie.$.p1);
      const pedzel = sterowanie.$.maluje
        * (d.f32(1) - std.smoothstep(sterowanie.$.promien * d.f32(RDZEN_PEDZLA), sterowanie.$.promien, odl));

      const nowaGrubosc = std.clamp(std.max(grubosc, pedzel), d.f32(0), d.f32(1));

      // WIEK WARSTWY. Nalozenie kremu ZERUJE `g` w dotknietych tekselach — swieza warstwa jest
      // znowu biala i dopiero „sie wchlania". To mechanika produktu skin tone correcting.
      const postarzony = std.min(stary.y + sterowanie.$.dt * d.f32(TEMPO_STARZENIA), d.f32(1));
      const wiek = std.mix(postarzony, d.f32(0), std.clamp(pedzel, d.f32(0), d.f32(1)))
        * std.step(d.f32(1e-4), nowaGrubosc);

      std.textureStore(widokB.$, xy, d.vec4f(nowaGrubosc, wiek, 0, 1));
    });

    // --- PRZYRZAD: odczyt maski na CPU ---------------------------------------------------
    // ⚠️ NIE JEST TO OZDOBNIK ANI KOD TYMCZASOWY. Kanal `g` (wiek warstwy) nie ma zadnego innego
    // sposobu weryfikacji: podglad z kroku 4 rysuje wylacznie kanal `r`, a tekstura A ma flagi
    // TEXTURE_BINDING | COPY_DST, wiec nie da sie jej skopiowac do bufora. Maly potok obliczeniowy
    // czytajacy widok A i piszacy do bufora skladowania zamyka te luke bez zmiany flag tekstur.
    const odcinekProbki = root.createUniform(OdcinekProbki);
    const wynikProbki = root
      .createMutable(d.arrayOf(d.vec2f, PROBEK_PROFILU))
      .$name('wynik-probki-maski');

    const probkowanie = tgpu.computeFn({
      in: { gid: d.builtin.globalInvocationId },
      workgroupSize: [GRUPA_PROBKI],
    })((we) => {
      'use gpu';
      const i = we.gid.x;
      // Rownomiernie wzdluz odcinka; przy p0 == p1 wszystkie probki trafiaja w ten sam teksel.
      const t = d.f32(i) / d.f32(PROBEK_PROFILU - 1);
      const uv = std.mix(odcinekProbki.$.p0, odcinekProbki.$.p1, t);
      const xy = d.vec2u(
        d.u32(std.clamp(uv.x * d.f32(MASKA_ROZMIAR), d.f32(0), d.f32(MASKA_ROZMIAR - 1))),
        d.u32(std.clamp(uv.y * d.f32(MASKA_ROZMIAR), d.f32(0), d.f32(MASKA_ROZMIAR - 1))),
      );
      const teksel = std.textureLoad(widokA.$, xy, 0);
      wynikProbki.$[i] = d.vec2f(teksel.x, teksel.y);
    });

    this.#teksturaA = teksturaA;
    this.#teksturaB = teksturaB;
    this.#widokA = widokA;
    this.#sterowanie = sterowanie;
    this.#potok = root.createComputePipeline({ compute: malowanie });
    this.#odcinekProbki = odcinekProbki;
    this.#wynikProbki = wynikProbki;
    this.#potokProbki = root.createComputePipeline({ compute: probkowanie });
  }

  /** Jeden krok symulacji: malowanie + wysychanie, a na koniec kopia B→A. */
  krok(dane: DaneSterowania): void {
    this.#sterowanie.write({
      p0: d.vec2f(dane.p0[0], dane.p0[1]),
      p1: d.vec2f(dane.p1[0], dane.p1[1]),
      promien: dane.promien,
      maluje: dane.maluje,
      dt: dane.dt,
      zapas: 0,
    });
    this.#potok.dispatchWorkgroups(GRUP_NA_OS, GRUP_NA_OS);
    // Kopia 2 MB na klatke, rzedu 0,1 ms. Cena za JEDEN staly widok odczytu dla calej aplikacji.
    this.#teksturaA.copyFrom(this.#teksturaB);
  }

  /**
   * Czysci maske. Wystarczy wyzerowac A: pierwszy `krok()` po wyczyszczeniu nadpisuje KAZDY teksel
   * B wartoscia policzona z A, wiec stara zawartosc B nie ma jak wrocic. B nie dostaje przez to
   * flagi COPY_DST, ktorej `clear()` by wymagal.
   */
  wyczysc(): void {
    this.#teksturaA.clear();
  }

  /**
   * Sciaga na CPU `PROBEK_PROFILU` probek maski rozlozonych rownomiernie wzdluz odcinka
   * `(x0, y0) -> (x1, y1)` w przestrzeni maski. Przy odcinku zdegenerowanym do punktu wszystkie
   * probki dotycza tego samego teksela.
   */
  async probkuj(x0: number, y0: number, x1: number, y1: number): Promise<ProbkaMaski[]> {
    this.#odcinekProbki.write({ p0: d.vec2f(x0, y0), p1: d.vec2f(x1, y1) });
    this.#potokProbki.dispatchWorkgroups(PROBEK_PROFILU / GRUPA_PROBKI);
    const surowe = await this.#wynikProbki.read();
    return surowe.map((probka) => ({ grubosc: probka.x, wiek: probka.y }));
  }

  /** Jedna probka maski w zadanym punkcie. */
  async probka(x: number, y: number): Promise<ProbkaMaski> {
    const probki = await this.probkuj(x, y, x, y);
    return probki[0]!;
  }

  /** STALY przez cale zycie obiektu — wolno przechwycic raz, przy budowie potoku czytelnika. */
  widokDoOdczytu(): WidokMaski {
    return this.#widokA;
  }
}
