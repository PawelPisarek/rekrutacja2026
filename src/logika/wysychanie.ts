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

/** Wartosci startowe do strojenia na zywo. Dobrane tak, zeby pelna warstwa zeschla w ~4 s,
 *  czyli szybciej, niz gracz zdazy zakryc caly ekran — to jest zrodlo napiecia w zabawie. */
export const STALE_WYSYCHANIA: StaleWysychania = {
  baza: 0.14,
  amplituda: 0.22,
  prog: 0.06,
};
