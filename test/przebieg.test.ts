import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Przebieg, czyGra, fazaLiczbowa, kartaFazy } from '../src/logika/przebieg.ts';
import {
  CZAS_KARTY,
  CZAS_POTWIERDZENIA,
  CZAS_ZACHODU,
  PROG_POKRYCIA,
  STAN_POCZATKOWY,
} from '../src/logika/fazy.ts';
import type { Faza } from '../src/logika/fazy.ts';

/** Jedyna dopuszczalna kolejnosc faz. Wypisana raz, uzywana przez wszystkie testy nizej. */
const TRASA: Faza[] = ['dzien-gra', 'dzien-karta', 'zachod', 'noc-gra', 'noc-karta'];

/** Ile czasu maszyna potrzebuje na cala trase — POLICZONE ze stalych, nie wpisane z glowy. */
const POTRZEBNY_CZAS = CZAS_POTWIERDZENIA + CZAS_KARTY + CZAS_ZACHODU + CZAS_POTWIERDZENIA;

test('faza liczbowa: dzien to 0, noc to 1, zachod lezy miedzy nimi', () => {
  assert.equal(fazaLiczbowa({ faza: 'dzien-gra', wPelniOd: 0, wFazieOd: 0 }), 0);
  assert.equal(fazaLiczbowa({ faza: 'dzien-karta', wPelniOd: 0, wFazieOd: CZAS_KARTY / 2 }), 0);
  assert.equal(fazaLiczbowa({ faza: 'noc-gra', wPelniOd: 0, wFazieOd: 0 }), 1);
  assert.equal(fazaLiczbowa({ faza: 'noc-karta', wPelniOd: 0, wFazieOd: 99 }), 1);

  const wPolowie = fazaLiczbowa({ faza: 'zachod', wPelniOd: 0, wFazieOd: CZAS_ZACHODU / 2 });
  assert.ok(wPolowie > 0 && wPolowie < 1, `polowa zachodu ma lezec miedzy dniem a noca, jest ${wPolowie}`);
  assert.equal(fazaLiczbowa({ faza: 'zachod', wPelniOd: 0, wFazieOd: 0 }), 0, 'zachod zaczyna sie od dnia');
});

test('faza liczbowa nigdy nie wychodzi poza 0..1, takze przy nadmiarowym wFazieOd', () => {
  for (const faza of TRASA) {
    for (const wFazieOd of [0, 0.001, CZAS_ZACHODU, CZAS_ZACHODU * 1000]) {
      const wartosc = fazaLiczbowa({ faza, wPelniOd: 0, wFazieOd });
      assert.ok(wartosc >= 0 && wartosc <= 1, `${faza} @ ${wFazieOd}s dalo ${wartosc}`);
    }
  }
});

test('faza liczbowa jest niemalejaca przez caly przebieg — zachod nie cofa sie w dzien', () => {
  const przebieg = new Przebieg();
  const dt = 0.01;
  const maksKrokow = Math.ceil((POTRZEBNY_CZAS / dt) * 3);
  let poprzednia = przebieg.liczbowa;
  assert.equal(poprzednia, 0, 'przebieg zaczyna sie w pelnym dniu');

  let widzianoPosrednia = false;
  for (let i = 0; i < maksKrokow && przebieg.faza !== 'noc-karta'; i++) {
    przebieg.krok(1, dt);
    const teraz = przebieg.liczbowa;
    assert.ok(teraz >= poprzednia, `faza liczbowa cofnela sie: ${poprzednia} -> ${teraz}`);
    if (teraz > 0 && teraz < 1) widzianoPosrednia = true;
    poprzednia = teraz;
  }

  assert.equal(przebieg.faza, 'noc-karta', 'przebieg musial dojechac do konca trasy');
  assert.equal(przebieg.liczbowa, 1, 'na koncu trasy jest pelna noc');
  assert.ok(widzianoPosrednia, 'zachod ma byc RAMPA — bez wartosci posrednich to przelacznik');
});

test('przewijanie zglasza kazda zmiane fazy, takze gdy jedno wywolanie przeskakuje kilka progow', () => {
  const przebieg = new Przebieg();
  const widziane: Faza[] = [przebieg.faza];
  przebieg.nasluchuj((nowa) => widziane.push(nowa));

  // JEDNO wywolanie dluzsze niz cala trasa. Bez podkrokow zglosiloby jedno przejscie zamiast
  // czterech — a scena zgubilaby czyszczenie maski i karte dnia.
  przebieg.przewin(POTRZEBNY_CZAS * 2, 1);

  assert.deepEqual(widziane, TRASA);
});

test('przewijanie daje ten sam ciag faz co tykanie drobnym krokiem', () => {
  const zegarem = new Przebieg();
  const przezZegarem: Faza[] = [zegarem.faza];
  zegarem.nasluchuj((nowa) => przezZegarem.push(nowa));
  const dt = 0.01;
  const maksKrokow = Math.ceil((POTRZEBNY_CZAS / dt) * 3);
  for (let i = 0; i < maksKrokow && zegarem.faza !== 'noc-karta'; i++) zegarem.krok(1, dt);

  const przewijany = new Przebieg();
  const przezPrzewijanie: Faza[] = [przewijany.faza];
  przewijany.nasluchuj((nowa) => przezPrzewijanie.push(nowa));
  przewijany.przewin(POTRZEBNY_CZAS * 2, 1);

  assert.deepEqual(przezPrzewijanie, przezZegarem);
});

test('przewijanie o zero i o wartosc ujemna nie rusza maszyny', () => {
  const przebieg = new Przebieg();
  przebieg.przewin(0, 1);
  przebieg.przewin(-POTRZEBNY_CZAS, 1);
  assert.deepEqual(przebieg.stan, STAN_POCZATKOWY);
});

test('pokrycie ponizej progu nie rusza przebiegu z dzien-gra, choc czas leci', () => {
  const przebieg = new Przebieg();
  przebieg.przewin(POTRZEBNY_CZAS * 2, PROG_POKRYCIA - 0.01);
  assert.equal(przebieg.faza, 'dzien-gra');
  assert.equal(przebieg.liczbowa, 0);
});

test('odNowa wraca do stanu poczatkowego i zglasza to nasluchowi', () => {
  const przebieg = new Przebieg();
  const widziane: Faza[] = [];
  przebieg.nasluchuj((nowa) => widziane.push(nowa));
  przebieg.przewin(POTRZEBNY_CZAS * 2, 1);
  assert.equal(przebieg.faza, 'noc-karta');

  widziane.length = 0;
  przebieg.odNowa();
  assert.deepEqual(przebieg.stan, STAN_POCZATKOWY);
  assert.deepEqual(widziane, ['dzien-gra'], 'powrot do dnia to zmiana fazy jak kazda inna');
  assert.equal(przebieg.liczbowa, 0, 'po powrocie paleta ma byc znowu dzienna');
});

test('odNowa w fazie poczatkowej nie zglasza zmiany, bo zadnej nie ma', () => {
  const przebieg = new Przebieg();
  let zgloszen = 0;
  przebieg.nasluchuj(() => { zgloszen++; });
  przebieg.odNowa();
  assert.equal(zgloszen, 0);
});

test('czyGra i kartaFazy dziela trase rozlacznie i bez luk', () => {
  for (const faza of TRASA) {
    const gra = czyGra(faza);
    const karta = kartaFazy(faza);
    if (faza === 'zachod') {
      assert.equal(gra, false, 'zachod nie jest zabawa');
      assert.equal(karta, null, 'w zachodzie nie stoi zadna karta');
    } else {
      assert.notEqual(gra, karta !== null, `${faza}: gra i karta nie moga zachodzic na siebie`);
    }
  }
  assert.equal(kartaFazy('dzien-karta'), 'dzien');
  assert.equal(kartaFazy('noc-karta'), 'noc');
});
