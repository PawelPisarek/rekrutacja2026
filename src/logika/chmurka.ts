/**
 * ⛔ KSZTALT SYLWETKI JEST JEDNA DEFINICJA NA CALY PROJEKT.
 *
 * Maskotka przestala byc ozdoba posrodku kafla i jest CELEM ZABAWY: licznik pokrycia liczy po jej
 * CZOLE, a fragment rysuje dokladnie ten sam ksztalt. Gdyby ksztalt istnial w dwoch kopiach,
 * objaw — „licznik rosnie tam, gdzie nic nie widac" — szukaloby sie w shaderze. Dlatego liczby
 * mieszkaja TUTAJ i sa importowane przez `src/gpu/wspolne.ts` (wersja GPU). To ten sam uklad,
 * co `odcinek.ts` / `mapowanie.ts` / `wysychanie.ts`: wersja CPU jest zrodlem prawdy, bo da sie
 * ja zmierzyc bez WebGPU, a wersja GPU liczy to samo.
 *
 * ⚠️ NAZWA `chmurka` ZOSTAJE JAKO IMIE MASKOTKI, A NIE OPIS KSZTALTU. Sylwetka jest dzis lezaca
 * KAPSULA, nie chmurka — ale slowo „chmurka" siedzi w ponad dwustu miejscach repozytorium
 * (komentarze, bramki, README, nazwy w `obraz.ts`), wiec przemianowanie zalaloby diff zmiany,
 * ktora dotyczy jednego ksztaltu. Nazwa oznacza tu POSTAC, geometrie opisuja stale ponizej.
 *
 * Uklad wspolrzednych: przestrzen maski 0..1, os Y w DOL. Wymiary podane WZGLEDEM srodka postaci.
 */

/**
 * ⛔ JEDNA CIAGLA GORNA KRAWEDZ — I TO JEST CALY POWOD TEJ GEOMETRII.
 *
 * Poprzednia sylwetka byla suma pieciu zlanych kol o roznych promieniach: duzy garb posrodku
 * i dwa nizsze po bokach. Uzytkownik zglosil, ze taki obrys — jeden wysoki srodek nad dwoma
 * niskimi bokami — budzi niezamierzone skojarzenia. To NIE jest kwestia doboru promieni: przyczyna jest
 * strukturalna, bo trzy garby o roznej wysokosci zawsze ustawiaja sie w te sylwetke.
 *
 * Dlatego gorna krawedz jest teraz JEDNA krzywa bez wglebien: kapsula lezaca, czyli odleglosc
 * do POZIOMEGO ODCINKA minus promien. Nad odcinkiem (|x| <= POLOWA_KAPSULY) krawedz jest prosta
 * i plaska, poza nim schodzi cwiartka okregu. Zadnego lokalnego minimum, wiec zadnych garbow —
 * pilnuje tego `test/chmurka.test.ts`, ktory liczy je z obrysu, a nie wierzy stalym.
 *
 * ⚠️ WYMIARY SA WNIOSKIEM Z TRZECH OGRANICZEN NARAZ, a nie dobrane na oko:
 *  1. sylwetka ma byc WYRAZNIE szersza niz wyzsza (kapsula lezaca, nie pionowa pigulka);
 *  2. CZOLO — pas nad oczami, czyli caly obszar liczony — musi byc WYZSZE od srednicy pedzla
 *     (`PROMIEN_PEDZLA` z `logika/pedzel.ts`), inaczej jedno przeciagniecie zakrywa je w calosci
 *     i prog pokrycia robi sie darmowy. Stad `PROMIEN_KAPSULY + LINIA_CZOLA` = 0,126;
 *  3. ponizej `LINIA_CZOLA` musi sie zmiescic cala twarz: oczy i usta.
 * Suma 2 i 3 ustala wysokosc, a warunek 1 — szerokosc.
 */
/** Polowa dlugosci odcinka, na ktorym rozpieta jest kapsula (jej plaska czesc). */
export const POLOWA_KAPSULY = 0.220;
/** Promien kapsuly — zarazem jej wysokosc nad odcinkiem. */
export const PROMIEN_KAPSULY = 0.170;

/**
 * ⛔ PLASKI SPOD JEST ODCIETY, A NIE WYSTROJONY.
 *
 * Spod jest PRZECIECIEM sylwetki z polplaszczyzna `y <= SPOD`: plaski z definicji, niezaleznie
 * od tego, jak ustawi sie reszte. Kapsula siega ponizej tej linii (`PROMIEN_KAPSULY > SPOD`),
 * wiec ciecie ma co ucinac. Zostaje z poprzedniej wersji ksztaltu — to jedyna czesc geometrii,
 * ktorej reklamacja nie dotyczyla.
 */
export const SPOD = 0.150;

/** Zaokraglenie rogow plaskiego spodu. Male, zeby spod zostal spodem, a nie kolejnym lukiem. */
export const ZLACZENIE_SPODU = 0.008;

/**
 * ⛔ SRODEK SIEDZI W DOLNEJ CZESCI KAFLA, NIE POSRODKU.
 *
 * Postac ma byc duzym elementem osadzonym nisko — dominowac, a nie stac jako ozdoba na srodku.
 * Przy tym srodku sylwetka zajmuje 0,11–0,89 w poziomie i 0,55–0,87 w pionie, wiec nad nia
 * zostaje pas samej swiecacej powierzchni (tam mierzy bramka, patrz `WYCINEK_SZKLA` — jej dolna
 * krawedz to 0,42) i waski margines pola pod spodem.
 */
export const SRODEK_CHMURKI = { x: 0.5, y: 0.72 } as const;

/**
 * ⛔ OBSZAR SKUTECZNY TO CZOLO, CZYLI TO, CO LEZY NAD OCZAMI.
 *
 * Bez tego gracz malowal po calym kaflu, a wiec i po twarzy maskotki — dlon zaslaniala dokladnie
 * te rzecz, ktora jest nagroda za malowanie (uzytkownik zglosil, ze malujac palcem, przestaje
 * widziec maskotke).
 * Gdy liczy sie wylacznie czolo, palec pracuje NAD twarza i mina zostaje widoczna w trakcie.
 *
 * Wartosc jest wspolrzedna Y wzgledem srodka postaci: mniejsza (wyzej) = czolo. Musi lezec nad
 * gorna krawedzia oka (`OKO.y - OKO.r` = 0,006), inaczej celem znowu staje sie twarz — pilnuje
 * tego test.
 *
 * ⛔ TA LICZBA NIE IDZIE ZA OCZAMI, BO JEST MIANOWNIKIEM POKRYCIA. Gogle wypadly (uzytkownik
 * wolal poprzednie oczy) i twarz zajmuje dzis mniej miejsca, wiec warunek „nad okiem" ma teraz
 * 0,050 zapasu zamiast 0,008. Obnizenie `LINIA_CZOLA` do samych oczu powiekszyloby obszar liczony
 * i uniewaznilo `PROG_POKRYCIA`, ktory byl mierzony przy udziale czola 8,55% maski. Zapas jest
 * wiec CENA za to, ze prog zostaje zmierzony — a nie niedopatrzeniem.
 */
export const LINIA_CZOLA = -0.044;

// --- TWARZ ---------------------------------------------------------------------------------
/**
 * ⛔ DWA MALE CIEMNE OCZY, BEZ OPRAWY — I TO JEST DECYZJA UZYTKOWNIKA, NIE POWROT DO STANU.
 *
 * Zadanie F wstawilo tu gogle: dwie duze soczewki z rantem, spiete poziomym mostkiem. Uzytkownik
 * zobaczyl zrzut i zglosil wprost, ze okularow nie chcial i ze woli proste ciemne oczy sprzed
 * tamtej zmiany. Gogle wypadly wiec W CALOSCI — soczewki, rant i mostek — a zostaly proste
 * ciemne elipsy sprzed tamtej zmiany (promien 0,024), ktore mruza sie razem ze spiekiem.
 *
 * ⚠️ KSZTALT KAPSULY ZOSTAJE. To on rozwiazal zgloszona reklamacje obrysu i uzytkownik go nie
 * kwestionuje — zmienila sie WYLACZNIE twarz. Dlatego oczy siedza na wspolrzednych dobranych do
 * kapsuly (x 0,100, y 0,030), a nie na tych sprzed zmiany sylwetki: tamte nalezaly do wezszego
 * i wyzszego ksztaltu.
 *
 * Efekt uboczny, o ktory nie trzeba juz osobno dbac: soczewki z mostkiem byly jedynym elementem
 * budujacym podobienstwo do chronionej postaci — bez nich nie ma czego oslabiac.
 *
 * `x` to odleglosc srodka oka od osi postaci, `y` — jego wysokosc, `r` — promien.
 */
export const OKO = { x: 0.100, y: 0.030, r: 0.024 } as const;
/** Usta: wysokosc spoczynkowa, polowa szerokosci i grubosc kreski. Pod oczami, nad spodem. */
export const USTA = { y: 0.112, polowaSzerokosci: 0.042, grubosc: 0.008 } as const;

/** Gladkie zlaczenie dwoch odleglosci (polynomial smooth min). Lustro `zlaczGladko` z GPU. */
export function zlaczGladko(a: number, b: number, k: number): number {
  const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

/** Gladkie PRZECIECIE — smooth max przez zanegowane smooth min. Lustro `przetnijGladko` z GPU. */
export function przetnijGladko(a: number, b: number, k: number): number {
  return -zlaczGladko(-a, -b, k);
}

/**
 * ⚠️ LUSTRO `sdfChmurki` ze `src/gpu/wspolne.ts`. ZMIANA JEDNEJ WERSJI WYMAGA ZMIANY DRUGIEJ.
 * Ta jest zrodlem prawdy o zachowaniu (da sie ja zmierzyc bez GPU), tamta liczy to samo we
 * fragmencie i w liczniku pokrycia. Stale pochodza z tego pliku, wiec nie ma ich dwoch.
 *
 * `x`, `y` sa WZGLEDEM srodka postaci. Zwraca odleglosc ze znakiem: ujemna w srodku sylwetki.
 */
export function sdfChmurki(x: number, y: number): number {
  // Odleglosc do poziomego odcinka [-POLOWA_KAPSULY, +POLOWA_KAPSULY] na wysokosci 0.
  const wzdluz = Math.max(Math.abs(x) - POLOWA_KAPSULY, 0);
  const kapsula = Math.hypot(wzdluz, y) - PROMIEN_KAPSULY;
  return przetnijGladko(kapsula, y - SPOD, ZLACZENIE_SPODU);
}

/** 1 wewnatrz czola postaci, 0 poza. Wspolrzedne w przestrzeni MASKI (0..1), nie wzgledem srodka. */
export function czyCzolo(x: number, y: number): boolean {
  const py = y - SRODEK_CHMURKI.y;
  return py <= LINIA_CZOLA && sdfChmurki(x - SRODEK_CHMURKI.x, py) <= 0;
}

/** 1 wewnatrz calej sylwetki. Wspolrzedne w przestrzeni MASKI. */
export function czyChmurka(x: number, y: number): boolean {
  return sdfChmurki(x - SRODEK_CHMURKI.x, y - SRODEK_CHMURKI.y) <= 0;
}

/**
 * Prostokat obejmujacy punkty, dla ktorych `nalezy` zwraca prawde. LICZONY, nie wpisany —
 * ramka sylwetki i ramka czola sa wnioskiem z geometrii, a nie druga jej kopia.
 */
export function ramka(
  nalezy: (x: number, y: number) => boolean,
  gestosc = 512,
): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  let znaleziono = false;
  for (let j = 0; j < gestosc; j++) {
    const y = (j + 0.5) / gestosc;
    for (let i = 0; i < gestosc; i++) {
      const x = (i + 0.5) / gestosc;
      if (!nalezy(x, y)) continue;
      znaleziono = true;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  // ⛔ PUSTY OBSZAR RZUCA. Zwrocenie ramki zerowej daloby przyrzadowi prostokat, ktory wyglada
  // jak liczba i mierzy nic — ten sam wzorzec, przed ktorym broni sie `sredniaBarwa`.
  if (!znaleziono) throw new Error('ramka: predykat nie objal ani jednego punktu siatki');
  return { x0, y0, x1, y1 };
}

/**
 * Udzial powierzchni maski (0..1), na ktorej `nalezy` zwraca prawde.
 * ⚠️ TO JEST MIANOWNIK POKRYCIA. Domyslna gestosc rowna sie bokowi maski, wiec liczba wychodzi
 * z tej samej siatki, po ktorej liczy potok `Pokrycie` — nie z przyblizenia obok niej.
 */
export function udzial(nalezy: (x: number, y: number) => boolean, gestosc = 512): number {
  let ile = 0;
  for (let j = 0; j < gestosc; j++) {
    const y = (j + 0.5) / gestosc;
    for (let i = 0; i < gestosc; i++) {
      if (nalezy((i + 0.5) / gestosc, y)) ile++;
    }
  }
  return ile / (gestosc * gestosc);
}
