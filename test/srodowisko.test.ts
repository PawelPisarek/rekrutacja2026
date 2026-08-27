import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOPISKI_BRAKU, czyPokazacHud, czyWebGPUDostepne, zbadajWebGPU,
} from '../src/logika/srodowisko.ts';
import type { PowodBrakuSceny } from '../src/logika/srodowisko.ts';

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
 * ⛔ TO SA TESTY NA USTERKE Z PRAWDZIWEGO URZADZENIA, nie na hipoteze. Uzytkownik zobaczyl na
 * telefonie z Androidem PUSTY KAFEL: `navigator.gpu` tam bylo, wiec `czyWebGPUDostepne`
 * przepuszczalo, a `requestAdapter()` oddawalo `null` i scena wywracala sie w cisze.
 *
 * ⚠️ ROZNICA MIEDZY TYMI TESTAMI A POPRZEDNIMI JEST CALYM SEDNEM: tamte pytaja, czy API ISTNIEJE,
 * te — czy da sie z niego cokolwiek WZIAC. Atrapa `{ gpu: {} }` przechodzi pierwsza bramke
 * i wywala sie na drugiej, co jest dokladnie tym, co ma robic.
 */
test('adapter null oznacza, ze WebGPU NIE zadziala, mimo obecnego API', async () => {
  const wynik = await zbadajWebGPU({ gpu: { requestAdapter: async () => null } });
  assert.equal(wynik.dziala, false);
  assert.equal(wynik.powod, 'brak-adaptera');
});

test('wyjatek z requestAdapter tez konczy sie odmowa, a wyjatek idzie dalej do konsoli', async () => {
  const wybuch = new Error('sterownik odmowil');
  const wynik = await zbadajWebGPU({
    gpu: {
      requestAdapter: async () => {
        throw wybuch;
      },
    },
  });
  assert.equal(wynik.dziala, false);
  assert.equal(wynik.powod, 'blad-adaptera');
  assert.equal(wynik.blad, wybuch, 'powod ma dojsc do wolajacego, a nie zniknac w catchu');
});

test('obiekt gpu bez requestAdapter nie udaje dzialajacego WebGPU', async () => {
  const wynik = await zbadajWebGPU({ gpu: {} });
  assert.equal(wynik.dziala, false);
  assert.equal(wynik.powod, 'blad-adaptera');
});

test('zwrocony adapter oznacza, ze WebGPU zadziala', async () => {
  const wynik = await zbadajWebGPU({ gpu: { requestAdapter: async () => ({ nazwa: 'atrapa' }) } });
  assert.equal(wynik.dziala, true);
  assert.equal(wynik.powod, null);
});

test('brak calego API rozpoznaje sie PRZED probowaniem adaptera', async () => {
  // ⚠️ Gdyby `zbadajWebGPU` szlo prosto do `requestAdapter`, ten przypadek konczylby sie
  // `blad-adaptera` (TypeError na `undefined`) i komunikat mowilby czytelnikowi nieprawde:
  // ze przegladarka WebGPU ma. Bramka wstepna istnieje po to, zeby powod byl PRAWDZIWY.
  const wynik = await zbadajWebGPU({});
  assert.equal(wynik.dziala, false);
  assert.equal(wynik.powod, 'brak-api');
});

test('kazdy powod ma swoj wpis w DOPISKI_BRAKU, a `brak-api` swiadomie ZADNEGO', () => {
  const powody: PowodBrakuSceny[] = ['brak-api', 'brak-adaptera', 'blad-adaptera', 'blad-startu'];
  for (const powod of powody) {
    assert.ok(powod in DOPISKI_BRAKU, `powod „${powod}" nie ma wpisu w DOPISKI_BRAKU`);
  }
  // `brak-api` nie dopisuje nic, bo zdanie z `index.html` mowi o nim wszystko. Kazdy inny powod
  // MUSI cos dopisac — przy nich rada „odpal ja w Chrome" jest mylaca.
  assert.equal(DOPISKI_BRAKU['brak-api'], null);
  for (const powod of powody.filter((p) => p !== 'brak-api')) {
    const dopisek = DOPISKI_BRAKU[powod];
    assert.ok(
      typeof dopisek === 'string' && dopisek.length > 0,
      `powod „${powod}" musi miec zdanie dla czytelnika`,
    );
  }
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
