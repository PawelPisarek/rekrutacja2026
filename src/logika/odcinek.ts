/**
 * Odleglosc punktu od ODCINKA (nie od prostej).
 *
 * ⛔ To rozroznienie jest calym sensem tej funkcji. Pedzel odciskany jako pojedynczy okrag na
 * kazde zdarzenie wskaznika zostawia przy szybkim ruchu KROPKI zamiast smugi — bo miedzy dwoma
 * zdarzeniami mysz przeskakuje kilkadziesiat pikseli. Odciskanie wzdluz odcinka miedzy poprzednia
 * a biezaca pozycja rozwiazuje to bez zwiekszania czestotliwosci probkowania.
 *
 * ⛔ LUSTRO. Ta sama matematyka istnieje w WGSL (`src/gpu/maska.ts`, funkcja `odlegloscOdOdcinka`).
 * ZMIANA JEDNEJ WERSJI WYMAGA ZMIANY DRUGIEJ. Ta jest zrodlem prawdy o zachowaniu, bo daje sie
 * przetestowac bez GPU; tamta liczy to samo na tekselach maski.
 */
export function odlegloscOdOdcinka(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const dlugoscKw = abx * abx + aby * aby;
  // Odcinek zdegenerowany do punktu: `t` bylby dzieleniem przez zero.
  const t = dlugoscKw === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / dlugoscKw));
  const dx = px - (ax + abx * t), dy = py - (ay + aby * t);
  return Math.hypot(dx, dy);
}
