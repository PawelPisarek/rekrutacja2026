import { tgpu, d, std } from 'typegpu';
import type { TgpuTextureView } from 'typegpu';
import {
  LINIA_CZOLA, POLOWA_KAPSULY, PROMIEN_KAPSULY, SPOD, SRODEK_CHMURKI, ZLACZENIE_SPODU,
} from '../logika/chmurka.ts';

/**
 * Bok tekstury maski. 512 dzieli sie przez 8, wiec grupa robocza [8, 8] pokrywa maske DOKLADNIE
 * i shader nie potrzebuje straznika zakresu — kazdy watek trafia w istniejacy teksel.
 */
export const MASKA_ROZMIAR = 512;

/** Rozmiar grupy roboczej obu potokow obliczeniowych (malowanie i licznik pokrycia). */
export const GRUPA_ROBOCZA: number[] = [8, 8];

/** Ile grup roboczych na os pokrywa cala maske. 512 / 8 = 64, bez reszty. */
export const GRUP_NA_OS = MASKA_ROZMIAR / GRUPA_ROBOCZA[0]!;

/**
 * ⛔ FORMAT MASKI: rgba16float, NIE rgba8unorm.
 *
 * Osiem bitow na kanal daje krok kwantyzacji 1/255 ≈ 0,0039. Wysychanie odejmuje na klatke
 * `dt * (baza + szum * amplituda)`, czyli przy 60 Hz od 0,0012 do 0,0030 — czyli MNIEJ niz jeden
 * krok kwantyzacji. Po zaokragleniu KAZDY teksel schodzilby o dokladnie jeden krok na klatke
 * niezaleznie od szumu (albo nie schodzil wcale), wiec warstwa plowialaby rownomiernie zamiast
 * pekac w platki — dokladnie to, przed czym ostrzega `src/logika/wysychanie.ts`. W rgba16float
 * krok przy wartosci 0,5 to okolo 0,0005, wiec szum jest widoczny.
 *
 * ⚠️ Liczby przeliczone 2026-08-27 po przepolowieniu tempa schniecia. Wolniejsze schniecie
 * ZAOSTRZA ten argument: ubytek na klatke zszedl PONIZEJ kroku kwantyzacji na calym zakresie
 * szumu, wiec przy osmiu bitach czesc tekseli nie schodzilaby wcale.
 *
 * Koszt: kopia B→A na klatke rosnie z 1 MB do 2 MB. To wciaz ulamek milisekundy.
 */
export const FORMAT_MASKI = 'rgba16float' as const;

/**
 * Sterowanie pedzlem, przekazywane do potoku malowania jako uniform.
 *
 * `p0`/`p1` sa w przestrzeni maski 0..1 — poprzednia i biezaca pozycja wskaznika. Pedzel liczy
 * odleglosc od ODCINKA miedzy nimi (patrz `src/logika/odcinek.ts`), bo pojedynczy okrag na
 * zdarzenie zostawia przy szybkim ruchu kropki zamiast smugi.
 */
export const Sterowanie = d.struct({
  p0: d.vec2f,
  p1: d.vec2f,
  /** Promien pedzla w przestrzeni maski (0..1). */
  promien: d.f32,
  /** 1 = wskaznik wcisniety, 0 = puszczony. */
  maluje: d.f32,
  /** Czas kroku w sekundach — wchodzi do wysychania. */
  dt: d.f32,
  /** Wyrownanie do 32 B; miejsce na przyszly parametr bez zmiany ukladu. */
  zapas: d.f32,
});

/**
 * ⛔ POLE DO ZABAWY TO CALY KAFEL. JEDEN KSZTALT, NIE DWA.
 *
 * ⚠️ TO JEST DRUGA REKLAMACJA TEJ SAMEJ RZECZY — „prostokat w prostokacie". Za pierwszym razem
 * wypadla ciemna obudowa telefonu (stala `RAMKA_TELEFONU`), ale zostal DRUGI ksztalt: wciety
 * zaokraglony prostokat swiecacej powierzchni, obiegniety jasnym gruntem. Dwa zagniezdzone
 * zaokraglone prostokaty z osobnymi promieniami rogow czytaja sie jako ramka w ramce, niezaleznie
 * od tego, jak waski jest margines — zwezenie go z 0,08 na 0,04 problemu NIE rozwiazalo.
 *
 * Dlatego pole nie ma juz wlasnej krawedzi: swiecenie dochodzi do samego brzegu kanwy, a jedyne
 * zaokraglenie w calym dodatku robi CSS (`#kafel { border-radius }` + `overflow: hidden`).
 * Razem z ta stala wypadly `ROG_POLA`, `sdfProstokat`, `GRUNT_*` i cala poswiata — poswiata
 * z definicji istniala „na zewnatrz pola", a zewnetrza juz nie ma.
 *
 * ⚠️ DO ZADANIA C2 TA STALA NAZYWALA SIE `WROG` I BYLA MIANOWNIKIEM POKRYCIA. Nie jest juz nim:
 * liczy sie wylacznie czolo chmurki (`obszarWroga`). Zostaje jako granice siatki probek przyrzadu
 * — czyli po prostu „caly kadr".
 */
export const POLE = { x0: 0, x1: 1, y0: 0, y1: 1 } as const;

/**
 * ⛔ WYCINEK SAMEGO SWIECACEGO SZKLA — punkt odniesienia bramki „krem przygasza powierzchnie".
 *
 * Bramka 1 do zadania C2 usredniala CALY obszar wroga, w ktorym mieszkaly takze obudowa (~13%
 * powierzchni, nieuczestniczaca w mechanice) i chmurka. Obie sa ciemne, wiec biala warstwa
 * kremu je ROZJASNIALA i bramka mierzyla wypadkowa dwoch przeciwnych efektow zamiast jednego.
 * To ona wymusila rozjasnianie obudowy w zadaniu C i to ona przewracala sie na wariancie
 * goracym, gdzie spieczona chmurka jest jeszcze ciemniejsza.
 *
 * Ten wycinek lezy w gornej czesci pola, z dala od krawedzi kadru i powyzej chmurki razem
 * z jej cieniem. Nie ma w nim nic poza swiecaca powierzchnia, wiec
 * bramka dowodzi dokladnie jednej rzeczy.
 *
 * ⚠️ Gorna krawedz sylwetki lezy na `y = 0,552` (policzone, `logika/chmurka.ts`), wiec
 * `y1 = 0,42` zostawia jeszcze zapas na jej cien. Ani powiekszenie postaci w zadaniu C2, ani
 * zamiana sylwetki na kapsule tego wycinka nie naruszyly — pilnuje tego test `chmurka.test.ts`.
 */
export const WYCINEK_SZKLA = { x0: 0.18, x1: 0.82, y0: 0.16, y1: 0.42 } as const;

/** Powyzej tej grubosci teksel liczy sie jako pokryty. */
export const PROG_POKRYCIA = 0.25;

/**
 * Ile wieku (kanal `g`) przybywa na sekunde tekselowi, ktorego nikt nie domalowuje.
 *
 * ⚠️ TO JEST SKALA CZASU, KTORA ZADANIE C ZAMIENI NA KOLOR: `g` idzie od 0 (swieza, biala warstwa)
 * do 1 (wchlonieta). Przy 0,45/s pelne wchloniecie trwa okolo 2,2 s, czyli krocej, niz warstwa
 * schnie — swiezosc gasnie pierwsza, dopiero potem znika sam krem. Zmiana tej liczby zmienia
 * tempo przejscia barwy, nie tempo znikania.
 */
export const TEMPO_STARZENIA = 0.45;

/**
 * Ile tekseli odczytuje jeden przebieg przyrzadu probkujacego maske (`Maska.probkuj`).
 * Staly rozmiar, bo bufor wyniku ma staly schemat.
 */
export const PROBEK_PROFILU = 256;

/** Rozmiar grupy roboczej przyrzadu probkujacego; 256 / 64 = 4 grupy, bez reszty. */
export const GRUPA_PROBKI = 64;

/** Gladkie zlaczenie dwoch odleglosci. ⚠️ LUSTRO `zlaczGladko` z `src/logika/chmurka.ts`. */
export const zlaczGladko = tgpu.fn([d.f32, d.f32, d.f32], d.f32)((a, b, k) => {
  'use gpu';
  const h = std.clamp(d.f32(0.5) + d.f32(0.5) * (b - a) / k, d.f32(0), d.f32(1));
  return std.mix(b, a, h) - k * h * (d.f32(1) - h);
});

/** Gladkie PRZECIECIE. ⚠️ LUSTRO `przetnijGladko` z `src/logika/chmurka.ts`. */
export const przetnijGladko = tgpu.fn([d.f32, d.f32, d.f32], d.f32)((a, b, k) => {
  'use gpu';
  return -zlaczGladko(-a, -b, k);
});

/**
 * ⚠️ LUSTRO `sdfChmurki` z `src/logika/chmurka.ts`. ZMIANA JEDNEJ WERSJI WYMAGA ZMIANY DRUGIEJ.
 * Tamta jest zrodlem prawdy (mierzalna bez GPU), ta liczy to samo we fragmencie i w liczniku.
 * ⛔ WYMIARY KAPSULY SA IMPORTOWANE, NIE WPISANE — jest ich jeden komplet na caly projekt.
 *
 * Kapsula lezaca: odleglosc do poziomego odcinka o polowie dlugosci `POLOWA_KAPSULY` minus
 * `PROMIEN_KAPSULY`. Daje JEDNA ciagla gorna krawedz — powod tego ksztaltu opisuje
 * `logika/chmurka.ts`. Ostatni krok — przeciecie z polplaszczyzna `y <= SPOD` — daje PLASKI SPOD.
 *
 * `p` jest wzgledem srodka postaci.
 */
export const sdfChmurki = tgpu.fn([d.vec2f], d.f32)((p) => {
  'use gpu';
  const wzdluz = std.max(std.abs(p.x) - d.f32(POLOWA_KAPSULY), d.f32(0));
  const kapsula = std.length(d.vec2f(wzdluz, p.y)) - d.f32(PROMIEN_KAPSULY);
  return przetnijGladko(kapsula, p.y - d.f32(SPOD), d.f32(ZLACZENIE_SPODU));
});

/** Punkt maski wzgledem srodka chmurki. Jedno miejsce, w ktorym siedzi to przesuniecie. */
export const wzgledemChmurki = tgpu.fn([d.vec2f], d.vec2f)((uv) => {
  'use gpu';
  return std.sub(uv, d.vec2f(SRODEK_CHMURKI.x, SRODEK_CHMURKI.y));
});

/**
 * ⛔ 1 NA CZOLE CHMURKI, 0 POZA — I TO JEST CALY MIANOWNIK POKRYCIA.
 *
 * JEDNA definicja na caly projekt: licznik pokrycia i fragment pytaja o ten sam ksztalt. Dwie
 * kopie rozjechalyby sie po cichu, a objaw — „licznik rosnie tam, gdzie nic nie widac" —
 * szukaloby sie w shaderze.
 *
 * ⚠️ ZMIANA ZADANIA C2. Do tej pory obszarem liczonym byl prostokat na caly kafel, przez co
 * celem malowania byl kafel, a nie chmurka: gracz wodzil palcem po calej powierzchni i zaslanial
 * soba dokladnie te rzecz, dla ktorej maluje (uzytkownik zglosil, ze malujac palcem, przestaje
 * widziec maskotke).
 * Teraz liczy sie wylacznie GORNA POWIERZCHNIA postaci — czolo, nad oczami. Krem wolno
 * rozsmarowac gdziekolwiek po polu, ale punkty daje tylko to, co wyladowalo na czole, wiec dlon
 * pracuje NAD twarza i mina zostaje widoczna w trakcie malowania.
 *
 * ⚠️ CHMURKA NIE KOLYSZE SIE JUZ W PIONIE. Kolysanie bylo funkcja czasu, a licznik pokrycia
 * nie ma uniformu sceny — ksztalt liczony rozjezdzalby sie z rysowanym o +-0,008 w kazdej
 * klatce. Ruch chmurki daje teraz mina i drganie powietrza nad polem, nie przesuwanie sylwetki.
 */
export const obszarWroga = tgpu.fn([d.vec2f], d.f32)((uv) => {
  'use gpu';
  const p = wzgledemChmurki(uv);
  const wSylwetce = std.step(sdfChmurki(p), d.f32(0));
  const nadOczami = std.step(p.y, d.f32(LINIA_CZOLA));
  return wSylwetce * nadOczami;
});

/**
 * Srodek teksela o wspolrzednych calkowitych, w przestrzeni maski 0..1.
 * Wspolne dla obu potokow, zeby licznik i pedzel mowily o tym samym punkcie.
 */
export const uvTeksela = tgpu.fn([d.vec2u], d.vec2f)((xy) => {
  'use gpu';
  // ⚠️ `std.add` / `std.div` zamiast `+` i `/`: przeciazenie operatorow na wektorach wymaga
  // widelca kompilatora (`tsover`), ktorego ten projekt nie uzywa. Zapis jawny, wynik ten sam.
  return std.div(std.add(d.vec2f(d.f32(xy.x), d.f32(xy.y)), d.vec2f(0.5)), d.f32(MASKA_ROZMIAR));
});

/**
 * Schemat widoku, przez ktory czyta sie maske. Jedna instancja na projekt, zeby typ widoku dawal
 * sie nazwac — `TgpuTextureView` bez parametru jest unia i `std.textureLoad` go nie przyjmuje.
 */
export const SCHEMAT_WIDOKU_MASKI = d.texture2d(d.f32);

/** Widok maski do odczytu — staly przez cale zycie aplikacji. */
export type WidokMaski = TgpuTextureView<typeof SCHEMAT_WIDOKU_MASKI>;

/**
 * Srodek pola, POLICZONY Z `POLE` — nie wpisany po raz drugi. Stad bije gorace jadro.
 * ⚠️ `POLE_POLOWA` wypadlo razem z `sdfProstokat`: polowa bokow byla potrzebna wylacznie ramie
 * swiecacej powierzchni, a ramy juz nie ma.
 */
export const POLE_SRODEK: readonly [number, number] = [
  (POLE.x0 + POLE.x1) / 2,
  (POLE.y0 + POLE.y1) / 2,
];

/**
 * Uniform sceny. Jeden zapis na klatke, czytany wylacznie przez fragment.
 *
 * `proporcja` istnieje po to, zeby kwadratowa maska nie byla rozciagana na prostokatny kadr —
 * bez niej kolo pedzla jest elipsa. Uzasadnienie mapowania: `src/logika/mapowanie.ts`.
 */
export const Scena = d.struct({
  /** Sekundy od startu aplikacji — do delikatnego ruchu chmurki i pulsu poswiaty. */
  czas: d.f32,
  /** szerokosc / wysokosc kanwy. */
  proporcja: d.f32,
  /** 0 = dzien, 1 = noc, wartosci posrednie = zachod — maszyna faz przesuwa to plynnie. */
  faza: d.f32,
  /** Udzial pokrytego wroga 0..1 — z niego chmurka wie, czy jest chroniona. */
  pokrycie: d.f32,
  /** 0..1, sila podpowiedzi gestu dla gracza, ktory jeszcze nic nie namalowal. */
  podpowiedz: d.f32,
});

/**
 * ⚠️ LUSTRO `ekranNaMaske` z `src/logika/mapowanie.ts`. ZMIANA JEDNEJ WERSJI WYMAGA ZMIANY DRUGIEJ.
 * Tamta jest testowalna bez GPU i to ona jest zrodlem prawdy; ta liczy to samo we fragmencie.
 * Poza kwadratem maski wynik wychodzi poza 0..1 — fragment musi to sam odsiac, bo probnik
 * zacisnalby brzeg i rozmazal go po marginesach kadru.
 */
export const naPrzestrzenMaski = tgpu.fn([d.vec2f, d.f32], d.vec2f)((uv, proporcja) => {
  'use gpu';
  const skala = d.vec2f(
    std.max(proporcja, d.f32(1)),
    std.max(d.f32(1) / proporcja, d.f32(1)),
  );
  return std.add(std.mul(std.sub(uv, d.vec2f(0.5)), skala), d.vec2f(0.5));
});

/**
 * Przyblizenie ACES (dopasowanie Narkowicza) — tonowanie filmowe na samym koncu fragmentu.
 *
 * ⛔ NIE `x / (x + 1)`. Tamto splaszcza kazdy rozblysk do SZAREGO, a przepalony ekran telefonu ma
 * zostac cieply: krzywa ACES trzyma barwe w jadrze plamy i dopiero na samej gorze schodzi do bieli.
 */
export const aces = tgpu.fn([d.vec3f], d.vec3f)((kolor) => {
  'use gpu';
  const x = std.max(kolor, d.vec3f(0));
  const licznik = std.mul(x, std.add(std.mul(x, d.f32(2.51)), d.vec3f(0.03)));
  const mianownik = std.add(std.mul(x, std.add(std.mul(x, d.f32(2.43)), d.vec3f(0.59))), d.vec3f(0.14));
  return std.clamp(std.div(licznik, mianownik), d.vec3f(0), d.vec3f(1));
});
