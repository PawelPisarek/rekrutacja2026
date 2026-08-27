#!/usr/bin/env node
// PRZYRZAD POMIAROWY: „PO ILU SEKUNDACH WARSTWA SCHODZI".
//
// ⛔ TO NIE JEST BRAMKA — nie ma progu i nie konczy sie czerwienia. Odpowiada na jedno pytanie:
// jak POKRYCIE zmienia sie w czasie po jednym nalozeniu kremu, bez domalowywania. Z tej krzywej
// bierze sie okno bramki „po kilku sekundach bez malowania pokrycie SPADA"
// (`docs/plan-wdrozenia.md`, zadanie B, krok 6, asercja 2) — zamiast przepisywac liczbe policzona
// dla poprzednich `STALE_WYSYCHANIA`.
//
// ⚠️ FAZA JEST PRZYPIETA (`ustawFaze(0)`), CO ZATRZYMUJE MASZYNE FAZ. Bez tego pomiar w trybie
// `postac` (pokrycie dochodzi do 1,0) przelaczylby sie po chwili w `dzien-karta`, a po dwoch
// dalszych w `zachod`, ktory CZYSCI maske — i „spadek pokrycia do zera" bylby wyczyszczeniem
// sceny, nie wysychaniem. Wysychanie jedzie z `dt` petli klatki, wiec przypiecie fazy go nie tyka.
//
// ⚠️ PROFIL SCIAGANY JEST W CHWILI POLOWY POKRYCIA, nie na koncu serii. Na koncu warstwy juz nie
// ma, wiec miary pekania (liczba przejsc „warstwa ↔ goly ekran", najwiekszy skok miedzy sasiednimi
// tekselami) mierzylyby pusty ekran i wychodzilyby zerowe niezaleznie od tego, czy krem pekal.
//
// Uzycie: node scripts/mierz-schniecie.mjs [--url <adres> | --podglad] [--tryb skos|postac] [--limit <ms>]
// Kody wyjscia: 0 = pomiar wykonany, 2 = blad pomiaru.

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
/**
 * `skos` — DOKLADNIE to pociagniecie, ktorego uzywa asercja 2 z planu wdrozenia (przekatna przez
 * kadr, przecinajaca postac waskim pasmem). `postac` — piec przejazdow w poprzek calej sylwetki,
 * czyli ruch gracza domykajacy runde; pokrycie startuje wtedy blisko 1,0, wiec krzywa jest dluzsza.
 *
 * ⚠️ TRYB `czolo` ZNIKNAL RAZEM Z MIANOWNIKIEM. Dwa przejazdy przez pas czola daja dzis 0,414
 * pokrycia, a nie 1,0 — krzywa schniecia zaczynalaby sie od polowy i nie mowilaby nic o tym,
 * jak dlugo trzyma sie PELNA warstwa.
 */
const tryb = argument('--tryb', 'skos');
const limit = Number(argument('--limit', '30000'));

/** Odstep miedzy odczytami pokrycia. Licznik wraca z GPU co kilka klatek, drobniej nie ma sensu. */
const OKRES_PROBKI = 100;

const POCIAGNIECIA = {
  skos: '[[0.25, 0.2, 0.75, 0.8, 20]]',
  // Te same wspolrzedne, co w `scripts/bramka-fazy.mjs` — cala sylwetka, x 0,110..0,890,
  // y 0,552..0,868.
  postac: '[[0.12, 0.58, 0.88, 0.58, 30], [0.88, 0.64, 0.12, 0.64, 30], [0.12, 0.70, 0.88, 0.70, 30], [0.88, 0.76, 0.12, 0.76, 30], [0.12, 0.82, 0.88, 0.82, 30]]',
};
const OSIE = {
  skos: '[0.25, 0.2, 0.75, 0.8]',
  postac: '[0.12, 0.70, 0.88, 0.70]',
};
if (!POCIAGNIECIA[tryb]) {
  console.error(`--tryb ma byc "skos" albo "postac", jest "${tryb}"`);
  process.exit(2);
}

const SKRYPT = `(async () => {
  const s = window.__sonda;
  const spij = (ms) => new Promise((r) => setTimeout(r, ms));
  const os = ${OSIE[tryb]};
  s.czysc();
  s.ustawFaze(0);
  await spij(300);
  for (const [x0, y0, x1, y1, k] of ${POCIAGNIECIA[tryb]}) s.pociagnij(x0, y0, x1, y1, k);
  await spij(400);

  const start = performance.now();
  const zaraz = s.pokrycie();
  const seria = [{ ms: 0, pokrycie: zaraz }];
  let profil = null;
  let profilMs = null;
  while (performance.now() - start < ${limit}) {
    await spij(${OKRES_PROBKI});
    const teraz = { ms: Math.round(performance.now() - start), pokrycie: s.pokrycie() };
    seria.push(teraz);
    if (profil === null && teraz.pokrycie < zaraz / 2) {
      profilMs = teraz.ms;
      profil = (await s.profil(os[0], os[1], os[2], os[3])).map((p) => p.grubosc);
    }
    if (teraz.pokrycie === 0) break;
  }
  s.ustawFaze(null);
  return { zaraz, seria, profil, profilMs };
})()`;

const wynik = await new Promise((resolve, reject) => {
  const argumenty = [SONDA, '--url', url, '--skrypt', SKRYPT, '--czekaj', String(limit + 15000)];
  execFile(process.execPath, argumenty, { maxBuffer: 16 * 1024 * 1024 }, (blad, stdout, stderr) => {
    if (blad) return reject(new Error(`sonda: ${stderr.trim() || blad.message}`));
    try {
      resolve(JSON.parse(stdout.trim()));
    } catch {
      reject(new Error(`sonda nie oddala JSON-a: ${stdout.trim()}`));
    }
  });
});

/** Pierwsza chwila, w ktorej pokrycie spelnia warunek; `null`, gdy nie spelnilo go do konca serii. */
const pierwszaChwila = (warunek) => {
  const trafienie = wynik.seria.find((p) => warunek(p.pokrycie));
  return trafienie ? trafienie.ms / 1000 : null;
};

const polowa = wynik.zaraz / 2;
const czasPolowy = pierwszaChwila((p) => p < polowa);
const czasZera = pierwszaChwila((p) => p === 0);

// Miary PEKANIA (lustro pomiaru z zadania B): ile razy profil przechodzi miedzy „jest warstwa"
// a „goly ekran" i jaki jest najwiekszy skok miedzy sasiednimi tekselami.
const g = wynik.profil ?? [];
let przejscia = 0;
let maxSkok = 0;
for (let i = 1; i < g.length; i++) {
  if ((g[i - 1] === 0) !== (g[i] === 0)) przejscia++;
  maxSkok = Math.max(maxSkok, Math.abs(g[i] - g[i - 1]));
}

console.log(JSON.stringify({
  tryb,
  pokrycieZaraz: +wynik.zaraz.toFixed(6),
  polowaPokrycia: +polowa.toFixed(6),
  czasDoPolowy_s: czasPolowy,
  czasDoZera_s: czasZera,
  ostatniaProbka: wynik.seria[wynik.seria.length - 1],
  probek: wynik.seria.length,
  profil: g.length === 0 ? null : {
    wChwili_s: wynik.profilMs / 1000,
    probek: g.length,
    przejscia,
    maxSkok: +maxSkok.toFixed(4),
    udzialZer: +(g.filter((w) => w === 0).length / g.length).toFixed(3),
  },
  seria: wynik.seria,
}, null, 2));
