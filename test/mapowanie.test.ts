import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ekranNaMaske, maskaNaEkran, skalaMapowania } from '../src/logika/mapowanie.ts';

/** Kilka proporcji: kwadrat, szeroka, bardzo szeroka, wysoka. */
const PROPORCJE = [1, 16 / 9, 2400 / 1372, 0.5];

test('przy kwadratowym kadrze mapowanie jest tozsamoscia', () => {
  for (const [x, y] of [[0, 0], [0.5, 0.5], [1, 1], [0.18, 0.9]] as const) {
    const [mx, my] = ekranNaMaske(x, y, 1);
    assert.ok(Math.abs(mx - x) < 1e-12, `${mx} != ${x}`);
    assert.ok(Math.abs(my - y) < 1e-12, `${my} != ${y}`);
  }
});

test('maskaNaEkran jest odwrotnoscia ekranNaMaske', () => {
  for (const proporcja of PROPORCJE) {
    for (const [x, y] of [[0, 0], [0.2, 0.8], [1, 1], [0.5, 0.5]] as const) {
      const [mx, my] = ekranNaMaske(x, y, proporcja);
      const [wx, wy] = maskaNaEkran(mx, my, proporcja);
      assert.ok(Math.abs(wx - x) < 1e-12, `x: ${wx} != ${x} przy ${proporcja}`);
      assert.ok(Math.abs(wy - y) < 1e-12, `y: ${wy} != ${y} przy ${proporcja}`);
    }
  }
});

/**
 * ⛔ TO JEST TEST NA „PEDZEL MA BYC KOLEM, NIE ELIPSA".
 * Bierze przesuniecie o TE SAMA liczbe PIKSELI w poziomie i w pionie i sprawdza, ze w przestrzeni
 * maski daje te sama dlugosc. Zadanie B tego nie spelnialo: mapowanie mialo tam skale
 * 1/szerokosc na osi X i 1/wysokosc na osi Y.
 */
test('ten sam ruch w pikselach daje ten sam ruch w masce na obu osiach', () => {
  for (const [szer, wys] of [[2400, 1372], [1920, 1080], [800, 600], [600, 900]] as const) {
    const proporcja = szer / wys;
    const pikseli = 40;
    const [x0, y0] = ekranNaMaske(0.5, 0.5, proporcja);
    const [x1] = ekranNaMaske(0.5 + pikseli / szer, 0.5, proporcja);
    const [, y1] = ekranNaMaske(0.5, 0.5 + pikseli / wys, proporcja);
    const wPoziomie = Math.abs(x1 - x0);
    const wPionie = Math.abs(y1 - y0);
    assert.ok(
      Math.abs(wPoziomie - wPionie) < 1e-12,
      `${szer}x${wys}: poziom ${wPoziomie} != pion ${wPionie}`,
    );
  }
});

test('caly kwadrat maski miesci sie w kadrze przy kazdej proporcji', () => {
  for (const proporcja of PROPORCJE) {
    for (const [x, y] of [[0, 0], [1, 1], [0, 1], [1, 0]] as const) {
      const [ex, ey] = maskaNaEkran(x, y, proporcja);
      assert.ok(ex >= -1e-12 && ex <= 1 + 1e-12, `x poza kadrem: ${ex} przy ${proporcja}`);
      assert.ok(ey >= -1e-12 && ey <= 1 + 1e-12, `y poza kadrem: ${ey} przy ${proporcja}`);
    }
  }
});

test('skalaMapowania odrzuca proporcje niedodatnia i nieskonczona', () => {
  assert.throws(() => skalaMapowania(0));
  assert.throws(() => skalaMapowania(-2));
  assert.throws(() => skalaMapowania(Number.POSITIVE_INFINITY));
  assert.throws(() => skalaMapowania(Number.NaN));
});
