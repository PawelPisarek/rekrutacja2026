import { test } from 'node:test';
import assert from 'node:assert/strict';
import { czyPokazacHud, czyWebGPUDostepne } from '../src/logika/srodowisko.ts';

test('brak pola gpu w nawigatorze oznacza brak WebGPU', () => {
  assert.equal(czyWebGPUDostepne({}), false);
});

test('undefined w polu gpu tez oznacza brak WebGPU', () => {
  assert.equal(czyWebGPUDostepne({ gpu: undefined }), false);
});

test('obecny obiekt gpu oznacza dostepne WebGPU', () => {
  assert.equal(czyWebGPUDostepne({ gpu: {} }), true);
});

/**
 * HUD gasnie przed wydaniem — a testem tej decyzji jest DOMYSLNA odpowiedz przy pustym adresie
 * i wylaczonym trybie deweloperskim. Reszta przypadkow pilnuje, ze wlaczniki nie przestaly dzialac,
 * bo przyrzad, ktorego nie da sie zapalic, jest usuniety, a nie zgaszony.
 */
test('w wydanej wersji HUD-a domyslnie nie ma', () => {
  assert.equal(czyPokazacHud('', false), false);
});

test('tryb deweloperski zapala HUD bez parametru w adresie', () => {
  assert.equal(czyPokazacHud('', true), true);
});

test('parametr ?hud zapala HUD takze poza trybem deweloperskim', () => {
  for (const szukajka of ['?hud', '?hud=1', '?hud=tak', '?cos=1&hud', '?hud=']) {
    assert.equal(czyPokazacHud(szukajka, false), true, `adres „${szukajka}" ma zapalac HUD`);
  }
});

test('jawne ?hud=0 gasi HUD nawet w trybie deweloperskim', () => {
  // ⛔ BEZ TEGO zrzut „kafel bez HUD-a" zalezalby od tego, ktorym poleceniem wystartowano strone.
  for (const szukajka of ['?hud=0', '?hud=false']) {
    assert.equal(czyPokazacHud(szukajka, true), false, `adres „${szukajka}" ma gasic HUD`);
  }
});

test('inne parametry adresu HUD-a nie ruszaja', () => {
  assert.equal(czyPokazacHud('?debug=1&faza=noc', false), false);
  assert.equal(czyPokazacHud('?debug=1&faza=noc', true), true);
});
