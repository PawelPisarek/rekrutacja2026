/**
 * PRZYRZAD `window.__pomiar()` — trzy liczby, po ktorych poznaje sie, ze kafel dziala.
 *
 * ⛔ ISTNIEJE PO TO, ZEBY DALO SIE ZMIERZYC ZACHOWANIE ZAMIAST OCENIAC JE NA OKO. Ten sam wzorzec,
 * co we wczesniejszym prototypie WebGPU: „plynne" i „pokrywa sie" to nie sa spostrzezenia, tylko
 * liczby, i albo strona umie je podac, albo kazda ocena wydajnosci jest zgadywaniem ze zrzutu.
 *
 * ⚠️ TO NIE JEST `window.__sonda`. Sonda STERUJE scena (maluje, przewija fazy, przypina palete)
 * i istnieje dla bramek; `__pomiar` niczego nie rusza — czyta trzy wartosci i wychodzi. Rozdzielone,
 * bo mieszanie odczytu ze sterowaniem konczy sie przyrzadem, ktory zmienia to, co mierzy.
 */

/**
 * Ile ostatnich klatek wchodzi do sredniej `msKlatki`.
 *
 * ⚠️ 60 KLATEK, CZYLI OKOLO SEKUNDY PRZY 60 Hz. Krotsze okno pokazuje pojedyncze zaciecia zamiast
 * tempa, dluzsze — rozmywa moment, w ktorym cos zaczelo mulic. Sekunda jest tez tym, co da sie
 * porownac z „60 klatek na sekunde" bez przeliczania.
 */
export const OKNO_KLATEK = 60;

/**
 * Odczyt przyrzadu — migawka z TEJ chwili, nie srednia z przebiegu (poza `msKlatki`, ktore z
 * definicji jest srednia z okna).
 *
 * ⛔ `msKlatki` SAMO W SOBIE NIE ODROZNIA ZYWEJ PETLI OD MARTWEJ, i wlasnie dlatego stoja obok
 * niego `klatek` i `odOstatniejMs`. `LicznikKlatek.srednia` liczy z tego, co JUZ w oknie lezy —
 * gdy petla staje, nikt nowej probki nie dopisuje, wiec srednia ZAMARZA na ostatniej wartosci
 * i pokazuje wzorowe 16,7 ms w chwili, w ktorej nic sie juz nie rysuje. Zmierzone 2026-08-27:
 * taka wlasnie obserwacja („msKlatki stale 16,7 ms") posluzyla za dowod zdrowia petli w raporcie
 * zadania E, choc nie odrozniala hipotez, ktore miala odroznic. Teraz jedno wywolanie wystarczy:
 * `klatek` rosnie tylko wtedy, gdy `requestAnimationFrame` naprawde tyka, a `odOstatniejMs` mowi,
 * jak dawno tyknal ostatni raz.
 */
export interface Pomiar {
  /** Udzial pokrytego czola chmurki, 0..1 — ta sama liczba, ktora widzi mechanika. */
  pokrycie: number;
  /** Nazwa biezacej fazy zabawy: `dzien-gra`, `dzien-karta`, `zachod`, `noc-gra`, `noc-karta`. */
  faza: string;
  /** Srednia dlugosc ostatnich `OKNO_KLATEK` klatek w milisekundach. */
  msKlatki: number;
  /**
   * Ile razy petla klatki obrocila sie od zaladowania strony. ⛔ LICZY OBROTY `rAF`, A NIE UDANE
   * KLATKI: rosnie takze wtedy, gdy tresc klatki rzucila wyjatek (patrz `bledow`). Dwa odczyty
   * w odstepie czasu odpowiadaja na pytanie „czy petla zyje" bez zadnej interpretacji.
   */
  klatek: number;
  /**
   * Ile milisekund uplynelo od POCZATKU ostatniej klatki. Przy zywej petli o 60 Hz siedzi
   * ponizej ~17 ms; przy dlawieniu przez przegladarke (karta w tle) rosnie do setek milisekund;
   * przy martwej petli rosnie bez konca. To jest ten znacznik, ktory odroznia „dlawi" od „nie zyje".
   */
  odOstatniejMs: number;
  /**
   * Ile klatek zakonczylo sie wyjatkiem. ⛔ NIE JEST TO LICZNIK OZDOBNY: do 2026-08-27 wywolanie
   * `requestAnimationFrame(klatka)` stalo w ogonie tresci klatki BEZ `try/catch`, wiec jeden
   * synchroniczny wyjatek zabijal animacje na zawsze — a objaw byl nie do odroznienia od
   * dlawienia przez przegladarke. Dzis petla przezywa wyjatek, ale ma o nim powiedziec.
   */
  bledow: number;
}

/**
 * Bufor cykliczny na czasy klatek.
 *
 * ⛔ SREDNIA LICZY SIE Z TEGO, CO W BUFORZE JEST, A NIE Z JEGO POJEMNOSCI. Dzielenie przez stale
 * `OKNO_KLATEK` przez pierwsza sekunde zycia strony dawaloby wynik zanizony proporcjonalnie do
 * tego, ile klatek jeszcze nie bylo — czyli liczbe wygladajaca na doskonala wydajnosc dokladnie
 * wtedy, gdy nie wiadomo o niej jeszcze nic. Dopoki bufor nie jest pelny, dzielimy przez liczbe
 * zapisanych probek.
 */
export class LicznikKlatek {
  readonly #okno = new Float64Array(OKNO_KLATEK);
  #zapisanych = 0;
  #nastepny = 0;

  /** Zapisuje dlugosc jednej klatki w milisekundach, wypierajac najstarsza z okna. */
  zapisz(ms: number): void {
    this.#okno[this.#nastepny] = ms;
    this.#nastepny = (this.#nastepny + 1) % OKNO_KLATEK;
    if (this.#zapisanych < OKNO_KLATEK) this.#zapisanych++;
  }

  /** Ile probek faktycznie stoi w oknie. Nigdy wiecej niz `OKNO_KLATEK`. */
  get zapisanych(): number {
    return this.#zapisanych;
  }

  /** Srednia z ostatnich (najwyzej `OKNO_KLATEK`) klatek. Pusty licznik daje 0 — nie NaN. */
  get srednia(): number {
    if (this.#zapisanych === 0) return 0;
    let suma = 0;
    for (let i = 0; i < this.#zapisanych; i++) suma += this.#okno[i]!;
    return suma / this.#zapisanych;
  }
}
