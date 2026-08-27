#!/usr/bin/env node
// BRAMKA: „DWIE BITMAPY I ANI JEDNEJ WIECEJ".
//
// ⛔ LICZY ZASOBY POBRANE PRZEZ PRZEGLADARKE, NIE PLIKI W REPOZYTORIUM. Plik lezacy w `assets/`
// i nigdy nie wczytany nie jest bitmapa w projekcie, a ikona doklejona w CSS jako `url(...)`
// nie lezy w `assets/` i mimo to jest. Jedyna miara, ktora odpowiada na pytanie „ile obrazow
// widzi uzytkownik", to `performance.getEntriesByType('resource')`.
//
// ⛔ POMIAR ODBYWA SIE ZARAZ PO ZALADOWANIU, BEZ PRZECHODZENIA ZABAWY. Dlatego oba obrazy kart
// powstaja od razu (`src/ui/karta.ts`) — leniwe tworzenie karty nocnej daloby tutaj jeden wpis
// i bramka konczylaby sie czerwono mimo poprawnego projektu.
//
// Uzycie: node scripts/bramka-bitmapy.mjs --url <adres>
// Kody wyjscia: 0 = bramka zielona, 1 = bramka czerwona, 2 = blad pomiaru.

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

// ⚠️ `--podglad` ZAMIAST PRZEPISYWANIA PRZEDROSTKA Z PALCA. Bez tej flagi pomiar na
// `npm run preview` wymagal recznego `--url http://localhost:4173/rekrutacja2026/`, czyli
// odtworzenia przedrostka, przed czym `scripts/adres.mjs` mial chronic.
const url = process.argv.includes('--podglad') ? adresPodgladu() : argument('--url', adresDev());

const SKRYPT = `(async () => {
  await new Promise((r) => setTimeout(r, 1500));
  // ⚠️ WZORZEC KONCZY SIE NA \`$\`, I TO JEST ISTOTNE. Serwer deweloperski Vite pobiera obraz
  // zaimportowany w module DWA razy: raz jako modul ESM (\`...webp?import\`, kilkadziesiat bajtow
  // z samym adresem) i raz jako prawdziwa bitmape (goly adres). Kotwica odsiewa opakowanie modulu,
  // a zostawia pobranie bitmapy — w wydaniu produkcyjnym opakowania nie ma i liczba jest ta sama.
  return performance.getEntriesByType('resource')
    .map((e) => e.name)
    .filter((n) => /\\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(n));
})()`;

const obrazy = await new Promise((resolve, reject) => {
  execFile(process.execPath, [SONDA, '--url', url, '--skrypt', SKRYPT], (blad, stdout, stderr) => {
    if (blad) return reject(new Error(`sonda: ${stderr.trim() || blad.message}`));
    try {
      resolve(JSON.parse(stdout.trim()));
    } catch {
      reject(new Error(`sonda nie oddala JSON-a: ${stdout.trim()}`));
    }
  });
});

const zArtefaktow = obrazy.filter((n) => /\/assets\//.test(n));
const zarzuty = [];
if (obrazy.length !== 2) zarzuty.push(`pobrano ${obrazy.length} bitmap zamiast dokladnie dwoch`);
if (zArtefaktow.length !== obrazy.length) zarzuty.push('nie kazda bitmapa pochodzi z `assets/`');
for (const wzorzec of ['produkt-dzien-spf50', 'produkt-noc-sleeping']) {
  if (!obrazy.some((n) => n.includes(wzorzec))) zarzuty.push(`brak bitmapy ${wzorzec}`);
}

console.log(JSON.stringify({ obrazy, zarzuty, werdykt: zarzuty.length === 0 ? 'ZIELONA' : 'CZERWONA' }, null, 2));
process.exit(zarzuty.length === 0 ? 0 : 1);
