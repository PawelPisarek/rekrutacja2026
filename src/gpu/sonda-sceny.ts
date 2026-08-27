import type { Maska, ProbkaMaski } from './maska.ts';
import type { Pokrycie } from './pokrycie.ts';
import type { Wskaznik } from './wskaznik.ts';
import type { Barwa, PrzyrzadKadru } from './przyrzad.ts';
import type { Przebieg } from '../logika/przebieg.ts';

/**
 * SONDA DIAGNOSTYCZNA `window.__sonda` — jedyne wejscie bramek CDP do wnetrza sceny.
 *
 * Wydzielona ze `scena.ts` w zadaniu D. Tamten plik sklada kafel (potoki, rozmiar kanwy, petla
 * klatki) i ma taki zostac; sonda rosnie razem z kazda kolejna bramka — o `blask`, o `faza`,
 * o `przewin` — i jest wlasna odpowiedzialnoscia, a nie czescia skladania kafla.
 */

/**
 * Wartosci uniformu przypiete przez sonde na czas pomiaru. `null` w kazdym polu = ta wartosc
 * plynie z zycia sceny, dokladnie jak u gracza.
 */
export interface Przypiecie {
  faza: number | null;
  /**
   * ⛔ CZAS SCENY W SEKUNDACH — GALKA POMIAROWA, NIE TRYB DEMONSTRACYJNY.
   *
   * Podpowiedz gestu jest deterministyczna funkcja czasu (`sin(czas * TEMPO)`), wiec probka
   * pobrana w losowej fazie daje losowa odpowiedz: raz palec stoi tam, gdzie mierzymy, raz po
   * drugiej stronie czola. Zmierzone 2026-08-27: pierwszy pomiar podpowiedzi mial n = 3 pary
   * z NIEKONTROLOWANA faza i jedna para wypadla w szumie — z czego nie wynikalo nic ani o duchu,
   * ani o mierze. Przypiecie czasu zamienia „trzy losowania" w dwa punkty toru wybrane z wzoru.
   *
   * ⚠️ Zatrzymuje TYLKO animacje liczone z pola `czas` uniformu (pozycja podpowiedzi, puls pola,
   * drganie powietrza). Wysychanie kremu i licznik pokrycia jada z `dt` petli i nic o tym nie wiedza.
   */
  czas: number | null;
}

/**
 * Wartosc, ktora ma pojsc do uniformu: przypieta przez sonde albo ta z zycia sceny.
 *
 * Jedna linijka, ale nazwana i przetestowana — bo to ona rozstrzyga, ktore z dwoch zrodel wygrywa,
 * a bramka pomiarowa opiera sie na tym, ze przypiecie NAPRAWDE nadpisuje zycie sceny (inaczej
 * mierzylaby czas biegnacy, myslac, ze stoi) i ze `null` NAPRAWDE oddaje sterowanie z powrotem
 * (inaczej jedna bramka zamrazalaby scene nastepnej).
 */
export function zPrzypieciem(przypieta: number | null, zZyciaSceny: number): number {
  return przypieta ?? zZyciaSceny;
}

export interface SondaSceny {
  pokrycie: () => number;
  pociagnij: (x0: number, y0: number, x1: number, y1: number, krokow?: number) => void;
  /** Przytrzymanie wskaznika w jednym punkcie przez `ms` — BEZ ruchu. */
  dotknij: (x: number, y: number, ms?: number) => Promise<void>;
  /** Grubosc i wiek warstwy w zadanym punkcie. */
  probka: (x: number, y: number) => Promise<ProbkaMaski>;
  /** Grubosc i wiek wzdluz odcinka — do oceny, czy warstwa peka, czy plowieje. */
  profil: (x0: number, y0: number, x1: number, y1: number) => Promise<ProbkaMaski[]>;
  /**
   * Srednia luminancja SAMEGO SWIECACEGO POLA (`WYCINEK_SZKLA`), 0..1 — bez zaokraglonych rogow
   * i bez chmurki. Spada, gdy na polu lezy krem. Podanie wycinka jawnie nadpisuje domyslny.
   */
  jasnosc: (x0?: number, y0?: number, x1?: number, y1?: number) => number;
  /** Srednia barwa wycinka podanego w przestrzeni MASKI; domyslnie cale pole do zabawy.
   *  ⛔ RZUCA, gdy wycinek lezy poza polem albo gdy siatka nie zostala jeszcze odczytana. */
  barwa: (x0?: number, y0?: number, x1?: number, y1?: number) => Barwa;
  /**
   * ⛔ MIARA BRAMKI „krem przygasza blask": maksimum ze srednich skladowych wycinka, domyslnie
   * SAMO SWIECACE POLE. Pole swieci barwa nasycona, a luminancja jest miara szarosciowa — bialy
   * krem potrafi PODNIESC luminancje, gaszac przy tym emisje. Maksimum skladowych idzie za
   * emisja niezaleznie od odcienia, wiec to ono odpowiada na pytanie „czy blask zgasl".
   */
  blask: (x0?: number, y0?: number, x1?: number, y1?: number) => number;
  czysc: () => void;
  /** Biezaca faza zabawy jako napis — `dzien-gra`, `dzien-karta`, `zachod`, `noc-gra`, `noc-karta`. */
  faza: () => string;
  /** Wartosc pola `faza` uniformu, 0..1. Podczas zachodu lezy miedzy dniem a noca. */
  fazaLiczbowa: () => number;
  /**
   * Dopycha maszyne faz o `sekundy` BEZ CZEKANIA NA ZEGAR. Bramka kolejnosci faz musialaby bez
   * tego przeczekac sumę wszystkich progow czasowych, czyli kilkanascie sekund na przebieg.
   * ⚠️ Przewija SAM PRZEBIEG, nie wysychanie — krem schnie dalej w rytmie prawdziwego zegara.
   */
  przewin: (sekundy: number) => void;
  /**
   * ⛔ HAK WYLACZNIE POMIAROWY: przypina pole `faza` uniformu na sztywno (0 = dzien, 1 = noc)
   * i ZATRZYMUJE przebieg zabawy, zeby maszyna faz nie odbierala go w nastepnej klatce. Tak mierzy
   * bramka blasku: potrzebuje nocnej palety bez przechodzenia calej trasy. `null` oddaje sterowanie
   * z powrotem zabawie.
   */
  ustawFaze: (wartosc: number | null) => void;
  /**
   * Wartosc pola `podpowiedz` uniformu, ktora poszla na GPU w OSTATNIEJ klatce — 0 albo 1.
   *
   * ⛔ CZYTA TO, CO ZAPISANO, A NIE TO, CO WYLICZYL LICZNIK BEZRUCHU. Sam `Podpowiedz.sila`
   * nie wie o bramkowaniu faza zabawy (`gra ? ... : 0`), wiec bramka pytajaca jego zobaczylaby
   * jedynke tam, gdzie shader dostal zero. Zmierzone 2026-08-27: bez tego haka nie dalo sie
   * odroznic „uniform nie doszedl" od „doszedl, ale ksztaltu nie widac" — a to sa dwie zupelnie
   * rozne usterki i szuka sie ich w dwoch roznych plikach.
   */
  podpowiedz: () => number;
  /**
   * ⛔ PRZYPINA POLE `czas` UNIFORMU (w sekundach) — patrz `Przypiecie.czas`. `null` oddaje
   * sterowanie zegarowi. Tak mierzy bramka podpowiedzi: dwa punkty toru zamiast dwoch losowan.
   */
  ustawCzas: (wartosc: number | null) => void;
  /** Wartosc pola `czas`, ktora poszla na GPU w OSTATNIEJ klatce — czyta sie ja, zeby wiedziec,
   *  czy przypiecie w ogole doszlo, zanim uwierzy sie pomiarowi zrobionemu przy tej fazie. */
  czas: () => number;
}

export interface ZaleznosciSondy {
  maska: Maska;
  pokrycie: Pokrycie;
  wskaznik: Wskaznik;
  przyrzad: PrzyrzadKadru;
  przebieg: Przebieg;
  przypiecie: Przypiecie;
  /** Czyszczenie sceny — maska plus kolejka wskaznika. Wspolne z przyciskiem „zagraj jeszcze raz". */
  wyczyscScene: () => void;
  /** Odczyt pola `podpowiedz` z ostatniego zapisu uniformu — patrz `SondaSceny.podpowiedz`. */
  podpowiedz: () => number;
  /** Odczyt pola `czas` z ostatniego zapisu uniformu — patrz `SondaSceny.czas`. */
  czas: () => number;
}

export function zbudujSonde(z: ZaleznosciSondy): SondaSceny {
  return {
    pokrycie: () => z.pokrycie.ostatnie,
    pociagnij: (x0, y0, x1, y1, krokow) => z.wskaznik.pociagnij(x0, y0, x1, y1, krokow),
    dotknij: (x, y, ms) => z.wskaznik.dotknij(x, y, ms),
    probka: (x, y) => z.maska.probka(x, y),
    profil: (x0, y0, x1, y1) => z.maska.probkuj(x0, y0, x1, y1),
    jasnosc: (x0, y0, x1, y1) => z.przyrzad.jasnosc(x0, y0, x1, y1),
    barwa: (x0, y0, x1, y1) => z.przyrzad.barwa(x0, y0, x1, y1),
    blask: (x0, y0, x1, y1) => z.przyrzad.blask(x0, y0, x1, y1),
    czysc: () => z.wyczyscScene(),
    faza: () => z.przebieg.faza,
    fazaLiczbowa: () => z.przypiecie.faza ?? z.przebieg.liczbowa,
    przewin: (sekundy) => z.przebieg.przewin(sekundy, z.pokrycie.ostatnie),
    ustawFaze: (wartosc) => {
      z.przypiecie.faza = wartosc;
    },
    podpowiedz: () => z.podpowiedz(),
    ustawCzas: (wartosc) => {
      z.przypiecie.czas = wartosc;
    },
    czas: () => z.czas(),
  };
}
