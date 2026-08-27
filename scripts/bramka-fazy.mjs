#!/usr/bin/env node
// BRAMKA: „KOLEJNOSC FAZ I ZAWARTOSC KARTY".
//
// ⛔ ZERO RECZNIE POLICZONYCH KROKOW I CZASOW. Jedyna wpadka pierwszej wersji tego projektu byla
// asercja „po 10 krokach po 0,2 s ma byc faza X" — wymagala, zeby autor testu bezblednie
// zsymulowal maszyne w glowie, a nie zsymulowal. Ta bramka pedzi maszyne drobnym krokiem, zbiera
// KAZDA zmiane fazy i orzeka o WLASNOSCIACH: kolejnosci unikalnych faz, monotonicznosci rampy
// zachodu, zakresie 0..1 i zawartosci karty koncowej. `LIMIT` petli nizej jest bezpiecznikiem
// przed nieskonczona petla, a nie asercja — bramka nie sprawdza, ile krokow zajelo przejscie.
//
// ⚠️ MASZYNA JEDZIE NA PRZEWIJANIU, ALE MALOWANIE JEST PRAWDZIWE. `przewin` dopycha wylacznie
// zegar faz; zeby faza `-gra` przeszla dalej, pokrycie SYLWETKI musi naprawde przekroczyc prog —
// bramka maluje po niej tymi samymi odcinkami, co palec gracza, i czeka na klatki, w ktorych
// licznik pokrycia wraca z GPU. Bez tego przejscie w noc bylo by zaliczone na nieaktualnym
// odczycie sprzed wyczyszczenia maski.
//
// Uzycie: node scripts/bramka-fazy.mjs --url <adres> [--zrzut <plik.png>] [--zrzut-wycinek <selektor>]
// Kody wyjscia: 0 = bramka zielona, 1 = bramka czerwona, 2 = blad pomiaru.

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adresDev, adresPodgladu } from './adres.mjs';

const KATALOG = dirname(fileURLToPath(import.meta.url));
const SONDA = join(KATALOG, 'sonda.mjs');

/** Jedyna dopuszczalna kolejnosc faz — ta sama, ktorej pilnuje `test/przebieg.test.ts`. */
const TRASA = ['dzien-gra', 'dzien-karta', 'zachod', 'noc-gra', 'noc-karta'];
const NAGLOWEK_NOCY = 'Ekran świeci, Ty regenerujesz';

function argument(nazwa, domyslna) {
  const i = process.argv.indexOf(nazwa);
  return i >= 0 ? process.argv[i + 1] : domyslna;
}

// ⚠️ `--podglad` ZAMIAST PRZEPISYWANIA PRZEDROSTKA Z PALCA. Bez tej flagi pomiar na
// `npm run preview` wymagal recznego `--url http://localhost:4173/rekrutacja2026/`, czyli
// odtworzenia przedrostka, przed czym `scripts/adres.mjs` mial chronic.
const url = process.argv.includes('--podglad') ? adresPodgladu() : argument('--url', adresDev());
const zrzut = argument('--zrzut', undefined);
const wycinek = argument('--zrzut-wycinek', undefined);

const SKRYPT = `(async () => {
  const s = window.__sonda;
  const klatka = () => new Promise((r) => requestAnimationFrame(() => r()));
  const widziane = [];
  const zapisz = () => { const f = s.faza(); if (widziane[widziane.length - 1] !== f) widziane.push(f); };
  const rampa = [];

  s.czysc();
  zapisz();

  // Krok przewijania DROBNY wobec najkrotszej fazy, zeby zadne przejscie nie zmiescilo sie
  // w calosci miedzy dwoma odczytami. LIMIT to bezpiecznik petli, nie oczekiwana liczba krokow.
  const KROK = 0.05;
  const LIMIT = 2000;
  let krokow = 0;
  for (; krokow < LIMIT && widziane[widziane.length - 1] !== 'noc-karta'; krokow++) {
    await klatka();
    // Malujemy tylko wtedy, gdy jest co malowac — piec przeciagniec w poprzek CALEJ POSTACI.
    // ⛔ WSPOLRZEDNE PRZELICZONE 2026-08-28, BO ZMIENIL SIE MIANOWNIK. Do tej pory staly tu dwa
    // przejazdy przez pas czola (y 0,585 i 0,645) — przy mianowniku „czolo" dawaly pokrycie
    // 1,000, a przy mianowniku „cala sylwetka" daja 0,414, czyli PONIZEJ progu 0,55. Bramka
    // wisialaby wiec na limicie petli i meldowala „kolejnosc faz sie nie zgadza" zamiast pokazac,
    // ze to gest jest za skapy. Sylwetka lezy w prostokacie x 0,110..0,890, y 0,552..0,868
    // (logika/chmurka.ts, czyChmurka); piec przejazdow co 0,06 zakrywa ja z zapasem (zmierzone
    // przyrzadem scripts/mierz-gesty.mjs, gest bazgranie-maskotka: szczyt 0,984).
    // UWAGA: zaden odwrocony apostrof w tym komentarzu — caly SKRYPT jest szablonem w apostrofach
    // odwroconych i pierwszy taki znak zamknalby go w polowie.
    if (s.faza().endsWith('-gra') && s.pokrycie() < 0.95) {
      s.pociagnij(0.12, 0.58, 0.88, 0.58, 30);
      s.pociagnij(0.88, 0.64, 0.12, 0.64, 30);
      s.pociagnij(0.12, 0.70, 0.88, 0.70, 30);
      s.pociagnij(0.88, 0.76, 0.12, 0.76, 30);
      s.pociagnij(0.12, 0.82, 0.88, 0.82, 30);
    }
    s.przewin(KROK);
    zapisz();
    rampa.push(s.fazaLiczbowa());
  }

  // Karta wjezdza z animacja — dajemy jej dojechac, zanim spytamy dokument, co pokazuje.
  await new Promise((r) => setTimeout(r, 700));
  const k = document.querySelector('#karta');
  const przyciski = k ? [...k.querySelectorAll('a, button')].filter((e) => !e.hidden).map((e) => e.textContent) : [];
  // ⛔ '!k.hidden' MIERZY ATRYBUT, NIE WIDOCZNOSC. karta.ts zdejmuje 'hidden' SYNCHRONICZNIE,
  // ale rzeczywisty wjazd (opacity 0 -> 1, translateY 10px -> 0) zalezy od klasy 'widoczna',
  // dodawanej dopiero w requestAnimationFrame. Element bez tej klasy jest w DOM-ie i ma
  // 'hidden === false', a mimo to stoi na opacity: 0 (index.html) — czyli niewidoczny dla
  // uzytkownika. Mierzymy wiec to, co faktycznie renderuje przegladarka: obliczona przezroczystosc
  // i rzeczywisty rozmiar na ekranie, oba PO 700 ms, ktore bramka juz i tak odczekuje na animacje.
  const styl = k ? getComputedStyle(k) : null;
  const prostokat = k ? k.getBoundingClientRect() : null;
  const kartaOpacity = styl ? Number.parseFloat(styl.opacity) : 0;
  const kartaWidoczna = !!k
    && !k.hidden
    && kartaOpacity > 0.95
    && prostokat.width > 0
    && prostokat.height > 0;
  return {
    widziane,
    krokow,
    rampaNiemalejaca: rampa.every((w, i) => i === 0 || w >= rampa[i - 1]),
    rampaWZakresie: rampa.every((w) => w >= 0 && w <= 1),
    rampaMaWartosciPosrednie: rampa.some((w) => w > 0 && w < 1),
    kartaWidoczna,
    kartaOpacity,
    naglowek: k?.querySelector('h2')?.textContent ?? null,
    obraz: k?.querySelector('img')?.getAttribute('src') ?? null,
    przyciski,
  };
})()`;

const wynik = await new Promise((resolve, reject) => {
  const argumenty = [SONDA, '--url', url, '--skrypt', SKRYPT, '--czekaj', '15000'];
  if (zrzut) argumenty.push('--zrzut', zrzut);
  if (wycinek) argumenty.push('--zrzut-wycinek', wycinek);
  execFile(process.execPath, argumenty, { maxBuffer: 8 * 1024 * 1024 }, (blad, stdout, stderr) => {
    if (blad) return reject(new Error(`sonda: ${stderr.trim() || blad.message}`));
    try {
      resolve(JSON.parse(stdout.trim()));
    } catch {
      reject(new Error(`sonda nie oddala JSON-a: ${stdout.trim()}`));
    }
  });
});

const kolejnoscZgodna = JSON.stringify(wynik.widziane) === JSON.stringify(TRASA);
const obrazNocny = typeof wynik.obraz === 'string'
  && /assets\//.test(wynik.obraz)
  && /produkt-noc-sleeping/.test(wynik.obraz);
const maPowrot = wynik.przyciski.some((tekst) => tekst === 'zagraj jeszcze raz');
const maSklep = wynik.przyciski.some((tekst) => tekst === 'Zobacz w sklepie →');

const zarzuty = [];
if (!kolejnoscZgodna) zarzuty.push(`kolejnosc faz ${JSON.stringify(wynik.widziane)} zamiast ${JSON.stringify(TRASA)}`);
if (!wynik.rampaNiemalejaca) zarzuty.push('rampa zachodu cofnela sie');
if (!wynik.rampaWZakresie) zarzuty.push('rampa zachodu wyszla poza 0..1');
if (!wynik.rampaMaWartosciPosrednie) zarzuty.push('zachod jest przelacznikiem, nie rampa — brak wartosci posrednich');
if (!wynik.kartaWidoczna) zarzuty.push('karta koncowa nie jest widoczna');
if (wynik.naglowek !== NAGLOWEK_NOCY) zarzuty.push(`naglowek karty nocnej to „${wynik.naglowek}"`);
if (!obrazNocny) zarzuty.push(`obraz karty nocnej to „${wynik.obraz}"`);
if (!maPowrot) zarzuty.push('karta nocna nie ma przycisku „zagraj jeszcze raz"');
if (!maSklep) zarzuty.push('karta nocna nie ma odnosnika „Zobacz w sklepie →"');

console.log(JSON.stringify({ ...wynik, oczekiwanaTrasa: TRASA, zarzuty, werdykt: zarzuty.length === 0 ? 'ZIELONA' : 'CZERWONA' }, null, 2));
process.exit(zarzuty.length === 0 ? 0 : 1);
