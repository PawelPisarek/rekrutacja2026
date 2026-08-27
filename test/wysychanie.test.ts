import { test } from 'node:test';
import assert from 'node:assert/strict';
import { krokWysychania, STALE_WYSYCHANIA } from '../src/logika/wysychanie.ts';

const S = { baza: 0.1, amplituda: 0.2, prog: 0.05 };

test('warstwa maleje z kazdym krokiem', () => {
  const po = krokWysychania(1, 0.1, 0, S);
  assert.ok(po < 1, `oczekiwano spadku, jest ${po}`);
});

test('szum przyspiesza wysychanie, wiec warstwa pęka nierowno', () => {
  const bezSzumu = krokWysychania(1, 0.1, 0, S);
  const zeSzumem = krokWysychania(1, 0.1, 1, S);
  assert.ok(zeSzumem < bezSzumu, 'teksel z wyzszym szumem musi schnac szybciej');
});

test('ponizej progu warstwa scinana jest do zera, a nie do wartosci szczatkowej', () => {
  assert.equal(krokWysychania(0.04, 0.001, 0, S), 0);
});

test('grubosc nigdy nie schodzi ponizej zera', () => {
  assert.equal(krokWysychania(0.02, 10, 1, S), 0);
});

test('stale produkcyjne maja sens: prog dodatni i mniejszy od jedynki', () => {
  assert.ok(STALE_WYSYCHANIA.prog > 0 && STALE_WYSYCHANIA.prog < 1);
  assert.ok(STALE_WYSYCHANIA.baza > 0);
});
