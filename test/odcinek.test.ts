import { test } from 'node:test';
import assert from 'node:assert/strict';
import { odlegloscOdOdcinka } from '../src/logika/odcinek.ts';

test('punkt na odcinku ma odleglosc zero', () => {
  assert.equal(odlegloscOdOdcinka(5, 0, 0, 0, 10, 0), 0);
});

test('punkt prostopadle nad srodkiem odcinka', () => {
  assert.equal(odlegloscOdOdcinka(5, 3, 0, 0, 10, 0), 3);
});

test('punkt za koncem odcinka mierzy do konca, nie do prostej', () => {
  // Gdyby liczyc odleglosc od NIESKONCZONEJ prostej, wyszloby 0. Ma wyjsc 5.
  assert.equal(odlegloscOdOdcinka(15, 0, 0, 0, 10, 0), 5);
});

test('punkt przed poczatkiem odcinka mierzy do poczatku', () => {
  assert.equal(odlegloscOdOdcinka(-4, 0, 0, 0, 10, 0), 4);
});

test('odcinek zdegenerowany do punktu nie dzieli przez zero', () => {
  const wynik = odlegloscOdOdcinka(3, 4, 0, 0, 0, 0);
  assert.equal(wynik, 5);
  assert.ok(Number.isFinite(wynik));
});
