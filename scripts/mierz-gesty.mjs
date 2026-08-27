#!/usr/bin/env node
// PRZYRZAD POMIAROWY: „ILE POKRYCIA DAJE PRAWDZIWY GEST".
//
// ⛔ TO NIE JEST BRAMKA. Nic nie orzeka i nic nie przewraca — wypisuje liczby, z ktorych dobiera
// sie `PROG_POKRYCIA` (`src/logika/fazy.ts`). Powstal, bo prog byl dotad mierzony WYLACZNIE
// gestem, ktory celuje w obszar liczony („dwa przejazdy przez pas czola"), a uzytkownik zglosil,
// ze na prawdziwym urzadzeniu „mazę parę sekund i nie zmienia sie na noc". Roznica miedzy tymi
// dwoma gestami jest cala usterka, wiec przyrzad mierzy OBA naraz.
//
// ⚠️ FAZA JEST PRZYPIETA (`ustawFaze(0)`) NA CZAS POMIARU. Bez tego maszyna faz przelaczylaby
// scene w `dzien-karta` w srodku najlepszego gestu i dalsze probki dotyczylyby zamarlej sceny
// (poza faza `-gra` scena stoi — patrz `gpu/scena.ts`), czyli pomiar mierzylby wlasny skutek.
// Przypiecie zatrzymuje WYLACZNIE maszyne faz; malowanie, wysychanie i licznik pokrycia jada
// dokladnie tak jak u gracza.
//
// Uzycie: node scripts/mierz-gesty.mjs [--url <adres>] [--podglad] [--zrzut-po <gest>=<plik.png>]
//        node scripts/mierz-gesty.mjs --lancuch [--gest <nazwa>]
// Wypisuje JSON: dla kazdego gestu szczyt pokrycia i najdluzsze nieprzerwane okno nad kazdym
// z progow kandydujacych — bo o domknieciu rundy decyduje nie szczyt, tylko czas nad progiem
// (`CZAS_POTWIERDZENIA`).

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adresDev, adresPodgladu } from './adres.mjs';

const KATALOG = dirname(fileURLToPath(import.meta.url));
const SONDA = join(KATALOG, 'sonda.mjs');

function argument(nazwa, domyslna) {
  const i = process.argv.indexOf(nazwa);
  return i >= 0 ? process.argv[i + 1] : domyslna;
}

const url = process.argv.includes('--podglad') ? adresPodgladu() : argument('--url', adresDev());
const lancuch = process.argv.includes('--lancuch');
const gestLancucha = argument('--gest', 'bazgranie-maskotka');
const zrzutPo = argument('--zrzut-po', undefined); // format: <gest>=<plik.png>
const [gestDoZrzutu, plikZrzutu] = zrzutPo ? zrzutPo.split('=') : [undefined, undefined];

/**
 * ⛔ GESTY SA OPISANE WSPOLRZEDNYMI, A NIE NAZWANE Z PAMIECI. Wszystkie w przestrzeni MASKI
 * (0..1, y w dol) — tej samej, w ktorej `Wskaznik.pociagnij` przyjmuje punkty.
 *
 * Cztery pierwsze odtwarzaja pomiar z 2026-08-27, przez ktory zglosil sie uzytkownik; piaty
 * („bazgranie po samej maskotce") jest tym, ktorego brakowalo: gestem czlowieka, ktory widzi
 * maskotke i smaruje PO NIEJ, nie po kaflu.
 */
const GESTY = {
  'poziom-srodek': [[0.05, 0.50, 0.95, 0.50]],
  krzyz: [[0.05, 0.50, 0.95, 0.50], [0.50, 0.05, 0.50, 0.95]],
  'bazgranie-kafel': [
    [0.08, 0.20, 0.92, 0.20], [0.92, 0.32, 0.08, 0.32], [0.08, 0.44, 0.92, 0.44],
    [0.92, 0.56, 0.08, 0.56], [0.08, 0.68, 0.92, 0.68], [0.92, 0.80, 0.08, 0.80],
  ],
  'pas-czola': [[0.12, 0.585, 0.88, 0.585], [0.12, 0.645, 0.88, 0.645]],
  'bazgranie-maskotka': [
    [0.12, 0.58, 0.88, 0.58], [0.88, 0.64, 0.12, 0.64], [0.12, 0.70, 0.88, 0.70],
    [0.88, 0.76, 0.12, 0.76], [0.12, 0.82, 0.88, 0.82],
  ],
};

/** Progi, dla ktorych przyrzad liczy najdluzsze nieprzerwane okno „nad progiem". */
const PROGI = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.85];

/** Ile sekund przyrzad probkuje pokrycie PO zlozeniu gestu — musi objac cale okno potwierdzenia. */
const SEKUND_PO_GESCIE = 5;

const SKRYPT = `(async () => {
  const s = window.__sonda;
  const klatka = () => new Promise((r) => requestAnimationFrame(() => r()));
  const GESTY = ${JSON.stringify(GESTY)};
  const PROGI = ${JSON.stringify(PROGI)};
  const wynik = {};
  for (const [nazwa, pociagniecia] of Object.entries(GESTY)) {
    s.ustawFaze(0);
    s.czysc();
    // Kilka klatek na wyzerowanie licznika po czyszczeniu — inaczej pierwsza probka niesie
    // pokrycie z poprzedniego gestu i szczyt wychodzi zawyzony.
    for (let i = 0; i < 12; i++) await klatka();
    const start = performance.now();
    const slad = [];
    // Jedno pociagniecie na klatke — tak samo, jak robi to bramka faz. Miedzy nimi mija
    // prawdziwa klatka, wiec wysychanie tyka tak jak u gracza.
    for (const [x0, y0, x1, y1] of pociagniecia) {
      s.pociagnij(x0, y0, x1, y1, 30);
      await klatka();
      slad.push({ t: (performance.now() - start) / 1000, p: s.pokrycie() });
    }
    const doKiedy = performance.now() + ${SEKUND_PO_GESCIE} * 1000;
    while (performance.now() < doKiedy) {
      await klatka();
      slad.push({ t: (performance.now() - start) / 1000, p: s.pokrycie() });
    }
    let szczyt = 0;
    for (const q of slad) if (q.p > szczyt) szczyt = q.p;
    const okna = {};
    for (const prog of PROGI) {
      let najdluzsze = 0, od = null;
      for (const q of slad) {
        if (q.p >= prog) { if (od === null) od = q.t; najdluzsze = Math.max(najdluzsze, q.t - od); }
        else od = null;
      }
      okna[prog] = Number(najdluzsze.toFixed(2));
    }
    wynik[nazwa] = { szczyt: Number(szczyt.toFixed(3)), oknoNadProgiem: okna, probek: slad.length };
    ${gestDoZrzutu ? `if (nazwa === ${JSON.stringify(gestDoZrzutu)}) { window.__stopKlatka = true; }` : ''}
  }
  ${gestDoZrzutu ? `
  // Zrzut ma pokazac stan PO tym gescie — wiec odtwarzamy go jeszcze raz i zostawiamy na ekranie.
  s.ustawFaze(0);
  s.czysc();
  for (let i = 0; i < 12; i++) await klatka();
  for (const [x0, y0, x1, y1] of GESTY[${JSON.stringify(gestDoZrzutu)}]) { s.pociagnij(x0, y0, x1, y1, 30); await klatka(); }
  for (let i = 0; i < 6; i++) await klatka();
  wynik.__zrzutPo = { gest: ${JSON.stringify(gestDoZrzutu)}, pokrycie: Number(s.pokrycie().toFixed(3)) };
  ` : ''}
  return wynik;
})()`;

/**
 * ⛔ LANCUCH MIERZY ZEGAR SCIENNY, A NIE PRZEWIJANIE. `s.przewin` (uzywany przez bramke faz)
 * dopycha maszyne faz na sucho — swietny do sprawdzenia KOLEJNOSCI, bezuzyteczny do pytania
 * „ile gracz czeka". Ten pomiar niczego nie przewija: maluje raz i patrzy na `performance.now()`.
 */
const SKRYPT_LANCUCHA = `(async () => {
  const s = window.__sonda;
  const klatka = () => new Promise((r) => requestAnimationFrame(() => r()));
  const GESTY = ${JSON.stringify(GESTY)};
  s.ustawFaze(null);
  s.czysc();
  for (let i = 0; i < 12; i++) await klatka();
  const start = performance.now();
  for (const [x0, y0, x1, y1] of GESTY[${JSON.stringify(gestLancucha)}]) { s.pociagnij(x0, y0, x1, y1, 30); await klatka(); }
  const koniecGestu = (performance.now() - start) / 1000;
  const wejscia = {};
  const LIMIT = performance.now() + 30000;
  while (performance.now() < LIMIT) {
    await klatka();
    const f = s.faza();
    if (wejscia[f] === undefined) wejscia[f] = Number(((performance.now() - start) / 1000).toFixed(2));
    if (f === 'noc-karta') break;
  }
  return { gest: ${JSON.stringify(gestLancucha)}, koniecGestu: Number(koniecGestu.toFixed(2)), wejscia };
})()`;

const argumenty = [SONDA, '--url', url, '--skrypt', lancuch ? SKRYPT_LANCUCHA : SKRYPT, '--czekaj', '15000'];
if (plikZrzutu) argumenty.push('--zrzut', plikZrzutu, '--zrzut-wycinek', '#kafel');

const wynik = await new Promise((resolve, reject) => {
  execFile(process.execPath, argumenty, { maxBuffer: 8 * 1024 * 1024 }, (blad, stdout, stderr) => {
    if (blad) return reject(new Error(`sonda: ${stderr.trim() || blad.message}`));
    try {
      resolve(JSON.parse(stdout.trim()));
    } catch {
      reject(new Error(`sonda nie oddala JSON-a: ${stdout.trim()}`));
    }
  });
});

console.log(JSON.stringify(wynik, null, 2));
