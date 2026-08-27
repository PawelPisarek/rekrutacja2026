import { ekranNaMaske } from '../logika/mapowanie.ts';

/** Punkt w przestrzeni maski (0..1, y w dol). */
export type Punkt = [number, number];

/** Kawalek smugi: gdzie wskaznik byl i gdzie jest. Pedzel liczy odleglosc od tego ODCINKA. */
export interface Odcinek {
  p0: Punkt;
  p1: Punkt;
}

/**
 * Warstwa wskaznika: Pointer Events, kolejka odcinkow i syntetyczne haki dla sondy.
 *
 * Wydzielone ze `scena.ts` (krok C0a): tamten plik trzymal potok renderujacy, obsluge wskaznika,
 * ResizeObserver, petle klatki, HUD i `window.__sonda` naraz. Zadanie C dokłada do niego pelna
 * scene, zadanie D fazy i karty — warstwa wskaznika wychodzi stad najczysciej i bez ryzyka,
 * bo nie dotyka GPU ani w jedna, ani w druga strone.
 */
export class Wskaznik {
  /**
   * Odcinki zebrane od poprzedniej klatki. Wskaznik potrafi wygenerowac kilka `pointermove` na
   * klatke; scinanie ich do jednego odcinka gubiloby poczatek ruchu, a rozkladanie po jednym na
   * klatke opoznialoby smuge. Wiec kolejka, oprozniana w calosci w najblizszej klatce.
   */
  readonly kolejka: Odcinek[] = [];

  #wcisniety = false;
  #ostatniPunkt: Punkt = [0.5, 0.5];
  readonly #kanwa: HTMLCanvasElement;

  constructor(kanwa: HTMLCanvasElement) {
    this.#kanwa = kanwa;

    kanwa.addEventListener('pointerdown', (e) => {
      kanwa.setPointerCapture(e.pointerId);
      this.#wcisniety = true;
      this.#ostatniPunkt = this.#naMaske(e);
    });
    kanwa.addEventListener('pointermove', (e) => {
      if (!this.#wcisniety) return;
      const punkt = this.#naMaske(e);
      this.kolejka.push({ p0: this.#ostatniPunkt, p1: punkt });
      this.#ostatniPunkt = punkt;
    });
    const puszczono = (): void => {
      this.#wcisniety = false;
    };
    kanwa.addEventListener('pointerup', puszczono);
    kanwa.addEventListener('pointercancel', puszczono);
  }

  /** 1 = wskaznik wcisniety. `maluje` IDZIE ZA TYM STANEM, nie za pustoscia kolejki — wpisane
   *  na sztywno 0 dawalo warstwe schnaca pod nieruchomym, przytrzymanym palcem (recenzja B). */
  get wcisniety(): boolean {
    return this.#wcisniety;
  }

  /** Ostatnia znana pozycja w przestrzeni maski. Przy pustej kolejce to z niej powstaje odcinek
   *  zdegenerowany do punktu — shader ma ten przypadek obsluzony. */
  get ostatniPunkt(): Punkt {
    return this.#ostatniPunkt;
  }

  /**
   * ⚠️ LUSTRO `ekranNaMaske` — korekta proporcji jest tu, a nie w odciskaniu pedzla.
   * Kadr jest prostokatem, maska kwadratem; bez tego przeliczenia kolo pedzla wychodzi elipsa.
   * Uzasadnienie wyboru: `src/logika/mapowanie.ts`.
   */
  #naMaske(e: PointerEvent): Punkt {
    const r = this.#kanwa.getBoundingClientRect();
    const szer = Math.max(r.width, 1e-6);
    const wys = Math.max(r.height, 1e-6);
    return ekranNaMaske((e.clientX - r.left) / szer, (e.clientY - r.top) / wys, szer / wys);
  }

  /**
   * Syntetyczne pociagniecie pedzlem w przestrzeni MASKI. Wpisuje kolejne pary p0/p1 do TEJ SAMEJ
   * kolejki, co `pointermove` — inaczej bramka sprawdzalaby inna sciezke kodu niz gra.
   */
  pociagnij(x0: number, y0: number, x1: number, y1: number, krokow = 20): void {
    let poprzedni: Punkt = [x0, y0];
    for (let i = 1; i <= krokow; i++) {
      const t = i / krokow;
      const punkt: Punkt = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
      this.kolejka.push({ p0: poprzedni, p1: punkt });
      poprzedni = punkt;
    }
    this.#ostatniPunkt = poprzedni;
  }

  /**
   * Przytrzymanie wskaznika BEZ ruchu — jedyna sciezka, ktorej `pociagnij` nie umie odtworzyc,
   * bo ono zawsze generuje odcinki. To ona ujawnila, ze `maluje` bylo wpisane na sztywno na 0.
   */
  async dotknij(x: number, y: number, ms = 300): Promise<void> {
    this.#ostatniPunkt = [x, y];
    this.#wcisniety = true;
    await new Promise((gotowe) => setTimeout(gotowe, ms));
    this.#wcisniety = false;
  }

  /** Porzuca odcinki, ktore jeszcze nie trafily do maski. Uzywane przy czyszczeniu maski. */
  wyczyscKolejke(): void {
    this.kolejka.length = 0;
  }
}
