import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zPrzypieciem } from '../src/gpu/sonda-sceny.ts';

/**
 * ⛔ TO JEST TEST GALKI POMIAROWEJ, A NIE TEST OPERATORA `??`.
 *
 * `Przypiecie.czas` powstalo dla bramki podpowiedzi: duch jest funkcja czasu, wiec probka
 * z losowej fazy daje losowy wynik. Regula projektu mowi, ze galka potrzebna pomiarowi wchodzi
 * do repozytorium NORMALNIE — nazwana, opisana i z testem dowodzacym, ze OBIE jej wartosci
 * dzialaja. Obie znacza tutaj dwie konkretne usterki, ktore ten test wyklucza:
 *
 *   - przypiecie, ktore NIE nadpisuje zycia sceny → bramka mierzylaby czas biegnacy, sadzac,
 *     ze stoi, i zwracalaby losowa liczbe z wiarygodnie wygladajacym odchyleniem;
 *   - `null`, ktore NIE oddaje sterowania → jedna bramka zostawialaby scene zamrozona, a kazda
 *     nastepna (i gracz po niej) dostawalaby zatrzymany obraz.
 *
 * Zadna wartosc czasu ponizej nie jest „ta wlasciwa" — sa to dowolne liczby z zakresow, ktore
 * musza zachowac sie tak samo: zero, ulamek, wielkosc rzedu godziny dzialania strony.
 */

test('przypiecie wygrywa z czasem plynacym ze sceny', () => {
  for (const przypieta of [0, 0.8727, 2.618, 1234.5]) {
    for (const zZycia of [0, 0.001, 17.25, 3600]) {
      assert.equal(
        zPrzypieciem(przypieta, zZycia),
        przypieta,
        `przypieta ${przypieta} s ma nadpisac ${zZycia} s z zegara`,
      );
    }
  }
});

test('brak przypiecia oddaje sterowanie zegarowi sceny', () => {
  for (const zZycia of [0, 0.001, 17.25, 3600]) {
    assert.equal(zPrzypieciem(null, zZycia), zZycia, `bez przypiecia ma plynac ${zZycia} s ze sceny`);
  }
});

/**
 * Przypadek brzegowy, ktory `||` zamiast `??` zjadloby po cichu: czas przypiety na ZERO to
 * poczatek toru podpowiedzi (`sin(0) = 0`, palec dokladnie na srodku czola) — najzupelniej
 * poprawna wartosc pomiarowa, a nie „brak przypiecia".
 */
test('czas przypiety na zero jest przypieciem, nie brakiem przypiecia', () => {
  assert.equal(zPrzypieciem(0, 42), 0, 'zero to poczatek toru, a nie wartosc pusta');
});
