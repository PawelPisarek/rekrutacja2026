#!/usr/bin/env node
// BRAMKA: „KREM PRZYGASZA BLASK SWIECACEJ POWIERZCHNI".
//
// ⛔ CZEGO TA BRAMKA NIE ROBI, A ROBILA POPRZEDNIA. Bramka zadania C usredniala CALY prostokat
// wroga — a mieszkaly w nim takze obudowa i chmurka, oba ciemne. Biala warstwa kremu je
// ROZJASNIALA, wiec miara byla wypadkowa dwoch przeciwnych efektow i dawala sie domknac
// rozjasnieniem czegos, co z mechanika nie ma nic wspolnego (i faktycznie to wymusila).
// Ta mierzy `WYCINEK_SZKLA` — prostokat, w ktorym nie ma nic poza swiecaca powierzchnia.
//
// ⛔ MIARA TO `blask` (maksimum ze srednich skladowych), NIE `luminancja`. Pole swieci barwa
// nasycona, a luminancja jest szarosciowa: bialy krem potrafi PODNIESC luminancje, gaszac przy
// tym emisje. Uzasadnienie z liczbami: `src/gpu/przyrzad.ts`.
//
// ⛔ KONTROLA NEGATYWNA JEST CZESCIA BRAMKI, NIE DODATKIEM. Scena zyje w czasie (puls pola,
// drganie powietrza), wiec sam spadek blasku niczego nie dowodzi — trzeba wiedziec, ile blask
// zmienia sie SAM, przy tym samym rozkladzie czasu i bez malowania. Bramka przechodzi tylko
// wtedy, gdy spadek z malowaniem jest wielokrotnie wiekszy niz dryf bez malowania.
//
// Uzycie: node scripts/bramka-blask.mjs --url <adres> [--faza 0|1]
// Kody wyjscia: 0 = bramka zielona, 1 = bramka czerwona, 2 = blad pomiaru.

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adresDev, adresPodgladu } from './adres.mjs';

const KATALOG = dirname(fileURLToPath(import.meta.url));
const SONDA = join(KATALOG, 'sonda.mjs');

/** Ile razy spadek z kremem musi przewyzszyc dryf kontroli, zeby bramka cos znaczyla. */
const KROTNOSC_WOBEC_KONTROLI = 5;
/** Minimalny bezwzgledny spadek blasku. Ponizej tego roznica jest w szumie odczytu. */
const MINIMALNY_SPADEK = 0.05;

function argument(nazwa, domyslna) {
  const i = process.argv.indexOf(nazwa);
  return i >= 0 ? process.argv[i + 1] : domyslna;
}

// ⚠️ `--podglad` ZAMIAST PRZEPISYWANIA PRZEDROSTKA Z PALCA. Bez tej flagi pomiar na
// `npm run preview` wymagal recznego `--url http://localhost:4173/rekrutacja2026/`, czyli
// odtworzenia przedrostka, przed czym `scripts/adres.mjs` mial chronic.
const url = process.argv.includes('--podglad') ? adresPodgladu() : argument('--url', adresDev());
const faza = Number(argument('--faza', '0'));

/**
 * ⚠️ `s.ustawFaze(...)`, NIE `s.faza(...)`. Odkad zabawa ma wlasny przebieg (zadanie D), `faza()`
 * ODCZYTUJE biezaca faze jako napis, a przypiecie liczbowe robi `ustawFaze` — i przy okazji
 * ZATRZYMUJE maszyne faz, zeby karta produktowa nie wjechala w srodek pomiaru.
 *
 * ⚠️ OBA RAMIONA MAJA IDENTYCZNY ROZKLAD CZASU. `maluj = false` zamienia pociagniecia na
 * czekanie o tej samej dlugosci — inaczej kontrola mierzylaby dryf na krotszym odcinku niz
 * pomiar i „mniejszy dryf" bylby artefaktem harmonogramu, a nie brakiem malowania.
 */
function skrypt(maluj) {
  return `(async () => {
    const s = window.__sonda;
    const spij = (ms) => new Promise((r) => setTimeout(r, ms));
    s.czysc();
    s.ustawFaze(${faza});
    await spij(600);
    const przed = { blask: s.blask(), jasnosc: s.jasnosc(), pokrycie: s.pokrycie() };
    // Cztery przejazdy w poprzek WYCINEK_SZKLA (x 0,18..0,82, y 0,16..0,42).
    for (const y of [0.20, 0.26, 0.32, 0.38]) {
      if (${maluj}) { s.pociagnij(0.15, y, 0.85, y, 34); } 
      await spij(120);
    }
    await spij(500);
    const po = { blask: s.blask(), jasnosc: s.jasnosc(), pokrycie: s.pokrycie() };
    return { przed, po };
  })()`;
}

function odpal(maluj) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [SONDA, '--url', url, '--skrypt', skrypt(maluj)],
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

const zKremem = await odpal(true);
const kontrola = await odpal(false);

const spadek = zKremem.przed.blask - zKremem.po.blask;
const dryf = Math.abs(kontrola.przed.blask - kontrola.po.blask);
const zapas = dryf > 0 ? spadek / dryf : Infinity;

const zielona = spadek >= MINIMALNY_SPADEK && zapas >= KROTNOSC_WOBEC_KONTROLI;

console.log(JSON.stringify({
  faza,
  wycinek: 'WYCINEK_SZKLA',
  zKremem: {
    blaskPrzed: +zKremem.przed.blask.toFixed(4),
    blaskPo: +zKremem.po.blask.toFixed(4),
    spadek: +spadek.toFixed(4),
    // Pokrycie CZOLA chmurki. Ma zostac zerowe w obu ramionach — malujemy po szkle, nie po
    // chmurce. Gdyby rosło, winieta (sterowana pokryciem) rozjasnialaby wycinek i mieszala
    // sie do wyniku; te dwie liczby sa dowodem, ze sie nie miesza.
    pokrycieCzola: +zKremem.po.pokrycie.toFixed(4),
    luminancjaPrzed: +zKremem.przed.jasnosc.toFixed(4),
    luminancjaPo: +zKremem.po.jasnosc.toFixed(4),
  },
  kontrolaNegatywna: {
    blaskPrzed: +kontrola.przed.blask.toFixed(4),
    blaskPo: +kontrola.po.blask.toFixed(4),
    dryf: +dryf.toFixed(4),
    pokrycieCzola: +kontrola.po.pokrycie.toFixed(4),
  },
  zapasWobecKontroli: zapas === Infinity ? 'nieskonczony' : +zapas.toFixed(1),
  progi: { minimalnySpadek: MINIMALNY_SPADEK, krotnoscWobecKontroli: KROTNOSC_WOBEC_KONTROLI },
  werdykt: zielona ? 'ZIELONA' : 'CZERWONA',
}, null, 2));

process.exit(zielona ? 0 : 1);
