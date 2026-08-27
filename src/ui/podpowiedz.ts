/**
 * PODPOWIEDZ GESTU — „duchowe musniecie palcem" nad czolem chmurki.
 *
 * ⛔ POKAZUJE SIE WYLACZNIE GRACZOWI, KTORY JESZCZE NIC NIE NAMALOWAL. Kto raz zrozumial gest,
 * nie potrzebuje przypomnienia, a podpowiedz wracajaca po kazdej dluzszej przerwie przestaje
 * uczyc i zaczyna przeszkadzac — zwlaszcza tutaj, gdzie przerwa jest CZESCIA mechaniki: krem
 * wysycha sam, wiec gracz swiadomie czeka i patrzy, jak warstwa peka. Podpowiedz wracajaca
 * w tym momencie mowilaby mu, ze robi cos zle, podczas gdy robi dokladnie to, o co chodzi.
 *
 * Dlatego warunek ma DWIE czesci i obie sa konieczne: dosc dlugi bezruch ORAZ pusty zyciorys
 * malowania. Druga czesc jest nieodwracalna — `malowal` nigdy nie wraca do `false`, takze po
 * wyczyszczeniu maski przy wejsciu w noc albo po „zagraj jeszcze raz".
 *
 * ⚠️ RYSUJE SIE W SHADERZE, NIE W DOM-ie. Podpowiedz ma wskazywac miejsce, w ktorym naprawde
 * trzeba malowac — czolo chmurki — a to miejsce zna wylacznie scena. Nakladka HTML musialaby
 * powtorzyc geometrie sylwetki drugi raz i rozjechalaby sie z nia po cichu. Ten plik ustala
 * WARUNEK, `src/gpu/obraz.ts` rysuje ksztalt, a laczy je pole `podpowiedz` uniformu sceny.
 */

/** Po ilu sekundach bezruchu pokazac podpowiedz. */
export const PROG_PODPOWIEDZI = 2;

/**
 * Czy w tej chwili pokazac podpowiedz gestu.
 *
 * `bezczynnoscSek` liczy sie od ostatniego malowania (albo od startu zabawy), `malowal` mowi,
 * czy gracz kiedykolwiek cokolwiek namalowal. Prog jest domkniety: dokladnie na `PROG_PODPOWIEDZI`
 * podpowiedz JUZ widac — przypadek brzegowy nazwany z sensu, nie z arytmetyki („czas uplynal"),
 * a nie z porownania zmiennoprzecinkowego, ktore przy dowolnej stalej klatce i tak nigdy nie
 * trafi w prog dokladnie.
 */
export function czyPokazacPodpowiedz(bezczynnoscSek: number, malowal: boolean): boolean {
  if (malowal) return false;
  return bezczynnoscSek >= PROG_PODPOWIEDZI;
}

/**
 * Licznik bezruchu dla petli klatki. Trzyma dwie liczby, ktorych `czyPokazacPodpowiedz` nie ma
 * skad wziac, i nie robi nic wiecej — cala regula siedzi w funkcji wyzej, testowalnej bez stanu.
 *
 * Siedzi tutaj, a nie w `scena.ts`, z tego samego powodu, dla ktorego maszyna faz siedzi
 * w `logika/przebieg.ts`: plik skladajacy kafel ma skladac kafel.
 */
export class Podpowiedz {
  #bezczynnoscSek = 0;
  #malowal = false;

  /**
   * Krok petli. `maluje` = wskaznik wlasnie odciska pedzel (wcisniety albo z odcinkami w kolejce).
   * ⚠️ `dt` podaje sie takie, jakim zyje SCENA — zero poza fazami zabawy. Dzieki temu licznik
   * bezruchu nie tyka podczas karty produktowej ani zachodu, czyli podpowiedz nie wyskakuje
   * z powodu przerwy, w ktorej gracz i tak nie ma czego malowac.
   */
  krok(dt: number, maluje: boolean): void {
    if (maluje) {
      this.#malowal = true;
      this.#bezczynnoscSek = 0;
      return;
    }
    this.#bezczynnoscSek += dt;
  }

  /** 0 albo 1 — wartosc pola `podpowiedz` uniformu sceny. Pulsowanie robi shader. */
  get sila(): number {
    return czyPokazacPodpowiedz(this.#bezczynnoscSek, this.#malowal) ? 1 : 0;
  }

  /** Czy gracz kiedykolwiek cokolwiek namalowal. Raz ustawione, nie wraca. */
  get malowal(): boolean {
    return this.#malowal;
  }
}
