import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LicznikKlatek, OKNO_KLATEK } from '../src/gpu/pomiar.ts';

/**
 * ⛔ ZADNEJ RECZNIE POLICZONEJ LICZBY KLATEK. Kazda dlugosc przebiegu powstaje z `OKNO_KLATEK`,
 * a kazda oczekiwana srednia liczy KOD TESTU z tej samej tablicy, ktora poszla do licznika —
 * nie autor w glowie. Testowana jest wlasnosc „srednia dotyczy ostatnich `OKNO_KLATEK` probek",
 * a nie konkretna liczba milisekund.
 */

/** Srednia arytmetyczna policzona wprost — punkt odniesienia niezalezny od bufora cyklicznego. */
function srednia(wartosci: readonly number[]): number {
  return wartosci.reduce((a, b) => a + b, 0) / wartosci.length;
}

test('pusty licznik daje zero, a nie NaN', () => {
  const licznik = new LicznikKlatek();
  assert.equal(licznik.srednia, 0);
  assert.equal(licznik.zapisanych, 0);
});

test('przed zapelnieniem okna srednia dzieli przez liczbe probek, nie przez pojemnosc okna', () => {
  // ⛔ TO JEST TA WPADKA, PRZED KTORA BRONI SIE `zapisanych`: dzielenie przez stale OKNO_KLATEK
  // przez pierwsza sekunde zycia strony dawaloby liczbe zanizona, czyli „doskonala wydajnosc"
  // dokladnie wtedy, gdy nie wiadomo o niej jeszcze nic.
  const licznik = new LicznikKlatek();
  const probki = [16, 17, 33];
  for (const ms of probki) licznik.zapisz(ms);
  assert.equal(licznik.zapisanych, probki.length);
  assert.equal(licznik.srednia, srednia(probki));
});

test('okno jest dokladnie OKNO_KLATEK dlugie i nie rosnie dalej', () => {
  const licznik = new LicznikKlatek();
  for (let i = 0; i < OKNO_KLATEK * 3; i++) licznik.zapisz(16);
  assert.equal(licznik.zapisanych, OKNO_KLATEK);
});

test('srednia dotyczy OSTATNICH OKNO_KLATEK probek — starsze wypadaja', () => {
  const licznik = new LicznikKlatek();
  // Dlugi przebieg rosnacych czasow klatek: kazda probka inna, wiec zla granica okna nie ma
  // szans schowac sie w powtorzeniach.
  const wszystkie: number[] = [];
  for (let i = 0; i < OKNO_KLATEK * 4 + 7; i++) {
    const ms = 10 + i * 0.5;
    wszystkie.push(ms);
    licznik.zapisz(ms);
  }
  const ostatnie = wszystkie.slice(-OKNO_KLATEK);
  assert.ok(
    Math.abs(licznik.srednia - srednia(ostatnie)) < 1e-9,
    `srednia licznika ${licznik.srednia} ma odpowiadac srednim ostatnim ${OKNO_KLATEK} probkom `
    + `(${srednia(ostatnie)}), a nie calemu przebiegowi (${srednia(wszystkie)})`,
  );
  assert.notEqual(
    srednia(ostatnie),
    srednia(wszystkie),
    'test bylby bezwartosciowy, gdyby srednia okna rownala sie sredniej calego przebiegu',
  );
});

test('jedna dluga klatka podnosi srednia i wypada z okna po OKNO_KLATEK kolejnych', () => {
  const licznik = new LicznikKlatek();
  const SPOKOJNA = 16;
  const ZACIECIE = 500;
  for (let i = 0; i < OKNO_KLATEK; i++) licznik.zapisz(SPOKOJNA);
  const spokoj = licznik.srednia;
  licznik.zapisz(ZACIECIE);
  assert.ok(licznik.srednia > spokoj, 'zaciecie musi byc widoczne w sredniej');
  for (let i = 0; i < OKNO_KLATEK; i++) licznik.zapisz(SPOKOJNA);
  assert.equal(licznik.srednia, spokoj, 'po OKNO_KLATEK spokojnych klatkach zaciecie wypada z okna');
});
