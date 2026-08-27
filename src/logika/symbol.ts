/**
 * SYMBOL NIEBA — slonce w dzien, sierp w nocy, przenikanie w zachodzie.
 *
 * ⛔ TO JEST ZNAK PORY DNIA, A NIE DRUGIE ZRODLO SWIATLA. Kafel ma juz swoje swiecenie (cala
 * powierzchnia, `obraz.ts`); symbol tylko NAZYWA, ktora pora trwa. Dlatego mieszka w gornym pasie
 * kadru, jest maly i nie ma wlasnego wplywu na zadna mechanike.
 *
 * ⛔ ZERO BITMAP. Ksztalt jest proceduralny (SDF w `obraz.ts`), bo regula „dokladnie dwie bitmapy
 * w calym projekcie" jest twarda i pilnuje jej `scripts/bramka-bitmapy.mjs`.
 *
 * ⚠️ TEN PLIK TRZYMA WYLACZNIE UMIEJSCOWIENIE I ZASIEG, bo tylko one musza dac sie zmierzyc bez
 * GPU. Symbol ma spelnic DWA warunki, ktorych nie wolno sprawdzic okiem na zrzucie:
 *
 *  1. LEZY POZA OBSZAREM LICZONYM — inaczej mieszalby w liczniku pokrycia;
 *  2. NIE KOLIDUJE Z PODPOWIEDZIA GESTU — a ta rysuje sie wylacznie na sylwetce postaci
 *     (`naCzole = maskaChmurki * ...` w `obraz.ts`), wiec wystarczy, zeby symbol nie dotykal
 *     sylwetki wcale. To warunek MOCNIEJSZY od potrzebnego i za to latwy do zmierzenia.
 *
 * Oba sprawdza `test/symbol.test.ts` na siatce, przez `ramka`/`udzial` z `logika/chmurka.ts` —
 * czyli tym samym przyrzadem, ktorym mierzy sie mianownik pokrycia.
 */

/**
 * Srodek symbolu w przestrzeni maski (0..1, os Y w DOL).
 *
 * ⚠️ WYSOKOSC JEST WNIOSKIEM Z GRANICY BRAMKI BLASKU, nie z upodobania. `WYCINEK_SZKLA`
 * (`gpu/wspolne.ts`) zaczyna sie na `y = 0,16` i bramka „krem przygasza blask" usrednia dokladnie
 * ten prostokat. Jasny symbol w jego wnetrzu podnosilby mierzona wartosc niezaleznie od kremu,
 * czyli mieszalby sie do jedynej rzeczy, ktorej ta bramka dowodzi. Stad `y + ZASIEG_SYMBOLU`
 * musi zostac NAD 0,16 — pilnuje tego test.
 */
export const SRODEK_SYMBOLU = { x: 0.775, y: 0.086 } as const;

/** Promien tarczy: pelne kolo slonca, a w nocy kolo, z ktorego wycina sie sierp. */
export const PROMIEN_TARCZY = 0.034;

/**
 * ⛔ TWARDA GRANICA ZASIEGU — I TO ONA JEST PRZEDMIOTEM POMIARU, A NIE SAM KSZTALT.
 *
 * Shader mnozy caly symbol przez zanik konczacy sie DOKLADNIE na tej odleglosci, wiec poza kolem
 * o tym promieniu symbol nie rysuje NICZEGO — niezaleznie od tego, ile promieni ma slonce i jak
 * gleboko wciety jest sierp. Dzieki temu test moze orzekac o kole zamiast o SDF-ie i nie ma tu
 * lustra CPU/GPU, ktore mogloby sie po cichu rozjechac: sprawdzana wlasnosc wynika z BUDOWY
 * shadera, a nie z drugiej kopii ksztaltu.
 */
export const ZASIEG_SYMBOLU = 0.058;

/** Ile ramion ma slonce. Parzysta, bo ramiona powstaja z `|cos(kat * PROMIENI / 2)|`. */
export const PROMIENI = 8;

/**
 * Przesuniecie kola, ktore wycina sierp z tarczy — w prawo i lekko do gory, wiec ksiezyc jest
 * odwrocony rogami w lewy dol. Ulamek `PROMIEN_TARCZY`, zeby sierp skalowal sie razem z tarcza.
 */
export const WCIECIE_SIERPA = { x: 0.72, y: -0.30 } as const;
/** Promien kola wycinajacego, tez jako ulamek tarczy. Ponizej 1 sierp jest gruby, powyzej — cienki. */
export const PROMIEN_WCIECIA = 0.95;

/**
 * Czy punkt maski lezy w kole, poza ktore symbol NA PEWNO nie wychodzi.
 * ⚠️ To jest granica GORNA, nie obrys: wewnatrz kola symbol bywa pusty. Do rozstrzygniecia
 * „czy koliduje z czymkolwiek" to wystarcza i jest odporne na kazda przyszla zmiane ksztaltu.
 */
export function czyWZasieguSymbolu(x: number, y: number): boolean {
  return Math.hypot(x - SRODEK_SYMBOLU.x, y - SRODEK_SYMBOLU.y) <= ZASIEG_SYMBOLU;
}
