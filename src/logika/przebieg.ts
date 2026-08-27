import { CZAS_ZACHODU, STAN_POCZATKOWY, nastepnyStan } from './fazy.ts';
import type { Faza, StanFaz } from './fazy.ts';

/**
 * PRZEBIEG ZABAWY: maszyna faz owinieta w to, czego potrzebuje scena — liczbowa faze na uniform,
 * powiadomienie o zmianie i przewijanie bez zegara.
 *
 * ⛔ TO NIE JEST DRUGA MASZYNA FAZ. Cala regula przejsc siedzi w `fazy.ts` i jest tam pilnowana
 * testami; tutaj mieszka wylacznie to, co z niej WYNIKA dla obrazu i dla dokumentu. Gdyby ktora
 * z tych rzeczy trafila do `scena.ts`, plik skladajacy kafel znowu zaczalby rosnac o cudze
 * odpowiedzialnosci — dokladnie to, co zadanie C2 z niego wyjelo.
 */

/** Fazy, w ktorych gracz maluje i w ktorych pokrycie w ogole cokolwiek zmienia. */
export function czyGra(faza: Faza): boolean {
  return faza === 'dzien-gra' || faza === 'noc-gra';
}

/** Ktora karta produktowa stoi w tej fazie na widoku; `null` = zadna. */
export function kartaFazy(faza: Faza): 'dzien' | 'noc' | null {
  if (faza === 'dzien-karta') return 'dzien';
  if (faza === 'noc-karta') return 'noc';
  return null;
}

/**
 * Pole `faza` uniformu sceny: 0 = pelen dzien, 1 = pelna noc.
 *
 * ⛔ ZACHOD JEST RAMPA, NIE PRZELACZNIKIEM. Kazda barwa i kazda stala rozniaca dzien od nocy
 * wchodzi do `kolorSceny` przez `std.mix(dzien, noc, faza)`, wiec wystarczy, ze ta jedna liczba
 * przejdzie 0 → 1 plynnie, a cala paleta przejedzie razem z nia. Skok 0 → 1 daloby przelacznik
 * swiatla; rampa daje zachod.
 *
 * ⚠️ Liczy sie z `wFazieOd`, czyli z licznika, ktory maszyna faz i tak prowadzi — nie z wlasnego,
 * rownoleglego zegara. Drugi zegar rozjechalby sie z pierwszym przy kazdym przewinieciu.
 */
export function fazaLiczbowa(stan: StanFaz): number {
  switch (stan.faza) {
    case 'dzien-gra':
    case 'dzien-karta':
      return 0;
    case 'zachod':
      return Math.min(1, Math.max(0, stan.wFazieOd / CZAS_ZACHODU));
    case 'noc-gra':
    case 'noc-karta':
      return 1;
  }
}

/**
 * Najwiekszy podkrok, na jaki `przewin` tnie zadany czas.
 *
 * ⛔ PRZEWIJANIE MUSI TYKAC DROBNO, BO `nastepnyStan` PRZESUWA SIE O JEDNA FAZE NA WYWOLANIE
 * (i tak ma byc — pilnuje tego test „dt wieksze niz cala faza"). Jedno wywolanie z dt = 10 s
 * zjadloby cztery przejscia i zglosiloby jedno. Podkrok rzedu klatki daje ten sam ciag zmian,
 * ktory zobaczylby prawdziwy zegar.
 */
const PODKROK_PRZEWIJANIA = 1 / 120;

/** Nasluch zmiany fazy. Dostaje nowa i poprzednia — po nich poznaje sie WEJSCIE w noc. */
export type NasluchFazy = (nowa: Faza, poprzednia: Faza) => void;

export class Przebieg {
  #stan: StanFaz = STAN_POCZATKOWY;
  #nasluch: NasluchFazy = () => {};

  /** Zglasza KAZDA zmiane fazy, takze te, ktore zaszly w srodku jednego `przewin`. */
  nasluchuj(nasluch: NasluchFazy): void {
    this.#nasluch = nasluch;
  }

  get stan(): StanFaz {
    return this.#stan;
  }

  get faza(): Faza {
    return this.#stan.faza;
  }

  /** Wartosc na uniform sceny — patrz `fazaLiczbowa`. */
  get liczbowa(): number {
    return fazaLiczbowa(this.#stan);
  }

  /** Czy gracz ma teraz cokolwiek do roboty. Karty i zachod to scena, nie zabawa. */
  get gra(): boolean {
    return czyGra(this.#stan.faza);
  }

  krok(pokrycie: number, dt: number): void {
    this.#ustaw(nastepnyStan(this.#stan, pokrycie, dt));
  }

  /**
   * Dopycha maszyne o `sekundy` BEZ CZEKANIA NA ZEGAR — hak wylacznie dla bramki. Bez niego
   * przejscie calej trasy trwaloby tyle, ile sumy progow czasowych, czyli kilkanascie sekund
   * na przebieg.
   */
  przewin(sekundy: number, pokrycie: number): void {
    if (!(sekundy > 0)) return;
    const podkrokow = Math.ceil(sekundy / PODKROK_PRZEWIJANIA);
    const dt = sekundy / podkrokow;
    for (let i = 0; i < podkrokow; i++) this.krok(pokrycie, dt);
  }

  /** „Zagraj jeszcze raz": powrot do `STAN_POCZATKOWY`. Maske czysci nasluch, bo to sprawa GPU. */
  odNowa(): void {
    this.#ustaw(STAN_POCZATKOWY);
  }

  #ustaw(nowy: StanFaz): void {
    const poprzednia = this.#stan.faza;
    this.#stan = nowy;
    if (nowy.faza !== poprzednia) this.#nasluch(nowy.faza, poprzednia);
  }
}
