/** Maszyna faz zabawy: dzien (gra -> karta) -> zachod -> noc (gra -> karta).
 *  `noc-karta` jest stanem koncowym — zabawa nie wraca do dnia. */
export type Faza = 'dzien-gra' | 'dzien-karta' | 'zachod' | 'noc-gra' | 'noc-karta';

export interface StanFaz {
  faza: Faza;
  /** Ile sekund pod rzad pokrycie utrzymuje sie na poziomie progu lub wyzej (tylko fazy -gra). */
  wPelniOd: number;
  /** Ile sekund uplynelo od wejscia w biezaca faze. */
  wFazieOd: number;
}

/**
 * Ile SYLWETKI POSTACI musi byc zakryte kremem, zeby uznac runde za wygrana.
 *
 * ⛔ DOBRANY DO GESTU, KTORY CZLOWIEK WYKONUJE BEZ INSTRUKCJI — NIE DO IDEALNEGO PRZEJAZDU.
 *
 * Uzytkownik zglosil z prawdziwego urzadzenia: „nadal maze po ekranie przez pare sekund i nie
 * zmienia sie na noc". Przyczyna nie byla w tej stalej, tylko w MIANOWNIKU: liczyl sie waski pas
 * czola, wiec punkty dostawal wylacznie ten, kto o tym pasie WIEDZIAL. Obszarem liczonym jest dzis
 * cala sylwetka (`obszarWroga` / `czyChmurka`), a prog zostal zmierzony od nowa tym samym
 * przyrzadem przed zmiana i po niej.
 *
 * Zmierzone 2026-08-28, `scripts/mierz-gesty.mjs` na zywej scenie (szczyt pokrycia; w nawiasie
 * najdluzsze nieprzerwane okno nad 0,55):
 *
 *   gest                                  mianownik = czolo    mianownik = SYLWETKA
 *   poziomo przez srodek kafla                  0,000                0,000  (—)
 *   krzyz przez caly kafel                      0,126                0,120  (—)
 *   bazgranie po kaflu, szesc pociagniec        0,711                0,711  (2,58 s)
 *   celnie w pas czola, dwa przejazdy           1,000                0,414  (—)
 *   bazgranie po samej maskotce, piec pociagniec 1,000               0,984  (4,28 s)
 *
 * ⛔ DLACZEGO 0,55, A NIE MNIEJ I NIE WIECEJ. Prog musi lezec MIEDZY dwiema zmierzonymi liczbami:
 *
 *  - NAD sufitem jednego przejazdu. Najkorzystniejsze mozliwe pojedyncze pociagniecie zakrywa
 *    0,299 sylwetki (policzone po siatce maski, test „jeden poziomy przejazd..." w
 *    `chmurka.test.ts`). 0,55 to 1,84 raza wiecej, wiec „jeden ruch nie domyka rundy" zostaje
 *    wlasnoscia GEOMETRII, a nie ciasno dobranej stalej.
 *  - POD tym, co daje bazgranie po kaflu. Szczyt 0,711 i 2,58 s nad progiem, czyli PIEC RAZY
 *    dluzej niz `CZAS_POTWIERDZENIA` — runda domyka sie takze wtedy, gdy gracz jest duzo
 *    niechlujniejszy od przyrzadu.
 *
 * Dwa dobrze polozone przejazdy przez postac daja 0,576 (policzone), wiec prog domykaja DWA
 * przejazdy — tyle, ile trzeba, zeby „trzeba rozsmarowac" zostalo prawda, i ani jednego wiecej.
 *
 * ⚠️ CZEGO 0,55 NIE NAPRAWIA: pojedyncze poziome pociagniecie przez SAM SRODEK KAFLA dalej daje
 * 0,000, bo srodek kafla lezy NAD postacia (sylwetka: y 0,552..0,868). Zadna wartosc progu tego
 * nie ruszy — to jest polozenie postaci, pilnowane osobnym testem. Od pokazania, gdzie smarowac,
 * jest podpowiedz gestu (`ui/podpowiedz.ts`).
 */
export const PROG_POKRYCIA = 0.55;
/**
 * Ile sekund prog pokrycia musi sie utrzymac bez przerwy, zeby faza sie przelaczyla.
 *
 * ⚠️ POLOWA POPRZEDNIEJ WARTOSCI (1 s), bo to jest CZYSTE CZEKANIE: gracz juz zrobil swoje,
 * a kafel jeszcze nie odpowiedzial. Zapas na drganie licznika zostaje ogromny — najkrotsze
 * zmierzone okno nad progiem (bazgranie po kaflu) to 2,58 s, czyli PIEC razy tyle.
 */
export const CZAS_POTWIERDZENIA = 0.5;
/** Jak dlugo karta produktowa stoi sama z siebie, zanim zabawa pojedzie dalej. */
export const CZAS_KARTY = 2.5;
/** Dlugosc animacji zachodu miedzy dniem a noca. */
export const CZAS_ZACHODU = 1.2;

export const STAN_POCZATKOWY: StanFaz = { faza: 'dzien-gra', wPelniOd: 0, wFazieOd: 0 };

/** Kolejnosc faz — uzywana wylacznie do ustalenia, co jest "nastepna faza" po kazdej z gier. */
const NASTEPNA_PO_GRZE: Record<'dzien-gra' | 'noc-gra', Faza> = {
  'dzien-gra': 'dzien-karta',
  'noc-gra': 'noc-karta',
};

/**
 * ⛔ HISTEREZA JEST CELOWA. Krem wysycha caly czas, wiec tuz po pokazaniu karty pokrycie ZAWSZE
 * spada ponizej progu. Fazy karty/zachodu w ogole nie patrza na `pokrycie` — przechodza dalej
 * wylacznie po uplywie wlasnego czasu, wiec raz pokazana karta nie miga w te i z powrotem.
 */
export function nastepnyStan(stan: StanFaz, pokrycie: number, dt: number): StanFaz {
  const wFazieOd = stan.wFazieOd + dt;

  switch (stan.faza) {
    case 'dzien-gra':
    case 'noc-gra': {
      // ponizej progu licznik potwierdzenia zeruje sie natychmiast — to jest cala histereza
      // po stronie fazy -gra: bez tego pokrycie migajace wokol progu przelaczaloby fazy tam i z powrotem.
      const wPelniOd = pokrycie >= PROG_POKRYCIA ? stan.wPelniOd + dt : 0;
      if (wPelniOd >= CZAS_POTWIERDZENIA) {
        return { faza: NASTEPNA_PO_GRZE[stan.faza], wPelniOd: 0, wFazieOd: 0 };
      }
      return { faza: stan.faza, wPelniOd, wFazieOd };
    }

    case 'dzien-karta': {
      if (wFazieOd >= CZAS_KARTY) {
        return { faza: 'zachod', wPelniOd: 0, wFazieOd: 0 };
      }
      return { faza: stan.faza, wPelniOd: 0, wFazieOd };
    }

    case 'zachod': {
      if (wFazieOd >= CZAS_ZACHODU) {
        return { faza: 'noc-gra', wPelniOd: 0, wFazieOd: 0 };
      }
      return { faza: stan.faza, wPelniOd: 0, wFazieOd };
    }

    case 'noc-karta':
      // stan koncowy — nic dalej nie nastepuje
      return { faza: stan.faza, wPelniOd: 0, wFazieOd };
  }
}
