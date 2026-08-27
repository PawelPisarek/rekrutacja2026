/**
 * ⛔ PRZESTRZEN MASKI JEST KWADRATEM, EKRAN NIE JEST.
 *
 * Zadanie B rozciagalo maske 0..1 na caly kadr bez korekty, wiec kolo pedzla wychodzilo ELIPSA
 * — na szerokim oknie smuga byla widocznie splaszczona. Naprawa siedzi TUTAJ, w mapowaniu
 * ekran↔maska, a NIE w odciskaniu pedzla:
 *
 * - pedzel odciska sie dalej po kole w przestrzeni maski, wiec `Pokrycie` liczy dokladnie to samo
 *   co przed zmiana i obie bramki zadania B (srodek, rog) daja te same liczby niezaleznie od
 *   rozmiaru okna;
 * - gdyby korygowac przy ODCISKANIU, ksztalt zapisany w masce zalezalby od proporcji okna, wiec
 *   pokrycie — a przez nie progi faz zadania D — zmienialoby sie po rozciagnieciu przegladarki.
 *
 * Mapowanie jest typu „contain": kwadrat maski miesci sie w calosci w kadrze i jest wysrodkowany,
 * a poza nim zostaje samo tlo sceny. Skala jest ta sama na obu osiach (1/min(szer, wys) na piksel),
 * wiec kolo zostaje kolem.
 */

/** Mnozniki osi X i Y przy przejsciu z przestrzeni ekranu do przestrzeni maski. */
export function skalaMapowania(proporcja: number): [number, number] {
  if (!(proporcja > 0) || !Number.isFinite(proporcja)) {
    throw new Error(`proporcja musi byc dodatnia i skonczona: ${proporcja}`);
  }
  return [Math.max(proporcja, 1), Math.max(1 / proporcja, 1)];
}

/** Punkt ekranu (0..1, y w dol) na punkt przestrzeni maski. Poza kwadratem maski wynik wychodzi
 *  poza 0..1 — to poprawne, tam po prostu nie ma na czym malowac. */
export function ekranNaMaske(x: number, y: number, proporcja: number): [number, number] {
  const [sx, sy] = skalaMapowania(proporcja);
  return [(x - 0.5) * sx + 0.5, (y - 0.5) * sy + 0.5];
}

/** Odwrotnosc `ekranNaMaske`: punkt maski na punkt ekranu (0..1, y w dol). */
export function maskaNaEkran(x: number, y: number, proporcja: number): [number, number] {
  const [sx, sy] = skalaMapowania(proporcja);
  return [(x - 0.5) / sx + 0.5, (y - 0.5) / sy + 0.5];
}
