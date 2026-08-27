import { tgpu, d } from 'typegpu';
import { Maska } from './maska.ts';
import { Pokrycie } from './pokrycie.ts';
import { Wskaznik } from './wskaznik.ts';
import { stworzObraz } from './obraz.ts';
import { stworzPrzyrzadKadru } from './przyrzad.ts';
import { zbudujSonde, zPrzypieciem } from './sonda-sceny.ts';
import { naPrzestrzenMaski } from './wspolne.ts';
import { Przebieg, kartaFazy } from '../logika/przebieg.ts';
import { stworzKarte } from '../ui/karta.ts';
import { Podpowiedz } from '../ui/podpowiedz.ts';
import { LicznikKlatek } from './pomiar.ts';
import { czyPokazacHud } from '../logika/srodowisko.ts';
import { PROMIEN_PEDZLA } from '../logika/pedzel.ts';
import type { Barwa } from './przyrzad.ts';
import type { Przypiecie, SondaSceny } from './sonda-sceny.ts';
import type { Pomiar } from './pomiar.ts';

/**
 * SKLADANIE KAFLA: potoki, rozmiar kanwy, petla klatki, HUD i podpiecie sondy.
 *
 * ⛔ CO TU JUZ NIE MIESZKA (zadanie C2, uwaga W3 recenzji): barwy, stale strojenia i SDF-y siedza
 * w `obraz.ts`, siatka probek bramek w `przyrzad.ts`, maszyna faz z rampa zachodu w
 * `logika/przebieg.ts`, karta produktowa w `ui/karta.ts`, a `window.__sonda` w `sonda-sceny.ts`.
 * Przed pierwszym rozdzieleniem ten plik mial 706 linii i trzy niezalezne odpowiedzialnosci
 * naraz. Zadanie D dolozylo fazy, zachod i karty — kazde do wlasnego pliku, wiec skladanie kafla
 * zostalo skladaniem kafla.
 */

/** Gorny limit kroku czasu. Pierwsza klatka po zaladowaniu i powrot z tla daja `dt` rzedu sekund —
 *  bez tego ograniczenia jeden krok zdmuchnalby cala warstwe kremu. */
const DT_MAKS = 0.05;

/** Co ile klatek sciagamy licznik pokrycia na CPU. */
const KLATEK_MIEDZY_ODCZYTAMI = 6;

/** Co ile klatek sciagamy siatke probek kadru. Bramki czekaja setki milisekund, wiec kilkanascie
 *  klatek opoznienia nie ma znaczenia, a odczyt nie obciaza kazdej klatki. */
const KLATEK_MIEDZY_PROBAMI_KADRU = 12;

export type { Barwa, SondaSceny };

export async function start(kanwa: HTMLCanvasElement): Promise<void> {
  const root = await tgpu.init();
  const kontekst = root.configureContext({ canvas: kanwa });

  const maska = new Maska(root);
  const widokMaski = maska.widokDoOdczytu();
  const pokrycie = new Pokrycie(root, widokMaski);
  maska.wyczysc();

  const { uniformSceny, kolorSceny } = stworzObraz(root, widokMaski);
  const przyrzad = stworzPrzyrzadKadru(root, kolorSceny);

  /**
   * Trojkat pokrywajacy cala kanwe — bez bufora wierzcholkow i bez siatki.
   * Pozycje licza sie z indeksu wierzcholka arytmetyka zamiast tablica:
   * i=0 → (0,0), i=1 → (2,0), i=2 → (0,2), czyli w przestrzeni obcinania (-1,-1), (3,-1), (-1,3).
   */
  const wierzcholkowy = tgpu.vertexFn({
    in: { indeks: d.builtin.vertexIndex },
    out: { position: d.builtin.position, uv: d.vec2f },
  })((we) => {
    'use gpu';
    const i = d.f32(we.indeks);
    const rog = d.vec2f(i * (d.f32(2) - i) * d.f32(2), i * (i - d.f32(1)));
    return {
      position: d.vec4f(rog.x * d.f32(2) - d.f32(1), rog.y * d.f32(2) - d.f32(1), 0, 1),
      // Maska ma os Y skierowana w dol jak ekran, przestrzen obcinania w gore — stad odwrocenie.
      uv: d.vec2f(rog.x, d.f32(1) - rog.y),
    };
  });

  const fragmentowy = tgpu.fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
  })((we) => {
    'use gpu';
    return d.vec4f(kolorSceny(naPrzestrzenMaski(we.uv, uniformSceny.$.proporcja)), 1);
  });

  const potok = root.createRenderPipeline({
    vertex: wierzcholkowy,
    fragment: fragmentowy,
    primitive: { topology: 'triangle-list' },
  });

  // --- WSKAZNIK ------------------------------------------------------------------------------
  const wskaznik = new Wskaznik(kanwa);
  const wyczyscScene = (): void => {
    wskaznik.wyczyscKolejke();
    maska.wyczysc();
  };

  // --- PRZEBIEG ZABAWY I KARTY ---------------------------------------------------------------
  const przebieg = new Przebieg();
  const karta = stworzKarte(document.querySelector<HTMLElement>('#karta')!, () => {
    przebieg.odNowa();
    wyczyscScene();
  });
  przebieg.nasluchuj((nowa) => {
    // ⛔ MASKA CZYSCI SIE PRZY WEJSCIU W NOC, A NIE NA POCZATKU ZACHODU. Przez caly zachod
    // chmurka ma zostac spokojna — to jest nagroda za dzien, ktora wlasnie gasnie razem ze
    // sloncem. Wyczyszczenie maski przed rampa cofnałoby ja w grymas w polowie przejscia,
    // czyli dokladnie wtedy, gdy scena ma sie uspokajac.
    if (nowa === 'noc-gra') {
      wyczyscScene();
      // ⛔ KAFEL WRACA POD PALEC PRZED DRUGA RUNDA. Karta stoi NAD kaflem (patrz `ui/karta.ts`)
      // i w chwili nagrody spycha go w dol — skok zaakceptowany swiadomie. Ale zabawa sie tam nie
      // konczy: po `dzien-karta` idzie zachod i `noc-gra`, w ktorej gracz maluje JESZCZE RAZ,
      // a scena jest juz przesunieta spod kursora i moze byc poza widokiem. Przewiniecie dotyczy
      // wylacznie tego jednego przejscia — karta zostaje na miejscu, skok przy nagrodzie zostaje.
      kanwa.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const ktora = kartaFazy(nowa);
    if (ktora) karta.pokaz(ktora);
    else karta.schowaj();
  });
  /** Przypiecia sondy — patrz `ustawFaze` i `ustawCzas`. `null` = steruje zycie sceny. */
  const przypiecie: Przypiecie = { faza: null, czas: null };

  // --- ROZMIAR KANWY -------------------------------------------------------------------------
  // ⚠️ Kanwa jest KAFLEM w kolumnie tresci (rzedu 420 px, `docs/design.md` §1a), a nie tlem
  // strony — rozmiar bierze sie z `ResizeObserver` na samej kanwie, nie z okna.
  const maksBok = root.device.limits.maxTextureDimension2D;
  new ResizeObserver(([wpis]) => {
    if (!wpis) return;
    const dpr = window.devicePixelRatio || 1;
    const rozmiar = wpis.contentBoxSize[0]!;
    kanwa.width = Math.max(1, Math.min(Math.round(rozmiar.inlineSize * dpr), maksBok));
    kanwa.height = Math.max(1, Math.min(Math.round(rozmiar.blockSize * dpr), maksBok));
  }).observe(kanwa, { box: 'content-box' });

  // --- PETLA KLATKI --------------------------------------------------------------------------
  // ⛔ HUD JEST ZGASZONY W WYDANEJ WERSJI. Warunek i jego uzasadnienie: `logika/srodowisko.ts`.
  // Pusty `#hud` nic nie rysuje, wiec wystarczy nie podac elementu — nie ma tu drugiego trybu.
  const hud = czyPokazacHud(window.location.search, import.meta.env.DEV)
    ? document.querySelector<HTMLDivElement>('#hud')
    : null;
  const podpowiedz = new Podpowiedz();
  const licznikKlatek = new LicznikKlatek();
  /** Ostatnia wartosc pola `podpowiedz` ZAPISANA do uniformu — to ja czyta sonda, nie sam licznik. */
  let podpowiedzNaGpu = 0;
  /** Ostatnia wartosc pola `czas` ZAPISANA do uniformu — z przypieciem sondy wlacznie. */
  let czasNaGpu = 0;
  const czasStartu = performance.now();
  let poprzedniCzas = czasStartu;
  let numerKlatki = 0;
  /** Obroty `requestAnimationFrame` — patrz `Pomiar.klatek`. Rosnie takze po wyjatku. */
  let obrotow = 0;
  /** Klatki zakonczone wyjatkiem — patrz `Pomiar.bledow`. */
  let bledow = 0;

  function trescKlatki() {
    const teraz = performance.now();
    const msKlatki = teraz - poprzedniCzas;
    const dt = Math.min(msKlatki / 1000, DT_MAKS);
    poprzedniCzas = teraz;
    // ⚠️ SUROWY CZAS KLATKI, NIE `dt`. `dt` jest scinane do `DT_MAKS`, zeby jedna dluga przerwa
    // nie zdmuchnela warstwy kremu — a przyrzad ma pokazac wlasnie te dluga przerwe. Pierwsza
    // klatka wypada, bo mierzy inicjalizacje GPU, a nie rysowanie.
    if (numerKlatki > 0) licznikKlatek.zapisz(msKlatki);

    // ⛔ SCENA ZAMIERA POZA FAZAMI ZABAWY. Karta i zachod to opowiesc, nie runda: gdyby krem
    // schnal dalej, chmurka wracalaby do grymasu dokladnie wtedy, gdy stoi przy niej karta
    // z nagroda, a zachod zaczynalby sie od cofniecia tego, co gracz przed chwila wywalczyl.
    const gra = przypiecie.faza === null ? przebieg.gra : true;
    const dtSceny = gra ? dt : 0;

    if (!gra) {
      wskaznik.wyczyscKolejke();
    }
    // ⚠️ CZYTANE PRZED ODCISNIECIEM PEDZLA, bo kolejka odcinkow jest zaraz nizej oprozniana.
    // `dtSceny` (nie `dt`) sprawia, ze bezruch podczas karty i zachodu nie tyka.
    podpowiedz.krok(dtSceny, gra && (wskaznik.wcisniety || wskaznik.kolejka.length > 0));
    if (wskaznik.kolejka.length === 0) {
      // Zadnego ruchu od poprzedniej klatki — ale krok musi sie wykonac, bo to on suszy krem.
      // ⛔ `maluje` IDZIE ZA STANEM WSKAZNIKA, NIE ZA PUSTOSCIA KOLEJKI: pojedyncze dotkniecie
      // nie malowaloby niczego, a warstwa pod przytrzymanym palcem SCHLABY.
      maska.krok({
        p0: wskaznik.ostatniPunkt,
        p1: wskaznik.ostatniPunkt,
        promien: PROMIEN_PEDZLA,
        maluje: gra && wskaznik.wcisniety ? 1 : 0,
        dt: dtSceny,
      });
    } else {
      // Wysychanie jest sprawa KLATKI, nie odcinka: caly `dt` idzie do ostatniego kroku, zeby
      // gesta seria zdarzen wskaznika nie suszyla warstwy szybciej niz rzadka.
      const ile = wskaznik.kolejka.length;
      for (let i = 0; i < ile; i++) {
        const odcinek = wskaznik.kolejka[i]!;
        maska.krok({
          p0: odcinek.p0,
          p1: odcinek.p1,
          promien: PROMIEN_PEDZLA,
          maluje: 1,
          dt: i === ile - 1 ? dtSceny : 0,
        });
      }
      wskaznik.wyczyscKolejke();
    }

    pokrycie.krok();
    if (numerKlatki % KLATEK_MIEDZY_ODCZYTAMI === 0) {
      // ⚠️ ODRZUCENIE MUSI BYC SLYCHAC. Bez tego `catch` nieudany odczyt leci jako nieobsluzone
      // odrzucenie co 6 klatek, a `pokrycie.ostatnie` cicho zamarza na starej wartosci.
      pokrycie.odczytaj().catch((blad: unknown) => {
        console.error('odczyt pokrycia nie powiodl sie', blad);
      });
    }

    // ⚠️ PRZEBIEG TYKA PO MASCE, NIE PRZED NIA — pokrycie ma dotyczyc tej klatki, ktora wlasnie
    // poszla na GPU. Przypiecie z sondy zatrzymuje maszyne: bramka blasku potrzebuje nocnej
    // palety bez przejezdzania calej trasy i bez karty wjezdzajacej jej w srodek pomiaru.
    if (przypiecie.faza === null) przebieg.krok(pokrycie.ostatnie, dt);

    // ⚠️ JAWNE ZERO POZA FAZAMI ZABAWY. Z samego przebiegu wynika, ze gracz, ktory doszedl do karty,
    // juz malowal — ale to jest wniosek z DRUGIEGO pliku. Bramka pinujaca faze (`ustawFaze`) omija
    // maszyne przejsc w calosci, wiec warunek stoi tutaj wprost.
    podpowiedzNaGpu = gra ? podpowiedz.sila : 0;

    // ⚠️ CZAS PRZECHODZI PRZEZ `zPrzypieciem` — sonda potrafi go zatrzymac na wybranej wartosci,
    // zeby bramka podpowiedzi mierzyla WYBRANE punkty toru, a nie losowa faze animacji.
    czasNaGpu = zPrzypieciem(przypiecie.czas, (teraz - czasStartu) / 1000);

    uniformSceny.write({
      czas: czasNaGpu,
      proporcja: kanwa.width / Math.max(kanwa.height, 1),
      faza: przypiecie.faza ?? przebieg.liczbowa,
      pokrycie: pokrycie.ostatnie,
      podpowiedz: podpowiedzNaGpu,
    });

    potok
      .withColorAttachment({
        view: kontekst,
        clearValue: [0, 0, 0, 1],
        loadOp: 'clear',
        storeOp: 'store',
      })
      .draw(3);

    if (numerKlatki % KLATEK_MIEDZY_PROBAMI_KADRU === 0) {
      przyrzad.odswiez().catch((blad: unknown) => {
        console.error('odczyt proby kadru nie powiodl sie', blad);
      });
    }
    numerKlatki++;

    if (hud) hud.textContent = `pokrycie ${(pokrycie.ostatnie * 100).toFixed(1)}%  ${przebieg.faza}`;
  }

  /**
   * ⛔ `requestAnimationFrame` STOI W `finally`, A NIE W OGONIE TRESCI KLATKI.
   *
   * Do 2026-08-27 wywolanie to bylo ostatnia instrukcja `klatka()` i nie oslanial go zaden
   * `try/catch`. Kazdy synchroniczny wyjatek — w `maska.krok`, `uniformSceny.write`, `potok.draw`
   * albo `przebieg.krok` — zabijal animacje NA ZAWSZE, a objaw byl nie do odroznienia od
   * dlawienia karty przez przegladarke: obraz stoi, `msKlatki` pokazuje wzorowe 16,7 ms (bo
   * srednia zamarza razem z petla), konsola milczy. Na tej niejednoznacznosci raport zadania E
   * postawil teze o „zamrazaniu rAF przez Chrome", ktorej nie dalo sie ani potwierdzic, ani obalic.
   *
   * ⚠️ WYJATEK MA ZOSTAWIC SLAD, A NIE ZOSTAC POLKNIETY. `console.error` widzi sonda CDP,
   * a `Pomiar.bledow` liczy przypadki dla kogos, kto konsoli nie czyta.
   */
  function klatka() {
    try {
      trescKlatki();
    } catch (blad: unknown) {
      bledow++;
      console.error('wyjatek w petli klatki — petla leci dalej, ale klatka byla niepelna', blad);
    } finally {
      obrotow++;
      requestAnimationFrame(klatka);
    }
  }

  const sonda = zbudujSonde({
    maska, pokrycie, wskaznik, przyrzad, przebieg, przypiecie, wyczyscScene,
    podpowiedz: () => podpowiedzNaGpu,
    czas: () => czasNaGpu,
  });
  (window as unknown as { __sonda: SondaSceny }).__sonda = sonda;
  // PRZYRZAD POMIAROWY — trzy liczby, zero sterowania. Uzasadnienie rozdzialu: `pomiar.ts`.
  (window as unknown as { __pomiar: () => Pomiar }).__pomiar = () => ({
    pokrycie: pokrycie.ostatnie,
    faza: przebieg.faza,
    msKlatki: licznikKlatek.srednia,
    klatek: obrotow,
    odOstatniejMs: performance.now() - poprzedniCzas,
    bledow,
  });

  requestAnimationFrame(klatka);
  (window as unknown as { __gotowe: boolean }).__gotowe = true;
}
