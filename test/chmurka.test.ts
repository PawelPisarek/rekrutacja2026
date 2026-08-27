import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  czyChmurka, LINIA_CZOLA, OKO, POLOWA_KAPSULY, PROMIEN_KAPSULY, ramka,
  sdfChmurki, SPOD, udzial, USTA,
} from '../src/logika/chmurka.ts';
import { odlegloscOdOdcinka } from '../src/logika/odcinek.ts';
import { PROMIEN_PEDZLA, promienSkuteczny, sladPedzla } from '../src/logika/pedzel.ts';
import { PROG_POKRYCIA } from '../src/logika/fazy.ts';
import { MASKA_ROZMIAR, POLE, PROG_POKRYCIA as PROG_TEKSELA, WYCINEK_SZKLA } from '../src/gpu/wspolne.ts';

/** Gorna krawedz sylwetki dla zadanego X (wzgledem srodka postaci); `null` poza sylwetka. */
function gornaKrawedz(x: number, krokow = 900): number | null {
  for (let j = 0; j < krokow; j++) {
    const y = -0.26 + (0.44 * (j + 0.5)) / krokow;
    if (sdfChmurki(x, y) <= 0) return y;
  }
  return null;
}

/** Dolna krawedz sylwetki dla zadanego X; `null` poza sylwetka. */
function dolnaKrawedz(x: number, krokow = 900): number | null {
  let ostatnia: number | null = null;
  for (let j = 0; j < krokow; j++) {
    const y = -0.26 + (0.44 * (j + 0.5)) / krokow;
    if (sdfChmurki(x, y) <= 0) ostatnia = y;
  }
  return ostatnia;
}

/** Obrys gornej krawedzi na calej szerokosci sylwetki. */
function obrysGorny(N = 240): { x: number; y: number }[] {
  const punkty: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const x = -0.45 + (0.9 * (i + 0.5)) / N;
    const y = gornaKrawedz(x);
    if (y !== null) punkty.push({ x, y });
  }
  return punkty;
}

test('sylwetka jest lezaca kapsula: wyraznie szersza niz wyzsza', () => {
  const r = ramka(czyChmurka);
  const szerokosc = r.x1 - r.x0;
  const wysokosc = r.y1 - r.y0;
  assert.ok(szerokosc > 0.6, `postac ma dominowac w kaflu, a ma szerokosc ${szerokosc}`);
  // ⚠️ PROG 2,2, A NIE 2,4 JAK PRZY POPRZEDNIM KSZTALCIE — i to nie jest poluzowanie kryterium,
  // tylko inne kryterium. Tamten prog pilnowal, zeby zlepek kol nie wyszedl przysadzisty; tutaj
  // wysokosc jest WNIOSKIEM z dwoch rzeczy, ktorych nie da sie sciac (czolo wyzsze od srednicy
  // pedzla + twarz pod nim), wiec „szersza niz wyzsza" jest wlasnoscia, o ktora chodzi.
  assert.ok(szerokosc / wysokosc > 2.2, `kapsula jest za wysoka: proporcja ${szerokosc / wysokosc}`);
});

test('gorna krawedz ma DOKLADNIE JEDEN garb — poprzednia miala trzy', () => {
  // ⛔ TO JEST TEST NA PRZYCZYNE REKLAMACJI. Poprzednia sylwetka miala trzy garby (duzy posrodku,
  // dwa nizsze po bokach) i wlasnie ten uklad budzil niezamierzone skojarzenia. Garb = lokalne
  // minimum Y
  // (os idzie w dol) o wynioslosci powyzej progu, garby blizsze niz 0,05 w poziomie licza sie jako
  // jeden — ten sam licznik, ktorym poprzednia wersja tego pliku DOWODZILA, ze garby sa trzy.
  // Kapsula ma plaski szczyt, wiec cale plateau schodzi do jednego garbu i nie ma miedzy czym
  // powstac wglebieniu.
  const punkty = obrysGorny();
  const garby: { x: number; wynioslosc: number }[] = [];
  for (let i = 1; i < punkty.length - 1; i++) {
    const y = punkty[i]!.y;
    if (!(y <= punkty[i - 1]!.y && y <= punkty[i + 1]!.y)) continue;
    let wLewo = y;
    let wPrawo = y;
    for (let j = i; j >= 0; j--) {
      if (punkty[j]!.y < y) break;
      wLewo = Math.max(wLewo, punkty[j]!.y);
    }
    for (let j = i; j < punkty.length; j++) {
      if (punkty[j]!.y < y) break;
      wPrawo = Math.max(wPrawo, punkty[j]!.y);
    }
    const wynioslosc = Math.min(wLewo, wPrawo) - y;
    if (wynioslosc >= 0.004) garby.push({ x: punkty[i]!.x, wynioslosc });
  }
  const scalone = garby.filter((g, i) => i === 0 || g.x - garby[i - 1]!.x > 0.05);
  assert.equal(
    scalone.length,
    1,
    `gorna krawedz ma ${scalone.length} garbow: ${JSON.stringify(scalone)}`,
  );
});

test('gorna krawedz nie zawraca — jeden szczyt, zadnego wglebienia', () => {
  // Druga miara tej samej wlasnosci, odporna na dobor progu wynioslosci: krawedz idzie w gore
  // (Y maleje) az do plaskiego szczytu i od niego wraca w dol — bez ani jednego zawrotu wiecej.
  const punkty = obrysGorny();
  let zmianyKierunku = 0;
  let poprzedni = 0;
  for (let i = 1; i < punkty.length; i++) {
    const roznica = punkty[i]!.y - punkty[i - 1]!.y;
    if (Math.abs(roznica) < 1e-5) continue;
    const kierunek = Math.sign(roznica);
    if (poprzedni !== 0 && kierunek !== poprzedni) zmianyKierunku++;
    poprzedni = kierunek;
  }
  assert.ok(zmianyKierunku <= 1, `obrys zawraca ${zmianyKierunku} razy, a kapsula ma jeden szczyt`);
});

test('gorna krawedz ma plaski odcinek — kapsula, a nie luk', () => {
  const wierzcholek = -PROMIEN_KAPSULY;
  // Nad odcinkiem kapsuly krawedz jest prosta; poza nim juz nie. Sprawdzamy oba zdania naraz.
  for (const x of [-0.2, -0.1, 0, 0.1, 0.2]) {
    const y = gornaKrawedz(x);
    assert.ok(y !== null && Math.abs(y - wierzcholek) < 0.002, `krawedz przy x=${x} to ${y}`);
  }
  const przyKoncu = gornaKrawedz(POLOWA_KAPSULY + PROMIEN_KAPSULY * 0.7);
  assert.ok(
    przyKoncu !== null && przyKoncu > wierzcholek + 0.02,
    `poza odcinkiem krawedz ma opadac, a jest na ${przyKoncu}`,
  );
});

test('spod jest plaski, bo jest odciety — a nie ustawiony ksztaltem', () => {
  const wysokosci: number[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = -0.30 + (0.60 * i) / 60;
    const y = dolnaKrawedz(x);
    if (y !== null) wysokosci.push(y);
  }
  const rozstep = Math.max(...wysokosci) - Math.min(...wysokosci);
  assert.ok(rozstep < 0.006, `spod faluje o ${rozstep}`);
  assert.ok(Math.abs(Math.max(...wysokosci) - SPOD) < 0.01, 'spod ma lezec na linii ciecia SPOD');
});

test('linia zaniku podpowiedzi lezy NAD oczami, wiec duch gestu nie zaslania miny', () => {
  // ⚠️ TEN TEST ZMIENIL PRZEDMIOT, A NIE TYLKO NAZWE. Do 2026-08-28 `LINIA_CZOLA` byla granica
  // OBSZARU LICZONEGO i test pytal, czy oko nie jest „czolem". Obszarem liczonym jest dzis cala
  // sylwetka (`czyChmurka`), a linia zostala przy jednej robocie: ponizej niej wygasza sie DUCH
  // PODPOWIEDZI (`naCzole` w `gpu/obraz.ts`). Warunek jest ten sam co przedtem — linia nad gorna
  // krawedzia oka — ale broni juz czego innego: tego, ze podpowiedz pokazywana graczowi, ktory
  // jeszcze nic nie namalowal, nie klada mu sie na oczach i ustach.
  const gornaKrawedzOka = OKO.y - OKO.r;
  assert.ok(
    LINIA_CZOLA < gornaKrawedzOka,
    `LINIA_CZOLA ${LINIA_CZOLA} musi lezec nad gorna krawedzia oka ${gornaKrawedzOka}`,
  );
  assert.ok(LINIA_CZOLA < USTA.y, 'linia zaniku podpowiedzi musi lezec nad ustami');
  // Duch ma miec gdzie sie zmiescic: pasmo od gornej krawedzi sylwetki do linii zaniku nie moze
  // byc puste, inaczej podpowiedz byla by wygaszona w calosci i test wyzej nie mowilby nic.
  assert.ok(
    -PROMIEN_KAPSULY < LINIA_CZOLA,
    'nad linia zaniku nie ma ani kawalka sylwetki — duch podpowiedzi nie mialby sie gdzie narysowac',
  );
});

test('cala twarz miesci sie pod linia czola, nad spodem i w obrebie kapsuly', () => {
  assert.ok(OKO.y + OKO.r < USTA.y - USTA.grubosc, 'oczy wchodza na usta');
  assert.ok(USTA.y + USTA.grubosc < SPOD, 'usta wychodza pod spod sylwetki');
  assert.ok(OKO.x + OKO.r < POLOWA_KAPSULY, 'oczy wychodza poza plaska czesc kapsuly');
});

test('obszar liczony jest WYZSZY od srednicy pedzla — inaczej jedno przeciagniecie domyka prog', () => {
  // ⛔ OBIE STRONY NIEROWNOSCI POCHODZA Z KODU. Do rundy naprawczej po recenzji zadania F stal tu
  // RECZNY LITERAL `0.110`, a `PROMIEN_PEDZLA` byl prywatna stala `gpu/scena.ts` — podniesienie
  // promienia nie ruszyloby tej asercji ani o milimetr, choc raport twierdzil, ze ja zlapie
  // (uwaga W1). Dzis srednica liczy sie z importowanej stalej.
  //
  // ⚠️ OBSZAREM LICZONYM JEST CALA SYLWETKA, wiec zapas urosl z 0,016 do 0,206. To jest warunek
  // KONIECZNY, nie wystarczajacy — wlasnosc „jeden przejazd nie domyka rundy" mierzy test nizej.
  const r = ramka(czyChmurka);
  const wysokoscObszaru = r.y1 - r.y0;
  const srednicaPedzla = PROMIEN_PEDZLA * 2;
  assert.ok(
    wysokoscObszaru > srednicaPedzla,
    `obszar liczony ma wysokosc ${wysokoscObszaru}, a srednica pedzla to ${srednicaPedzla}`,
  );
});

/**
 * ⛔ TO JEST TEST, KTORY MIERZY WLASNOSC ZADEKLAROWANA W `logika/fazy.ts`, A NIE SLABSZA OD NIEJ.
 *
 * `fazy.ts` deklaruje: „jeden przejazd NIE domyka rundy, i to jest wlasnosc GEOMETRII". Test
 * powyzej („obszar wyzszy od srednicy pedzla") tego NIE dowodzi — wyklucza jedynie pokrycie 100%,
 * a prog wynosi 0,55. Recenzja zadania F (uwaga W2) policzyla, ze przy poprzednim, waskim obszarze
 * jeden przejazd ulozony przy dolnej krawedzi pasma mogl dojsc do ~0,90 — i taka geometrie stary
 * test by przepuscil.
 *
 * Tutaj mierzy sie dokladnie te wielkosc, o ktorej mowi deklaracja: NAJWIEKSZY udzial obszaru
 * liczonego, jaki da sie zakryc JEDNYM poziomym pociagnieciem. Przebieg jest po wszystkich
 * wysokosciach ulozenia (krok = teksel maski), wiec bierze sie przypadek NAJKORZYSTNIEJSZY dla
 * gracza, a nie jeden wybrany. Wszystko po stronie prawej pochodzi z kodu: profil pedzla
 * z `logika/pedzel.ts`, prog teksela z `gpu/wspolne.ts`, prog rundy z `logika/fazy.ts`.
 *
 * ⛔ NIEZMIENNIK ROZSTRZYGNIETY SWIADOMIE 2026-08-28, A NIE ODZIEDZICZONY. Zadanie „maksymalna
 * wybaczliwosc" kazalo poszerzyc obszar liczony i obnizyc prog, wiec ten test musial dostac
 * odpowiedz, czy „trzeba rozsmarowac wiecej niz raz" nadal jest prawda. JEST, i to z wiekszym
 * zapasem niz przedtem: obszar urosl 2,67 raza (0,0855 → 0,2286 maski), wiec jeden przejazd
 * spadl z 0,744 na 0,299, a prog spadl tylko z 0,85 na 0,55. Stosunek „ile daje jeden ruch"
 * do progu poprawil sie z 0,88 na 0,54. Nie ma wiec czego naciagac ani usuwac — geometria sama
 * wymaga drugiego ruchu, a wybaczliwosc nie kosztowala tego niezmiennika nic.
 *
 * ⚠️ CZEGO TEN TEST NIE OBEJMUJE: pociagniec innych niz poziome (lukowatych, po skosie) i sumy
 * dwoch pociagniec zlozonych w jedno ciagle „machniecie". Poziome jest tym, ktore lezaca kapsule
 * zakrywa najefektywniej, a nakladanie sie kolejnych ruchow to juz drugi przejazd.
 */
test('jeden poziomy przejazd nie domyka progu pokrycia — przy ZADNYM ulozeniu', () => {
  const tekseleObszaru: { x: number; y: number }[] = [];
  for (let j = 0; j < MASKA_ROZMIAR; j++) {
    const y = (j + 0.5) / MASKA_ROZMIAR;
    for (let i = 0; i < MASKA_ROZMIAR; i++) {
      const x = (i + 0.5) / MASKA_ROZMIAR;
      if (czyChmurka(x, y)) tekseleObszaru.push({ x, y });
    }
  }
  assert.ok(tekseleObszaru.length > 0, 'zalozenie testu: obszar liczony musi miec jakiekolwiek teksele');

  const r = ramka(czyChmurka);
  // Zakres wysokosci ulozenia: caly pas plus promien pedzla po obu stronach, zeby zmiescily sie
  // takze ulozenia, przy ktorych smuga wystaje poza pasmo. Krok = teksel maski.
  const odY = r.y0 - PROMIEN_PEDZLA;
  const doY = r.y1 + PROMIEN_PEDZLA;
  let najlepsze = 0;
  let najlepszaWysokosc = odY;
  for (let k = 0; odY + k / MASKA_ROZMIAR <= doY; k++) {
    const y = odY + k / MASKA_ROZMIAR;
    let pokryte = 0;
    for (const teksel of tekseleObszaru) {
      // Pociagniecie przez CALA szerokosc kafla z zapasem — konce odcinka nie ograniczaja niczego.
      const odl = odlegloscOdOdcinka(teksel.x, teksel.y, -1, y, 2, y);
      if (sladPedzla(odl) > PROG_TEKSELA) pokryte++;
    }
    const udzialPokryty = pokryte / tekseleObszaru.length;
    if (udzialPokryty > najlepsze) {
      najlepsze = udzialPokryty;
      najlepszaWysokosc = y;
    }
  }

  assert.ok(
    najlepsze < PROG_POKRYCIA,
    `najkorzystniejszy jeden przejazd zakrywa ${najlepsze} obszaru liczonego `
    + `(na wysokosci ${najlepszaWysokosc}), `
    + `a prog rundy to ${PROG_POKRYCIA} — jeden ruch domykalby faze`,
  );
});

/**
 * ⛔ TEN TEST TRZYMA DECYZJE O WYBACZLIWOSCI, A NIE SAMA LICZBE.
 *
 * `PROG_POKRYCIA` jest wynikiem pomiaru gestow (`scripts/mierz-gesty.mjs`), ale sam pomiar zyje
 * w komentarzu i w raporcie — nic go nie pilnuje. Pilnuje go ta nierownosc, bo obie jej strony
 * licza sie TU I TERAZ z geometrii, ktora jest w kodzie:
 *
 *   jeden przejazd  <  PROG_POKRYCIA  <=  dwa przejazdy
 *
 * Lewa strona to „jeden ruch nie domyka rundy" (komunikat produktowy: filtr trzeba reaplikowac).
 * Prawa to „dwa ruchy juz wystarcza" — czyli wybaczliwosc: gracz, ktory po prostu rozsmarowuje
 * krem po postaci, domyka runde, zamiast szukac ukrytego pasa. Podniesienie progu powyzej dwoch
 * przejazdow albo zwezenie obszaru liczonego przewraca ten test — i o to chodzi.
 *
 * ⚠️ DRUGI PRZEJAZD DOBIERANY ZACHLANNIE, a nie przez przeszukanie wszystkich par: zachlanny
 * wynik jest DOLNYM oszacowaniem najlepszej pary (zmierzone: 0,576 zachlannie wobec 0,586 przy
 * pelnym przeszukaniu), a nierownosc idzie w strone, w ktora oszacowanie od dolu jest ostrzejsze.
 */
test('prog rundy lezy MIEDZY jednym przejazdem a dwoma — obie liczby policzone z geometrii', () => {
  const teksele: { x: number; y: number }[] = [];
  for (let j = 0; j < MASKA_ROZMIAR; j++) {
    const y = (j + 0.5) / MASKA_ROZMIAR;
    for (let i = 0; i < MASKA_ROZMIAR; i++) {
      const x = (i + 0.5) / MASKA_ROZMIAR;
      if (czyChmurka(x, y)) teksele.push({ x, y });
    }
  }
  const r = ramka(czyChmurka);
  const odY = r.y0 - PROMIEN_PEDZLA;
  const doY = r.y1 + PROMIEN_PEDZLA;
  // Krok czterech tekseli — pociagniecia lezace blizej siebie niz to nie roznia sie mierzalnie,
  // a pelny krok tekselowy podwaja czas testu bez zmiany wyniku na trzecim miejscu po przecinku.
  const KROK = 4 / MASKA_ROZMIAR;

  const trafia = (teksel: { x: number; y: number }, y: number): boolean =>
    sladPedzla(odlegloscOdOdcinka(teksel.x, teksel.y, -1, y, 2, y)) > PROG_TEKSELA;

  let jeden = 0;
  let pierwsza = odY;
  for (let y = odY; y <= doY; y += KROK) {
    let ile = 0;
    for (const teksel of teksele) if (trafia(teksel, y)) ile++;
    if (ile / teksele.length > jeden) {
      jeden = ile / teksele.length;
      pierwsza = y;
    }
  }
  const pokryteJednym = teksele.map((teksel) => trafia(teksel, pierwsza));
  let dwa = jeden;
  for (let y = odY; y <= doY; y += KROK) {
    let ile = 0;
    for (let i = 0; i < teksele.length; i++) if (pokryteJednym[i] || trafia(teksele[i]!, y)) ile++;
    if (ile / teksele.length > dwa) dwa = ile / teksele.length;
  }

  assert.ok(
    jeden < PROG_POKRYCIA,
    `jeden przejazd zakrywa ${jeden} obszaru, a prog rundy to ${PROG_POKRYCIA} — jeden ruch domykalby runde`,
  );
  assert.ok(
    dwa >= PROG_POKRYCIA,
    `dwa przejazdy zakrywaja tylko ${dwa} obszaru, a prog rundy to ${PROG_POKRYCIA} `
    + '— gra wymaga wiecej niz dwoch ruchow, czyli jest mniej wybaczliwa, niz deklaruje',
  );
});

test('promien SKUTECZNY pedzla jest mniejszy od nominalnego, bo brzeg odcisku jest wygaszony', () => {
  // ⚠️ TA LICZBA JEST POWODEM, DLA KTOREGO RECENZENT PRZESZACOWAL jeden przejazd. Do pokrycia
  // liczy sie teksel powyzej `PROG_TEKSELA`, a nie kazdy dotkniety — smuga jest wiec WEZSZA niz
  // srednica pedzla i test wyzej mierzy wlasnie te, wezsza.
  const skuteczny = promienSkuteczny(PROG_TEKSELA);
  assert.ok(skuteczny > 0, 'promien skuteczny musi byc dodatni, inaczej pedzel nic nie kladzie');
  assert.ok(
    skuteczny < PROMIEN_PEDZLA,
    `promien skuteczny ${skuteczny} nie moze dorownac nominalnemu ${PROMIEN_PEDZLA}`,
  );
  assert.ok(
    sladPedzla(skuteczny * 0.999) > PROG_TEKSELA && sladPedzla(skuteczny * 1.001) < PROG_TEKSELA,
    'promien skuteczny ma byc dokladnie granica progu teksela',
  );
});

test('mianownik pokrycia — udzial sylwetki w masce — jest znany co do liczby', () => {
  const udzialObszaru = udzial(czyChmurka);
  // ⚠️ TO JEST MIANOWNIK, WZGLEDEM KTOREGO LICZY SIE `PROG_POKRYCIA`. Zmienial sie juz trzy razy:
  // prostokat 0,08..0,92 na obu osiach (70,6% maski), czolo starej sylwetki (2,38%), czolo kapsuly
  // (8,55%) i — od 2026-08-28 — CALA kapsula. Kazda taka zmiana przesuwa prog, wiec prog trzeba
  // PRZELICZYC POMIAREM (`scripts/mierz-gesty.mjs`), a nie przepisac; ten test jest miejscem,
  // w ktorym zmiana daje o sobie znac. Zmierzone 2026-08-28: 0,2286.
  assert.ok(
    udzialObszaru > 0.224 && udzialObszaru < 0.234,
    `udzial sylwetki w masce wyszedl ${udzialObszaru}, a prog pokrycia byl mierzony przy 0,2286`,
  );
});

test('cala postac miesci sie w polu do zabawy i nie wchodzi w wycinek bramki blasku', () => {
  const r = ramka(czyChmurka);
  assert.ok(r.x0 > POLE.x0 && r.x1 < POLE.x1, 'postac wystaje poza pole w poziomie');
  assert.ok(r.y0 > POLE.y0 && r.y1 < POLE.y1, 'postac wystaje poza pole w pionie');
  // ⛔ BRAMKA BLASKU MIERZY SAMA SWIECACA POWIERZCHNIE. Gdyby sylwetka weszla w `WYCINEK_SZKLA`,
  // bramka znowu usredmialaby dwa przeciwne efekty — dokladnie ta usterka, przez ktora poprzednia
  // wersja dawala sie domknac rozjasnieniem czegos bez zwiazku z mechanika.
  assert.ok(
    r.y0 > WYCINEK_SZKLA.y1 + 0.05,
    `gorna krawedz postaci (${r.y0}) podchodzi pod wycinek bramki (${WYCINEK_SZKLA.y1})`,
  );
});

test('postac siedzi w DOLNEJ czesci kafla, nie posrodku', () => {
  const r = ramka(czyChmurka);
  const srodekPionowy = (r.y0 + r.y1) / 2;
  assert.ok(srodekPionowy > 0.62, `srodek postaci wypadl na ${srodekPionowy}, a ma byc nisko`);
});
