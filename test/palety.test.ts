import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexNaRgb, PALETA_DZIEN, PALETA_NOC } from '../src/logika/palety.ts';

test('hexNaRgb konwertuje standardowy zapis szesc-cyfrowy', () => {
  const [r, g, b] = hexNaRgb('#ff8000');
  assert.equal(r, 1);
  assert.equal(g, 128 / 255);
  assert.equal(b, 0);
});

test('hexNaRgb rzuca na skrocony zapis trzy-cyfrowy zamiast zwracac NaN', () => {
  assert.throws(() => hexNaRgb('#fff'));
});

test('hexNaRgb rzuca na brak krzyzyka na poczatku zamiast zwracac NaN', () => {
  assert.throws(() => hexNaRgb('ff8000'));
});

test('hexNaRgb rzuca na niepoprawne cyfry szesnastkowe zamiast zwracac NaN', () => {
  assert.throws(() => hexNaRgb('#gggggg'));
});

test('kazda nazwa z palety dnia ma dokladnie zmierzony kolor z tabeli', () => {
  const oczekiwane: Record<string, string> = {
    piasek: '#caaa9c',
    piasekCien: '#c4a69b',
    krem: '#f5e2d3',
    kremCieply: '#f3dccd',
    brzoskwinia: '#f3d4ac',
    brzoskwiniaCien: '#eccbab',
  };
  for (const [nazwa, hex] of Object.entries(oczekiwane)) {
    assert.deepEqual(PALETA_DZIEN[nazwa], hexNaRgb(hex), `PALETA_DZIEN.${nazwa} musi odpowiadac ${hex}`);
  }
  // ⛔ STRAZNIK LICZBY KLUCZY — TAKI SAM JAK PRZY NOCY, BO TAMTEN REALNIE ZLAPAL ROZJAZD.
  // Dwie asercje, nie jedna: pierwsza pilnuje, zeby nikt nie skrocil TABELI OCZEKIWAN (wtedy
  // druga przepuscilaby usuniete kolory), druga — zeby nikt nie dopelnil PALETY. Zadanie C2
  // wpuscilo do sceny piec barw spoza pomiaru (`ZOLTY_RDZEN`, `POMARANCZ_*`, `CZERWIEN_SPIEKU`,
  // `WEGIEL_SPIEKU`) i musialy wyjsc na oczy uzytkownika, zamiast na bramce.
  assert.equal(Object.keys(oczekiwane).length, 6, 'tabela oczekiwan musi wymieniac wszystkie 6 zmierzonych barw dnia');
  assert.equal(Object.keys(PALETA_DZIEN).length, Object.keys(oczekiwane).length, 'palety dnia nie wolno dopelniac wlasnymi kolorami');
});

test('kazda nazwa z palety nocy ma dokladnie zmierzony kolor z tabeli', () => {
  const oczekiwane: Record<string, string> = {
    poduszka: '#cbcbcc',
    poduszkaJasna: '#d4d4d4',
    poduszkaCien: '#c4c4c4',
    poduszkaGleboka: '#bbbbbc',
    lawendaJasna: '#c9cbea',
    lawendaSrednia: '#c4c4e5',
    lawendaCiemna: '#babbdd',
    lawenda: '#9b9abd',
    // ⚠️ SZESC BARW SLOICZKA, DOMIERZONYCH 2026-08-27 (zadanie C2). Osiem pozycji wyzej powstalo
    // z kwantyzacji CALEGO zdjecia, wiec sa w nich wylacznie tlo i poduszka — poprawne jako tlo
    // sceny nocnej, ale NIE jako barwa produktu. Nocny krem dojrzewa do wieczka i korpusu,
    // nie do lawendy tla, wiec te szesc musialo dojsc. Straznik liczby kluczy zostaje: probowal
    // wlasnie tego pilnowac i zadzialal poprawnie, wiec dostaje nowa liste, a nie luz.
    wieczko: '#eee1fa',
    wieczkoJasne: '#f2e4fb',
    wieczkoCien: '#d9c4ec',
    korpus: '#ede1dc',
    korpusCien: '#ebdeda',
    korpusGleboki: '#eadbd6',
  };
  for (const [nazwa, hex] of Object.entries(oczekiwane)) {
    assert.deepEqual(PALETA_NOC[nazwa], hexNaRgb(hex), `PALETA_NOC.${nazwa} musi odpowiadac ${hex}`);
  }
  assert.equal(Object.keys(oczekiwane).length, 14, 'tabela oczekiwan musi wymieniac wszystkie 14 zmierzonych barw nocy');
  assert.equal(Object.keys(PALETA_NOC).length, Object.keys(oczekiwane).length, 'palety nocy nie wolno dopelniac wlasnymi kolorami');
});

test('zadna skladowa zadnej palety nie wychodzi poza zakres 0..1', () => {
  for (const paleta of [PALETA_DZIEN, PALETA_NOC]) {
    for (const [nazwa, kolor] of Object.entries(paleta)) {
      for (const skladowa of kolor) {
        assert.ok(
          skladowa >= 0 && skladowa <= 1,
          `${nazwa}: skladowa ${skladowa} poza zakresem 0..1`,
        );
      }
    }
  }
});
