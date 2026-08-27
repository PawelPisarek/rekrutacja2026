import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROG_PODPOWIEDZI, Podpowiedz, czyPokazacPodpowiedz } from '../src/ui/podpowiedz.ts';

/**
 * ⛔ ZADNEJ RECZNIE POLICZONEJ LICZBY SEKUND ANI KROKOW. Kazda wartosc czasu w tym pliku powstaje
 * z `PROG_PODPOWIEDZI` przez mnozenie, wiec zmiana progu nie wymaga przeliczenia testu w glowie
 * — a przede wszystkim test nie moze przejsc „przypadkiem", bo autor zle zsumowal kroki.
 */

test('przed progiem bezruchu podpowiedzi nie ma', () => {
  for (const ulamek of [0, 0.01, 0.25, 0.5, 0.9, 0.99]) {
    const bezczynnosc = PROG_PODPOWIEDZI * ulamek;
    assert.equal(
      czyPokazacPodpowiedz(bezczynnosc, false),
      false,
      `bezczynnosc ${bezczynnosc} s to jeszcze nie prog`,
    );
  }
});

test('na progu i po progu podpowiedz jest', () => {
  for (const krotnosc of [1, 1.01, 1.5, 2, 10, 100]) {
    const bezczynnosc = PROG_PODPOWIEDZI * krotnosc;
    assert.equal(
      czyPokazacPodpowiedz(bezczynnosc, false),
      true,
      `bezczynnosc ${bezczynnosc} s to juz prog`,
    );
  }
});

test('kto raz malowal, nie zobaczy podpowiedzi przy zadnej dlugosci bezruchu', () => {
  for (const krotnosc of [0, 0.5, 1, 2, 10, 1000]) {
    assert.equal(
      czyPokazacPodpowiedz(PROG_PODPOWIEDZI * krotnosc, true),
      false,
      `po pierwszym malowaniu bezczynnosc ${PROG_PODPOWIEDZI * krotnosc} s niczego nie wskrzesza`,
    );
  }
});

/**
 * Wlasnosc, ktorej nie da sie zle policzyc: pedzimy licznik drobnym krokiem, zbieramy KAZDA
 * klatke, w ktorej podpowiedz byla widoczna, i pytamy o kolejnosc — czy ktorakolwiek z nich
 * wypadla po pierwszym malowaniu. Ile bylo krokow i ile sekund minelo, test nie sprawdza.
 */
test('po pierwszym malowaniu podpowiedz nie wraca juz nigdy', () => {
  const KROK = PROG_PODPOWIEDZI / 60;
  const stan = new Podpowiedz();
  // Bezpiecznik petli, nie asercja: dlugosc przebiegu liczona z progu, zeby zmiescic bezruch
  // przed malowaniem i wielokrotnie dluzszy po nim.
  const KROKOW = Math.ceil((PROG_PODPOWIEDZI * 20) / KROK);
  const klatkaMalowania = Math.floor(KROKOW / 4);

  let widocznaPrzedMalowaniem = false;
  let widocznaPoMalowaniu = false;
  for (let i = 0; i < KROKOW; i++) {
    const maluje = i === klatkaMalowania;
    stan.krok(KROK, maluje);
    if (stan.sila > 0) {
      if (stan.malowal) widocznaPoMalowaniu = true;
      else widocznaPrzedMalowaniem = true;
    }
  }

  assert.equal(widocznaPrzedMalowaniem, true, 'przed pierwszym malowaniem podpowiedz musi sie pokazac');
  assert.equal(widocznaPoMalowaniu, false, 'po pierwszym malowaniu podpowiedz nie ma prawa wrocic');
});

test('malowanie zeruje licznik bezruchu, wiec podpowiedz gasnie w tej samej klatce', () => {
  const stan = new Podpowiedz();
  stan.krok(PROG_PODPOWIEDZI * 3, false);
  assert.equal(stan.sila, 1, 'dlugi bezruch bez malowania pokazuje podpowiedz');
  stan.krok(PROG_PODPOWIEDZI / 60, true);
  assert.equal(stan.sila, 0, 'pierwsze musniecie pedzla gasi podpowiedz natychmiast');
});

test('zerowy krok czasu nie posuwa licznika bezruchu', () => {
  // ⚠️ TO JEST SCIEZKA KARTY PRODUKTOWEJ I ZACHODU: scena dostaje wtedy dt = 0, wiec bezruch
  // gracza podczas opowiesci nie ma prawa uzbierac sie na podpowiedz.
  const stan = new Podpowiedz();
  for (let i = 0; i < 10_000; i++) stan.krok(0, false);
  assert.equal(stan.sila, 0, 'przy dt = 0 licznik stoi, niezaleznie od liczby klatek');
});
