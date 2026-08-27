import obrazDzien from '../../assets/produkt-dzien-spf50.webp';
import obrazNoc from '../../assets/produkt-noc-sleeping.webp';

/**
 * KARTA PRODUKTOWA — nagroda za domkniecie rundy.
 *
 * ⛔ KARTA STOI NAD KAFLEM, W KOLUMNIE TRESCI, A NIE NA KAFLU. Kafel ma 420 px i postac zajmuje
 * jego dolna polowe (sylwetka: y 0,55–0,87 przestrzeni maski, `logika/chmurka.ts`). Karta
 * wjezdzajaca NA kafel musialaby stanac wlasnie tam — czyli zakryc soba rozluzniona mine, ktora
 * gracz przed chwila wywalczyl, i zabrac obrazkowi 96 px oraz trzem wierszom tekstu cala szerokosc
 * 420 px. W kolumnie karta dostaje pelna szerokosc — 592 px uzytecznych (`main` ma 640 px minus
 * 48 px paddingu, `index.html`), NIE 640 — a scena zostaje widoczna w calosci. To jest dokladnie
 * to, czego chce brief: „karta wjezdza na uspokojona scene, nie zastepuje jej".
 *
 * ⚠️ NAD, A NIE POD — I SKOK UKLADU JEST WYBRANY SWIADOMIE. Nagroda ma sie pojawic tam, gdzie oko
 * czyta dalej, czyli nad kaflem; kosztem jest to, ze w chwili pokazania karta spycha kafel w dol.
 * Alternatywa — miejsce zarezerwowane z gory — kupuje brak skoku za dziure w kolumnie tresci przez
 * cala pierwsza runde. Wybrany zostal skok, wiec ⛔ zadnego `min-height` ani zastepnika.
 *
 * ⛔ OBA OBRAZY POWSTAJA OD RAZU, TAKZE TEN, KTORY JESZCZE NIE JEST POTRZEBNY. Bramka „dwie
 * bitmapy i ani jednej wiecej" liczy zasoby graficzne po 1,5 s od wczytania strony, nie po
 * przejsciu calej zabawy. Leniwe tworzenie obrazu nocnego dawaloby w tym momencie JEDEN wpis
 * i bramka konczylaby sie czerwono, mimo ze projekt uzywa dokladnie dwoch plikow.
 */

export interface TrescKarty {
  obraz: string;
  /** Tekst zastepczy: nazwa produktu z odnosnika. ⛔ ZADNYCH WLASNYCH OBIETNIC O DZIALANIU. */
  alt: string;
  naglowek: string;
  tekst: string;
  odnosnik: string;
}

/**
 * ⛔ TRESC DOSLOWNIE ZE SPECU §7. Nagłowki, zdania i adresy pochodza
 * z komunikacji marki — nie wolno ich przeredagowac, skrocic ani „poprawic".
 */
export const KARTY: Record<'dzien' | 'noc', TrescKarty> = {
  dzien: {
    obraz: obrazDzien,
    alt: 'Krem SPF 50 wyrównujący koloryt skóry',
    naglowek: 'Twoja tarcza przed UV',
    tekst: 'Krem SPF 50 wyrównujący koloryt — nakładasz na biało, dopasowuje się do Twojej cery.',
    odnosnik: 'https://fluff.com.pl/krem-spf-50-wyrownujacy-koloryt-skory-50ml',
  },
  noc: {
    obraz: obrazNoc,
    alt: 'Sleeping Cream na dobranoc',
    naglowek: 'Ekran świeci, Ty regenerujesz',
    tekst: 'Sleeping Cream z pyłem księżycowym — z Synchrolife™, chroni przed światłem niebieskim z telefonów i laptopów.',
    odnosnik: 'https://fluff.com.pl/produkty/krem-sleeping-na-dobranoc',
  },
};

/** Napis na odnosniku do sklepu — jednakowy na obu kartach, wiec stoi raz. */
const ETYKIETA_SKLEPU = 'Zobacz w sklepie →';
/** Napis na przycisku powrotu. Tylko karta nocna, bo tylko ona konczy zabawe. */
const ETYKIETA_POWROTU = 'zagraj jeszcze raz';

export interface Karta {
  /** Wsuwa karte z podana trescia. Powtorne wywolanie z ta sama karta nic nie zmienia. */
  pokaz: (ktora: 'dzien' | 'noc') => void;
  /** Chowa karte natychmiast — wyjscie jest cieciem, wjazd jest animowany. */
  schowaj: () => void;
  /** Ktora karta stoi na widoku; `null` = zadna. */
  widoczna: () => 'dzien' | 'noc' | null;
}

/**
 * Buduje karte w podanym gniezdzie. `odNowa` dostaje przycisk „zagraj jeszcze raz" — jego robota
 * (powrot do stanu poczatkowego i wyczyszczenie maski) nalezy do sceny, nie do dokumentu.
 */
export function stworzKarte(gniazdo: HTMLElement, odNowa: () => void): Karta {
  // Oba obrazy powstaja tutaj i zyja przez cala sesje; do gniazda wchodzi ten, ktory akurat gra.
  const obrazy: Record<'dzien' | 'noc', HTMLImageElement> = {
    dzien: nowyObraz(KARTY.dzien),
    noc: nowyObraz(KARTY.noc),
  };

  const naglowek = document.createElement('h2');
  const tekst = document.createElement('p');

  const sklep = document.createElement('a');
  sklep.className = 'karta-sklep';
  sklep.target = '_blank';
  sklep.rel = 'noopener noreferrer';
  sklep.textContent = ETYKIETA_SKLEPU;

  const powrot = document.createElement('button');
  powrot.type = 'button';
  powrot.className = 'karta-powrot';
  powrot.textContent = ETYKIETA_POWROTU;
  powrot.addEventListener('click', odNowa);

  const przyciski = document.createElement('div');
  przyciski.className = 'karta-przyciski';
  przyciski.append(sklep, powrot);

  const tresc = document.createElement('div');
  tresc.className = 'karta-tresc';
  tresc.append(naglowek, tekst, przyciski);

  gniazdo.append(tresc);
  gniazdo.hidden = true;

  let stoi: 'dzien' | 'noc' | null = null;

  return {
    widoczna: () => stoi,
    pokaz: (ktora) => {
      if (stoi === ktora) return;
      stoi = ktora;
      const trescKarty = KARTY[ktora];
      naglowek.textContent = trescKarty.naglowek;
      tekst.textContent = trescKarty.tekst;
      sklep.href = trescKarty.odnosnik;
      // ⛔ TYLKO KARTA NOCNA KONCZY ZABAWE. W dzien przycisk powrotu wyrzucalby gracza z rundy,
      // ktorej jeszcze nie skonczyl — a `noc-karta` jest stanem koncowym maszyny faz.
      powrot.hidden = ktora !== 'noc';
      gniazdo.prepend(obrazy[ktora]);
      obrazy[ktora === 'noc' ? 'dzien' : 'noc'].remove();

      gniazdo.hidden = false;
      // Klasa musi wejsc PO tym, jak przegladarka zobaczy element juz nieukryty — inaczej
      // przejscie nie ma stanu wyjsciowego i karta pojawia sie skokiem zamiast wjezdzac.
      requestAnimationFrame(() => gniazdo.classList.add('widoczna'));
    },
    schowaj: () => {
      if (stoi === null) return;
      stoi = null;
      gniazdo.classList.remove('widoczna');
      gniazdo.hidden = true;
    },
  };
}

function nowyObraz(tresc: TrescKarty): HTMLImageElement {
  const obraz = document.createElement('img');
  obraz.src = tresc.obraz;
  obraz.alt = tresc.alt;
  obraz.width = 96;
  obraz.height = 96;
  obraz.decoding = 'async';
  return obraz;
}
