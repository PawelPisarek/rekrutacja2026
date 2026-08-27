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
 * Ile CZOLA POSTACI musi byc zakryte kremem, zeby uznac runde za wygrana.
 *
 * ⚠️ MIANOWNIK ZMIENIAL SIE JUZ DWA RAZY I ZA KAZDYM PROG BYL PRZELICZANY POMIAREM, a nie
 * przepisywany. Do zadania C2 liczyl sie prostokat 0,08..0,92 na obu osiach (70,6% maski), potem
 * czolo chmurki (2,38%), a od zamiany sylwetki na kapsule — czolo kapsuly: 8,55% maski (policzone,
 * `logika/chmurka.ts`, pilnuje `chmurka.test.ts`). Mianownik urosl ponad trzykrotnie, wiec liczba
 * 0,85 znaczy dzis co innego niz wczoraj i musiala zostac zmierzona od nowa.
 *
 * Zmierzone 2026-08-27 sonda CDP na zywej scenie, pedzel o promieniu 0,055, wysychanie na stalych
 * produkcyjnych, probkowanie co 60 ms przez 2,2 s (`msKlatki` = 16,7, wiec petla klatki nie
 * przymarzla i pomiar dotyczy prawdziwego uplywu czasu):
 *
 *   jedno przeciagniecie w poprzek czola  →  szczyt 0,574, prog NIEOSIAGNIETY ani razu
 *   dwa przeciagniecia w dwoch rzedach    →  szczyt 1,000, nad progiem od 0,06 s do ponad 2,1 s
 *   trzy przeciagniecia                   →  szczyt 1,000, bez roznicy wobec dwoch
 *
 * ⚠️ POWTORZONE 2026-08-27 PO PRZEPOLOWIENIU TEMPA WYSYCHANIA (`STALE_WYSYCHANIA`: 0,14 / 0,22
 * → 0,07 / 0,11), bo wolniejsze schniecie trzyma pokrycie nad progiem dluzej i mogloby zrobic prog
 * DARMOWYM. Nie zrobilo — jedno przeciagniecie dalej nie dochodzi do progu na ZADNEJ wysokosci:
 *
 *   jedno przeciagniecie, y = 0,585 / 0,600 / 0,615 / 0,645  →  szczyt 0,589 / 0,671 / 0,703 / 0,637,
 *                                                               prog NIEOSIAGNIETY ani razu
 *   dwa przeciagniecia w dwoch rzedach                       →  szczyt 1,000, nad progiem
 *                                                               od 0,06 s do 3,79 s
 *
 * ⛔ PROG JEST OSIAGALNY, ALE NIE DARMOWY, i o to chodzilo. `CZAS_POTWIERDZENIA` wynosi 1 s,
 * wiec DOMYKAJA GO DOKLADNIE DWA przejazdy: jeden nie dochodzi nawet do progu (najwyzej 0,703),
 * dwa trzymaja sie nad nim dluzej, niz trwa potwierdzenie. Trzeci nic nie dodaje. Wysychanie
 * zabiera calosc po okolo 8,9 s (bylo 4,7 s), wiec runda dalej jest wyscigiem — tylko wolniejszym.
 *
 * ⚠️ To, ze jeden przejazd NIE domyka fazy, jest wlasnoscia GEOMETRII, a nie tej stalej — i jest
 * ZMIERZONE TA SAMA WIELKOSCIA, o ktorej mowi to zdanie. Test „jeden poziomy przejazd nie domyka
 * progu pokrycia" (`chmurka.test.ts`) przebiega WSZYSTKIE wysokosci ulozenia pociagniecia i liczy
 * najwiekszy mozliwy udzial czola pod jednym ruchem: 0,744 przy progu 0,85.
 *
 * ⛔ POPRZEDNIA WERSJA TEGO ZDANIA POWOLYWALA SIE NA SLABSZY TEST — „pasmo czola wyzsze od
 * srednicy pedzla". Ta nierownosc wyklucza wylacznie pokrycie 100%, a prog to 0,85, wiec
 * przepuscilaby geometrie domykana jednym ruchem (recenzja zadania F, uwaga W2). Zmierzone przy
 * okazji naprawy: gdyby promien pedzla urosl z 0,055 do 0,070, jeden przejazd dawalby 0,914 —
 * nowy test to lapie, stary przechodzilby dalej.
 *
 * Obnizenie progu obeszloby ten warunek — dlatego prog zostaje tam, gdzie byl, i to ksztalt jest
 * do niego dopasowany.
 */
export const PROG_POKRYCIA = 0.85;
/** Ile sekund prog pokrycia musi sie utrzymac bez przerwy, zeby faza sie przelaczyla. */
export const CZAS_POTWIERDZENIA = 1;
/** Jak dlugo karta produktowa stoi sama z siebie, zanim zabawa pojedzie dalej. */
export const CZAS_KARTY = 3;
/** Dlugosc animacji zachodu miedzy dniem a noca. */
export const CZAS_ZACHODU = 1.5;

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
