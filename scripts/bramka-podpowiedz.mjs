#!/usr/bin/env node
// BRAMKA: „PODPOWIEDZ GESTU JEST WIDOCZNA I WEDRUJE PO CZOLE".
//
// ⛔ PO CO ISTNIEJE. Podpowiedz to JEDYNY element sceny, o ktorym wiadomo, ze potrafi byc
// narysowany i niewidoczny naraz: jej pierwsza wersja dawala +0,0005 sredniej jasnosci pasma czola
// przy dryfie sceny 0,002 — czyli ponizej szumu. Zlapal to jednorazowy pomiar recznie, a
// `test/podpowiedz.test.ts` sprawdza WYLACZNIE warunek logiczny („kiedy pokazac"), nigdy piksele.
// Bez tej bramki dowolna zmiana we fragmencie moze wygasic ducha calkowicie, a wszystkie pozostale
// bramki zostana zielone.
//
// ⛔ DLACZEGO NIE SREDNIA JASNOSC PASMA CZOLA (miara z pierwszego pomiaru).
// Ta miara nagradza JASNOSC, a nie CZYTELNOSC GESTU — i ma dokladnie jedna galke, ktora ja
// domyka: `PODPOWIEDZ_ROZJASNIENIE`. Podniesienie jej z 1,26 na 1,6 poprawiloby wynik, nie
// poprawiajac niczego, o co chodzi. Gorzej: duch rozlany rownomiernie po calym czole — czyli
// plama, ktora NIE pokazuje zadnego gestu — podnosi srednia jasnosc pasma tak samo jak duch
// wedrujacy, wiec ta miara nie odroznia naprawy od podkrecenia ANI od zepsucia ksztaltu.
//
// ⛔ CO MIERZY TA BRAMKA: PRZECHYL PLAMY MIEDZY DWOMA KONCAMI TORU.
// Duch wedruje po sinusie: `x = PODPOWIEDZ_WEDROWKA * sin(czas * PODPOWIEDZ_TEMPO)`. Bramka
// probkuje DWA male prostokaty na koncach tego toru — lewy i prawy — i liczy ich znormalizowany
// kontrast `K = (L - P) / (L + P)`. Miara to WYCHYLENIE: `K(koniec lewy) - K(koniec prawy)`.
//
//   - duch rozlany rownomiernie po czole:            L = P w obu fazach → wychylenie 0 → CZERWONA
//   - duch jasny, ale stojacy w miejscu:             L = P w obu fazach → wychylenie 0 → CZERWONA
//   - duch wygaszony calkowicie:                     L = P w obu fazach → wychylenie 0 → CZERWONA
//   - duch wedrujacy, choc niezbyt jasny:            K zmienia ZNAK miedzy fazami → ZIELONA
//
// Normalizacja przez `(L + P)` sprawia dodatkowo, ze zmiana ekspozycji, palety albo winiety —
// wszystko, co podnosi CALE pasmo naraz — przesuwa te miare o zero.
//
// ⛔ FAZA ANIMACJI JEST PRZYPIETA, NIE WYLOSOWANA. Duch jest deterministyczna funkcja `czas`,
// wiec probka z przypadkowej chwili daje przypadkowa odpowiedz — pierwszy pomiar mial n = 3 pary
// z niekontrolowana faza i jedna para wypadla w szumie. `s.ustawCzas()` przypina pole `czas`
// uniformu na dwie wartosci policzone z wzoru toru (nie z palca): tam, gdzie `sin` ma -1 i +1.
//
// ⛔ KONTROLA NEGATYWNA JEST CZESCIA BRAMKI. Ramie kontrolne mierzy DOKLADNIE TO SAMO na scenie,
// z ktorej znika sam duch i nic wiecej: bramka maluje jedno pociagniecie (po czym `malowal` juz
// nigdy nie wraca do falszu, patrz `src/ui/podpowiedz.ts`) i CZYSCI mask, wiec zostaje ta sama
// scena bez kremu i bez podpowiedzi. Wychylenie ma tam byc zerowe. Gdyby nie bylo — mierzylibysmy
// cokolwiek innego niz plame, a przypiecie czasu nie dzialaloby tak, jak zaklada pomiar.
//
// Uzycie: node scripts/bramka-podpowiedz.mjs [--url <adres> | --podglad]
// Kody wyjscia: 0 = bramka zielona, 1 = bramka czerwona, 2 = blad pomiaru.

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adresDev, adresPodgladu } from './adres.mjs';

const KATALOG = dirname(fileURLToPath(import.meta.url));
const SONDA = join(KATALOG, 'sonda.mjs');

// --- LUSTRO STALYCH TORU ------------------------------------------------------------------------
// ⚠️ Odpowiedniki `SRODEK_CHMURKI` (`src/logika/chmurka.ts`) oraz `PODPOWIEDZ_Y`, `_WEDROWKA`,
// `_PROMIEN`, `_TEMPO` (`src/gpu/obraz.ts`). Przyrzad po stronie Node'a nie importuje kodu
// aplikacji, bo tamten ciagnie za soba WebGPU — tak samo jak `scripts/luminancja-png.mjs`.
// Zmiana toru w shaderze wymaga zmiany tutaj; bramka sama o tym powie, bo plamy nie znajdzie.
const SRODEK_X = 0.5;
const SRODEK_Y = 0.72;
const PODPOWIEDZ_Y = -0.106;
const PODPOWIEDZ_WEDROWKA = 0.30;
const PODPOWIEDZ_PROMIEN = 0.050;
const PODPOWIEDZ_TEMPO = 1.8;
/** Lustro `PROG_PODPOWIEDZI` z `src/ui/podpowiedz.ts` — po tylu sekundach bezruchu duch wchodzi. */
const PROG_PODPOWIEDZI = 2;

/** Wysokosc toru w przestrzeni maski. */
const TOR_Y = SRODEK_Y + PODPOWIEDZ_Y;
/**
 * Jak blisko konca toru probkujemy — udzial pelnej wedrowki.
 *
 * ⛔ NIE W SAMYCH ZWROTNICACH, I TO NIE JEST OSTROZNOSC NA WYROST. Dokladnie w punkcie zwrotu
 * `cos(czas * TEMPO)` wynosi zero, a shader bierze z niego `sign` — kierunek ogona ciagnacego sie
 * za palcem. Znak zera w `f32` rozstrzyga tam arytmetyka zaokraglenia, wiec ogon wyskakuje raz
 * w jedna, raz w druga strone i dokłada sie do jednego konca inaczej niz do drugiego. Zmierzone
 * 2026-08-27 na tej samej scenie: probkowanie w zwrotnicach daje kontrasty +0,0228 / -0,0264
 * (rozjechane o 0,0035), a probkowanie przy 0,95 toru, po tej samej stronie sinusa — +0,0265 /
 * -0,0255 (rozjechane o 0,0010) i wychylenie wieksze: 0,0520 zamiast 0,0492. Oba czasy maja
 * `cos > 0`, czyli palec w OBU probkach jedzie w te sama strone i ogon jest ich lustrem, a nie
 * przypadkiem. Strata na dlugosci toru jest zadna: 0,95 * 0,13 zamiast 0,13.
 */
const UDZIAL_TORU = 0.95;
/**
 * Czasy sceny, w ktorych plama stoi blisko koncow toru. POLICZONE Z WZORU, nie dobrane:
 * `sin(czas * TEMPO) = -UDZIAL_TORU` daje koniec lewy, `= +UDZIAL_TORU` koniec prawy, a wybor
 * galezi `arcus sinus` pilnuje, zeby w obu wypadkach `cos` byl dodatni.
 */
const CZAS_PRAWY = Math.asin(UDZIAL_TORU) / PODPOWIEDZ_TEMPO;
const CZAS_LEWY = (2 * Math.PI - Math.asin(UDZIAL_TORU)) / PODPOWIEDZ_TEMPO;

/**
 * ⛔ OKIENKO SIEDZI NA RDZENIU PLAMY, A NIE NA CALYM JEJ PROMIENIU. Krycie ducha jest pelne do
 * 0,35 promienia i gasnie dopiero przy promieniu, a w pionie tor dodatkowo wchodzi w zanik przy
 * linii oczu (`PODPOWIEDZ_ZANIK`) — okienko rozciagniete na caly promien usrednia rdzen razem
 * z wygaszonym brzegiem i z pasmem obok. Zmierzone 2026-08-27 na tej samej scenie: przy okienku
 * na caly promien (0,050 x 0,030) wychylenie wynosi 0,020, przy okienku na rdzen (0,030 x 0,020)
 * — 0,047, i dopiero wtedy oba konce toru daja kontrast o zblizonym module (+0,023 / -0,024)
 * zamiast rozjechanych +0,007 / -0,013. Ulamki ponizej sa wyrazone w promieniu plamy, wiec
 * zmiana `PODPOWIEDZ_PROMIEN` przesuwa okienko razem z ksztaltem.
 */
const POLOWA_SZEROKOSCI = PODPOWIEDZ_PROMIEN * 0.6;
const POLOWA_WYSOKOSCI = PODPOWIEDZ_PROMIEN * 0.4;

/** Prostokat okienka wokol punktu `x` na torze, w przestrzeni maski. */
const okienko = (x) => [
  x - POLOWA_SZEROKOSCI, TOR_Y - POLOWA_WYSOKOSCI,
  x + POLOWA_SZEROKOSCI, TOR_Y + POLOWA_WYSOKOSCI,
];

const LEWE = okienko(SRODEK_X - PODPOWIEDZ_WEDROWKA * UDZIAL_TORU);
const PRAWE = okienko(SRODEK_X + PODPOWIEDZ_WEDROWKA * UDZIAL_TORU);
/** Cale pasmo toru — miara PORZADKOWA (dawna „srednia jasnosc pasma"), nie kryterium bramki. */
const PASMO = [
  SRODEK_X - PODPOWIEDZ_WEDROWKA - PODPOWIEDZ_PROMIEN, TOR_Y - PODPOWIEDZ_PROMIEN,
  SRODEK_X + PODPOWIEDZ_WEDROWKA + PODPOWIEDZ_PROMIEN, TOR_Y + PODPOWIEDZ_PROMIEN,
];

// --- PROGI ---------------------------------------------------------------------------------------
/**
 * Minimalne wychylenie kontrastu miedzy koncami toru.
 *
 * ⚠️ PROG JEST UDZIALEM DZISIEJSZEJ CZYTELNOSCI, NIE LICZBA Z POWIETRZA. Zmierzone 2026-08-27 na
 * scenie z tego commita: duch daje 0,052, a ta sama scena bez ducha (ramie kontrolne) 0,0006 —
 * czyli okolo osiemdziesieciokrotnie mniej. Prog 0,020 znaczy „duchowi wolno stracic najwyzej
 * okolo 60% dzisiejszej czytelnosci gestu"; siedzi trzydziestokrotnie nad kontrola, wiec czerwien
 * nie ma jak byc przypadkiem, i wyraznie pod pomiarem, wiec zielen nie zalezy od drugiego miejsca
 * po przecinku.
 */
const MINIMALNE_WYCHYLENIE = 0.020;
/** Ile razy wychylenie z duchem musi przewyzszyc wychylenie kontroli (i szum powtorzenia). */
const KROTNOSC_WOBEC_KONTROLI = 5;

function argument(nazwa, domyslna) {
  const i = process.argv.indexOf(nazwa);
  return i >= 0 ? process.argv[i + 1] : domyslna;
}

const url = process.argv.includes('--podglad') ? adresPodgladu() : argument('--url', adresDev());

/**
 * ⚠️ OBA RAMIONA MAJA IDENTYCZNY ROZKLAD CZASU I IDENTYCZNA KOLEJNOSC PROBEK. Ramie kontrolne
 * dokłada wylacznie jedno pociagniecie z czyszczeniem — inaczej roznica moglaby byc artefaktem
 * harmonogramu, a nie brakiem ducha.
 *
 * ⚠️ POCIAGNIECIE KONTROLNE LEZY NA SWIECACEJ POWIERZCHNI (y 0,30), a nie na czole. Ma zrobic
 * jedna rzecz — ustawic `malowal`, ktore gasi podpowiedz na zawsze — i nie zostawic kremu tam,
 * gdzie mierzymy. `s.czysc()` i tak sciera mask, wiec przed pierwsza probka na scenie nie ma
 * ani jednego teksela warstwy.
 */
function skrypt(zDuchem) {
  return `(async () => {
    const s = window.__sonda;
    const spij = (ms) => new Promise((r) => setTimeout(r, ms));
    const L = ${JSON.stringify(LEWE)};
    const P = ${JSON.stringify(PRAWE)};
    const B = ${JSON.stringify(PASMO)};
    const PROG_PODPOWIEDZI = ${PROG_PODPOWIEDZI};

    s.czysc();
    s.ustawFaze(0);
    // ⛔ CZEKANIE DLUZSZE NIZ PROG_PODPOWIEDZI, I TO Z ZAPASEM. Duch wchodzi dopiero po progu
    // bezruchu, a czyszczenie sceny licznika bezruchu nie zeruje. Pierwsza wersja tej bramki
    // probkowala po 1 s i pierwsza probka wypadala SPRZED pojawienia sie ducha — rozrzut miedzy
    // powtorzeniami tej samej fazy urosl wtedy do 45% sygnalu i wygladal jak szum odczytu, choc
    // byl roznica dwoch scen. Mnoznik stoi tu, zeby zmiana progu w src/ui/podpowiedz.ts nie
    // wymagala przeliczania tej bramki w glowie.
    await spij(PROG_PODPOWIEDZI * 1000 * 1.5);
    if (!${zDuchem}) {
      s.pociagnij(0.20, 0.30, 0.80, 0.30, 20);
    }
    // ⚠️ TEN SAM ROZKLAD CZASU W OBU RAMIONACH — kontrola dokłada wylacznie pociagniecie
    // i starcie maski, a nie inna dlugosc oczekiwania.
    await spij(400);
    if (!${zDuchem}) s.czysc();
    await spij(600);

    // Dwa konce toru, KAZDY DWA RAZY — powtorzenie przy tej samej fazie daje szum odczytu,
    // czyli liczbe, wobec ktorej wychylenie ma sie czym wykazac.
    const plan = [['lewy', ${CZAS_LEWY}], ['prawy', ${CZAS_PRAWY}], ['lewy', ${CZAS_LEWY}], ['prawy', ${CZAS_PRAWY}]];
    const probki = [];
    for (const [koniec, czas] of plan) {
      s.ustawCzas(czas);
      // Siatka probek kadru wraca z GPU co kilkanascie klatek — czekamy dluzej niz jej okres,
      // zeby odczyt na pewno dotyczyl JUZ przypietej fazy, a nie poprzedniej.
      await spij(500);
      probki.push({
        koniec,
        czasZadany: czas,
        czasNaGpu: s.czas(),
        podpowiedz: s.podpowiedz(),
        lewe: s.jasnosc(L[0], L[1], L[2], L[3]),
        prawe: s.jasnosc(P[0], P[1], P[2], P[3]),
        pasmo: s.jasnosc(B[0], B[1], B[2], B[3]),
        pokrycie: s.pokrycie(),
      });
    }
    s.ustawCzas(null);
    s.ustawFaze(null);
    return probki;
  })()`;
}

function odpal(zDuchem) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [SONDA, '--url', url, '--skrypt', skrypt(zDuchem), '--czekaj', '15000'],
      { maxBuffer: 8 * 1024 * 1024 },
      (blad, stdout, stderr) => {
        if (blad) return reject(new Error(`sonda: ${stderr.trim() || blad.message}`));
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(new Error(`sonda nie oddala JSON-a: ${stdout.trim()}`));
        }
      },
    );
  });
}

/** Znormalizowany kontrast okienka lewego wobec prawego. Dodatni = plama stoi po lewej. */
const kontrast = (p) => (p.lewe - p.prawe) / (p.lewe + p.prawe);

function zwin(probki) {
  const lewe = probki.filter((p) => p.koniec === 'lewy');
  const prawe = probki.filter((p) => p.koniec === 'prawy');
  const kL = lewe.map(kontrast);
  const kP = prawe.map(kontrast);
  const sredniaZ = (t) => t.reduce((a, b) => a + b, 0) / t.length;
  const rozrzut = (t) => Math.max(...t) - Math.min(...t);
  return {
    kontrastLewy: sredniaZ(kL),
    kontrastPrawy: sredniaZ(kP),
    wychylenie: sredniaZ(kL) - sredniaZ(kP),
    // Rozrzut POWTORZEN tej samej fazy — szum odczytu, nie sygnal.
    szum: Math.max(rozrzut(kL), rozrzut(kP)),
    pasmo: sredniaZ(probki.map((p) => p.pasmo)),
    podpowiedz: probki.map((p) => p.podpowiedz),
    fazaPrzypieta: probki.every((p) => Math.abs(p.czasNaGpu - p.czasZadany) < 1e-6),
    pokrycie: Math.max(...probki.map((p) => p.pokrycie)),
  };
}

const duch = zwin(await odpal(true));
const kontrola = zwin(await odpal(false));

const odniesienie = Math.max(Math.abs(kontrola.wychylenie), duch.szum, kontrola.szum);
const zapas = odniesienie > 0 ? duch.wychylenie / odniesienie : Infinity;

const zarzuty = [];
if (!duch.fazaPrzypieta) zarzuty.push('przypiecie czasu nie doszlo do uniformu — pomiar dotyczy losowej fazy');
if (!kontrola.fazaPrzypieta) zarzuty.push('przypiecie czasu nie doszlo w ramieniu kontrolnym');
if (!duch.podpowiedz.every((w) => w === 1)) {
  zarzuty.push(`uniform \`podpowiedz\` nie byl jedynka w ramieniu z duchem: ${JSON.stringify(duch.podpowiedz)}`);
}
if (!kontrola.podpowiedz.every((w) => w === 0)) {
  zarzuty.push(`podpowiedz nie zgasla po pierwszym malowaniu: ${JSON.stringify(kontrola.podpowiedz)}`);
}
if (kontrola.pokrycie > 0.001) {
  zarzuty.push(`ramie kontrolne zostawilo krem na czole (pokrycie ${kontrola.pokrycie}) — mierzy warstwe, nie brak ducha`);
}
if (duch.wychylenie < MINIMALNE_WYCHYLENIE) {
  zarzuty.push(`wychylenie ${duch.wychylenie.toFixed(5)} ponizej progu ${MINIMALNE_WYCHYLENIE}`
    + ' — plama albo nie istnieje, albo nie wedruje po torze');
}
if (zapas < KROTNOSC_WOBEC_KONTROLI) {
  zarzuty.push(`zapas wobec kontroli i szumu ${zapas.toFixed(1)}x, wymagane ${KROTNOSC_WOBEC_KONTROLI}x`);
}

console.log(JSON.stringify({
  tor: { y: TOR_Y, okienkoLewe: LEWE, okienkoPrawe: PRAWE, pasmo: PASMO },
  fazy: { lewy: +CZAS_LEWY.toFixed(6), prawy: +CZAS_PRAWY.toFixed(6) },
  zDuchem: {
    kontrastLewy: +duch.kontrastLewy.toFixed(5),
    kontrastPrawy: +duch.kontrastPrawy.toFixed(5),
    wychylenie: +duch.wychylenie.toFixed(5),
    szumPowtorzenia: +duch.szum.toFixed(5),
    // ⚠️ MIARA PORZADKOWA, NIE KRYTERIUM: srednia jasnosc calego pasma czola. Stoi tu po to,
    // zeby bylo widac, ze rosnie i przy duchu wedrujacym, i przy stojacym — czyli ze bramka
    // oparta o nia przepuszczalaby zepsuty ksztalt.
    sredniaJasnoscPasma: +duch.pasmo.toFixed(5),
  },
  kontrolaNegatywna: {
    kontrastLewy: +kontrola.kontrastLewy.toFixed(5),
    kontrastPrawy: +kontrola.kontrastPrawy.toFixed(5),
    wychylenie: +kontrola.wychylenie.toFixed(5),
    szumPowtorzenia: +kontrola.szum.toFixed(5),
    sredniaJasnoscPasma: +kontrola.pasmo.toFixed(5),
    pokrycie: +kontrola.pokrycie.toFixed(5),
  },
  zapasWobecKontroli: zapas === Infinity ? 'nieskonczony' : +zapas.toFixed(1),
  progi: { minimalneWychylenie: MINIMALNE_WYCHYLENIE, krotnoscWobecKontroli: KROTNOSC_WOBEC_KONTROLI },
  zarzuty,
  werdykt: zarzuty.length === 0 ? 'ZIELONA' : 'CZERWONA',
}, null, 2));

process.exit(zarzuty.length === 0 ? 0 : 1);
