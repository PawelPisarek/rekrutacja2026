#!/usr/bin/env node
// PRZYRZAD POMIAROWY: srednia luminancja prostokata w zrzucie PNG.
//
// Po co, skoro strona ma juz hak `__sonda.jasnosc()`: tamten liczy TE SAMA funkcje sceny co
// fragment, ale na potoku obliczeniowym — wiec z definicji NIE WIDZI, czy potok renderujacy
// w ogole rysuje. Ten przyrzad mierzy piksele, ktore naprawde poszly na ekran. Dwie miary
// zawodza z roznych powodow i dopiero razem cos znacza.
//
// Uzycie:
//   node scripts/luminancja-png.mjs <plik.png> [x0 y0 x1 y1]
// Prostokat podaje sie w PRZESTRZENI MASKI (0..1); domyslnie sam swiecacy wycinek. Przeliczenie
// na piksele idzie tym samym mapowaniem „contain", co `src/logika/mapowanie.ts`.

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// ⚠️ LUSTRO `WYCINEK_SZKLA` ze `src/gpu/wspolne.ts`. Zmiana tam wymaga zmiany tutaj — ten skrypt
// jest przyrzadem po stronie Node'a i nie importuje kodu aplikacji (bo tamten ciagnie za soba
// WebGPU). ⚠️ Stala `WROG` stad wypadla razem z prostokatem o tej nazwie: mianownikiem pokrycia
// jest teraz sylwetka chmurki, a nie prostokat na caly kafel.
/** Wycinek samego swiecacego pola — lustro `WYCINEK_SZKLA`, domyslny prostokat bramki blasku. */
const SZKLO = { x0: 0.18, x1: 0.82, y0: 0.16, y1: 0.42 };

/** Dekoder PNG: 8 bitow na kanal, bez przeplotu — dokladnie to, co oddaje Page.captureScreenshot. */
function czytajPng(sciezka) {
  const bajty = readFileSync(sciezka);
  if (bajty.readUInt32BE(0) !== 0x89504e47) throw new Error('to nie jest PNG');
  let i = 8;
  let szer = 0;
  let wys = 0;
  let kanalow = 0;
  const kawalkiDanych = [];
  while (i < bajty.length) {
    const dlugosc = bajty.readUInt32BE(i);
    const typ = bajty.toString('ascii', i + 4, i + 8);
    const tresc = bajty.subarray(i + 8, i + 8 + dlugosc);
    if (typ === 'IHDR') {
      szer = tresc.readUInt32BE(0);
      wys = tresc.readUInt32BE(4);
      const glebia = tresc[8];
      const typKoloru = tresc[9];
      const przeplot = tresc[12];
      if (glebia !== 8) throw new Error(`obslugiwane tylko 8 bitow na kanal, jest ${glebia}`);
      if (przeplot !== 0) throw new Error('przeplot Adam7 nieobslugiwany');
      if (typKoloru === 2) kanalow = 3;
      else if (typKoloru === 6) kanalow = 4;
      else throw new Error(`nieobslugiwany typ koloru ${typKoloru}`);
    } else if (typ === 'IDAT') {
      kawalkiDanych.push(tresc);
    } else if (typ === 'IEND') {
      break;
    }
    i += 12 + dlugosc;
  }
  const surowe = inflateSync(Buffer.concat(kawalkiDanych));
  const naWiersz = szer * kanalow;
  const piksele = Buffer.alloc(wys * naWiersz);
  for (let y = 0; y < wys; y++) {
    const filtr = surowe[y * (naWiersz + 1)];
    const wiersz = surowe.subarray(y * (naWiersz + 1) + 1, (y + 1) * (naWiersz + 1));
    for (let x = 0; x < naWiersz; x++) {
      const a = x >= kanalow ? piksele[y * naWiersz + x - kanalow] : 0;
      const b = y > 0 ? piksele[(y - 1) * naWiersz + x] : 0;
      const c = x >= kanalow && y > 0 ? piksele[(y - 1) * naWiersz + x - kanalow] : 0;
      let wartosc = wiersz[x];
      if (filtr === 1) wartosc += a;
      else if (filtr === 2) wartosc += b;
      else if (filtr === 3) wartosc += (a + b) >> 1;
      else if (filtr === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        wartosc += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filtr !== 0) throw new Error(`nieznany filtr ${filtr} w wierszu ${y}`);
      piksele[y * naWiersz + x] = wartosc & 0xff;
    }
  }
  return { szer, wys, kanalow, piksele };
}

/** Lustro `maskaNaEkran` z `src/logika/mapowanie.ts` — mapowanie „contain". */
function maskaNaEkran(x, y, proporcja) {
  const sx = Math.max(proporcja, 1);
  const sy = Math.max(1 / proporcja, 1);
  return [(x - 0.5) / sx + 0.5, (y - 0.5) / sy + 0.5];
}

const [sciezka, ...reszta] = process.argv.slice(2);
if (!sciezka) {
  console.error('uzycie: node scripts/luminancja-png.mjs <plik.png> [x0 y0 x1 y1]');
  process.exit(2);
}
// ⚠️ DOMYSLNY PROSTOKAT TO SZKLO, NIE CALE POLE. Bramka mierzy sam swiecacy wycinek (zadanie
// C2), a ten skrypt jest jej niezalezna kontrola — musi mierzyc to samo, inaczej porownanie
// dwoch miar niczego nie dowodzi.
const [x0, y0, x1, y1] = reszta.length === 4 ? reszta.map(Number) : [SZKLO.x0, SZKLO.y0, SZKLO.x1, SZKLO.y1];

const obraz = czytajPng(sciezka);
const proporcja = obraz.szer / obraz.wys;
const [ex0, ey0] = maskaNaEkran(x0, y0, proporcja);
const [ex1, ey1] = maskaNaEkran(x1, y1, proporcja);
const px0 = Math.max(0, Math.floor(ex0 * obraz.szer));
const py0 = Math.max(0, Math.floor(ey0 * obraz.wys));
const px1 = Math.min(obraz.szer, Math.ceil(ex1 * obraz.szer));
const py1 = Math.min(obraz.wys, Math.ceil(ey1 * obraz.wys));

let sr = 0;
let sg = 0;
let sb = 0;
let ile = 0;
for (let y = py0; y < py1; y++) {
  for (let x = px0; x < px1; x++) {
    const k = y * obraz.szer * obraz.kanalow + x * obraz.kanalow;
    sr += obraz.piksele[k];
    sg += obraz.piksele[k + 1];
    sb += obraz.piksele[k + 2];
    ile++;
  }
}
const r = sr / ile / 255;
const g = sg / ile / 255;
const b = sb / ile / 255;
console.log(JSON.stringify({
  plik: sciezka,
  pikseli: ile,
  prostokatPikseli: [px0, py0, px1, py1],
  r: +r.toFixed(6),
  g: +g.toFixed(6),
  b: +b.toFixed(6),
  luminancja: +(0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(6),
  // ⛔ MIARA BRAMKI 1 TO `blask`, NIE `luminancja`. Pole swieci barwa NASYCONA (pomarancz w dzien,
  // blekit w nocy), a luminancja jest szarosciowa: bialy krem ma wieksza luminancje niz gleboki
  // pomarancz, wiec na obrzezu pola zakrycie kremem PODNOSILO luminancje mimo zgaszenia emisji.
  // Zmierzone 2026-08-27 na wycinku [0,10; 0,16]..[0,20; 0,42]: luminancja 0,7235 → 0,7799
  // (w gore), a maksimum skladowych 0,8987 → 0,8463 (w dol). Maksimum idzie za emisja niezaleznie
  // od odcienia i dlatego to ono jest miara.
  blask: +Math.max(r, g, b).toFixed(6),
  roznicaRB: +(r - b).toFixed(6),
}));
