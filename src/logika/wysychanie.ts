export interface StaleWysychania {
  /** Ile grubosci ubywa na sekunde niezaleznie od polozenia. */
  baza: number;
  /** Ile dodatkowego ubytku na sekunde dokłada szum (0..1) w danym tekselu. */
  amplituda: number;
  /** Ponizej tej grubosci warstwa znika calkiem. */
  prog: number;
}

/**
 * ⛔ KREM MA PEKAC, NIE PLOWIEC. Rownomierne odejmowanie daje warstwe, ktora gasnie jak sciemniany
 * swiatlo — czyta sie to jak blad renderowania, nie jak zasychanie. Dwie rzeczy razem dają
 * pekanie: (1) ubytek zalezy od SZUMU przypisanego tekselowi, wiec jedne miejsca znikaja wczesniej,
 * (2) ponizej progu warstwa jest scinana OSTRO do zera, wiec powstaja twarde krawedzie platkow
 * zamiast miekkiej mgielki.
 */
export function krokWysychania(
  grubosc: number,
  dt: number,
  szum: number,
  stale: StaleWysychania,
): number {
  const po = grubosc - dt * (stale.baza + szum * stale.amplituda);
  if (po < stale.prog) return 0;
  return po;
}

/**
 * Tempo schniecia. Warstwa ma schodzic szybciej, niz gracz zdazy zakryc caly ekran — to jest
 * zrodlo napiecia w zabawie — ale nie tak szybko, zeby domalowywac trzeba bylo bez przerwy.
 *
 * ⚠️ `baza` I `amplituda` ZOSTALY 2026-08-27 PRZEPOLOWIONE (0,14 → 0,07 i 0,22 → 0,11) na
 * zgloszenie „za dlugo trzeba smarowac, bo krem za szybko schnie". Obie naraz, wiec ROZSTEP
 * temp miedzy platkami (a z nim ksztalt pekania) jest ten sam, tylko rozciagniety w czasie
 * dwukrotnie. `prog` NIE jest tempem, tylko granica, ponizej ktorej warstwa znika — zostaje.
 *
 * Zmierzone przyrzadem `scripts/mierz-schniecie.mjs` na zywej scenie, jedno nalozenie kremu
 * i zero domalowywania (czas do wyzerowania pokrycia czola):
 *
 *   stale 0,14 / 0,22  →  polowa pokrycia po 2,0 s, zero po 4,7 s
 *   stale 0,07 / 0,11  →  polowa pokrycia po 4,2 s, zero po 8,9 s
 *
 * ⛔ OKNO BRAMKI „pokrycie SPADA" JEDZIE ZA TA LICZBA. Asercja 2 z `docs/plan-wdrozenia.md`
 * (zadanie B, krok 6) czekala 6 s, bo warstwa schodzila w 4,7 s. Przy nowych stalych warstwa
 * schodzi w 8,9 s, wiec okno zostalo PRZELICZONE do 12 s — a nie prog bramki obnizony.
 */
export const STALE_WYSYCHANIA: StaleWysychania = {
  baza: 0.07,
  amplituda: 0.11,
  prog: 0.06,
};
