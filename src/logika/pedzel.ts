/**
 * PEDZEL GRACZA: promien i profil odcisku. Wersja CPU, czyli zrodlo prawdy.
 *
 * ⛔ DLACZEGO TE STALE MIESZKAJA W `logika/`, A NIE W `gpu/scena.ts`. Do runda naprawczej po
 * recenzji zadania F `PROMIEN_PEDZLA` byl prywatna stala `scena.ts`, a test „czolo jest wyzsze od
 * srednicy pedzla" mial w asercji RECZNIE WPISANE `0.110`. Obie strony nierownosci wygladaly wiec
 * na zwiazane, a nie byly: podniesienie promienia w scenie nie ruszaloby testu ani o milimetr.
 * Recenzja nazwala to uwaga W1. `scena.ts` nie da sie zaimportowac w tescie node'owym (ciagnie za
 * soba `ui/karta.ts`, a ten obrazy `.webp`), wiec stala przeprowadza sie tam, gdzie mieszkaja
 * wszystkie inne lustra CPU: `odcinek.ts`, `wysychanie.ts`, `chmurka.ts`.
 *
 * Uklad wspolrzednych: przestrzen maski 0..1.
 */

/**
 * Promien pedzla w przestrzeni maski. Okolo 28 tekseli przy masce 512.
 *
 * ⚠️ ZMNIEJSZONY Z 0,075 W CZASACH, GDY OBSZAREM LICZONYM BYL SAM PAS CZOLA (wysoki na 0,126):
 * pedzel o promieniu 0,075 mial wtedy srednice wieksza niz caly obszar liczony, wiec jedno
 * przeciagniecie kladlo na postac prostokatna plyte i domykalo prog w jednym ruchu.
 *
 * ⚠️ OBSZAREM LICZONYM JEST DZIS CALA SYLWETKA (wysoka na 0,316), wiec tamten powod juz nie
 * obowiazuje — ale liczba zostaje, bo podnoszenie promienia dzialaloby przeciwko wybaczliwosci
 * z drugiej strony: szerszy pedzel to WIEKSZY udzial obszaru pod jednym ruchem, czyli blizej
 * do „jeden przejazd domyka runde". Zmierzone: przy 0,055 jeden przejazd daje 0,299 obszaru.
 *
 * ⚠️ TO, ZE JEDEN PRZEJAZD NIE DOMYKA RUNDY, JEST MIERZONE, A NIE WYWNIOSKOWANE Z TEJ LICZBY —
 * patrz test „jeden poziomy przejazd nie domyka progu pokrycia" (`test/chmurka.test.ts`), ktory
 * przebiega siatke czola i liczy najkorzystniejsze mozliwe ulozenie pociagniecia.
 */
export const PROMIEN_PEDZLA = 0.055;

/**
 * Udzial promienia, do ktorego odcisk jest PELNY (krycie 1). Poza nim gasnie gladko do zera
 * dokladnie na `PROMIEN_PEDZLA`.
 *
 * ⛔ LUSTRO. Ta sama liczba stoi w WGSL (`src/gpu/maska.ts`, potok `malowanie`) — i stoi tam
 * przez import z tego pliku, wiec nie ma jej dwoch.
 */
export const RDZEN_PEDZLA = 0.35;

/** Gladkie przejscie 0→1 miedzy `a` i `b`. Lustro `std.smoothstep`. */
function wygladzenie(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Krycie, jakie pedzel kladzie w punkcie odleglym o `odleglosc` od swojego sladu. 0..1.
 *
 * ⛔ LUSTRO potoku `malowanie` z `src/gpu/maska.ts`. ZMIANA JEDNEJ WERSJI WYMAGA ZMIANY DRUGIEJ.
 * Ta jest zrodlem prawdy o zachowaniu, bo daje sie zmierzyc bez WebGPU — i wlasnie dlatego
 * istnieje: bez niej test pokrycia jednym przejazdem musialby przepisac profil pedzla u siebie,
 * czyli zrobic z niego druga kopie, ktora rozjedzie sie po cichu.
 */
export function sladPedzla(odleglosc: number, promien = PROMIEN_PEDZLA): number {
  return 1 - wygladzenie(promien * RDZEN_PEDZLA, promien, odleglosc);
}

/**
 * Promien, w ktorym odcisk pedzla przekracza `progTeksela` — czyli ten, ktory NAPRAWDE liczy sie
 * do pokrycia. Zawsze mniejszy od `promien`, bo brzeg odcisku jest wygaszony.
 *
 * ⚠️ LICZONY, NIE WPISANY. Rozwiazuje `sladPedzla(r) = prog` polowieniem przedzialu, wiec
 * zmiana profilu (`RDZEN_PEDZLA`) albo progu teksela przesuwa te liczbe sama.
 */
export function promienSkuteczny(progTeksela: number, promien = PROMIEN_PEDZLA): number {
  let wSrodku = 0;
  let naZewnatrz = promien;
  for (let i = 0; i < 60; i++) {
    const srodek = (wSrodku + naZewnatrz) / 2;
    if (sladPedzla(srodek, promien) > progTeksela) wSrodku = srodek;
    else naZewnatrz = srodek;
  }
  return wSrodku;
}
