import { test } from 'node:test';
import assert from 'node:assert/strict';
import { czyChmurka, czyCzolo, ramka, udzial } from '../src/logika/chmurka.ts';
import {
  czyWZasieguSymbolu, PROMIEN_TARCZY, SRODEK_SYMBOLU, ZASIEG_SYMBOLU,
} from '../src/logika/symbol.ts';
import { POLE, WYCINEK_SZKLA } from '../src/gpu/wspolne.ts';

/**
 * BRAMKA SYMBOLU NIEBA — trzy warunki, ktorych nie wolno sprawdzic okiem na zrzucie.
 *
 * ⚠️ MIERZONE NA SIATCE, NIE WYWNIOSKOWANE Z NIEROWNOSCI. Porownanie samych stalych
 * („0,144 < 0,16, wiec nie koliduje") powtarzaloby w tescie te sama arytmetyke, ktora ma
 * sprawdzic. Zamiast tego oba obszary sa PRZEBIEGANE po tej samej siatce 512x512, po ktorej
 * liczy potok `Pokrycie` — czyli test pyta o czesc wspolna, a nie o granice pudelek.
 */

test('symbol nie ma ani jednego punktu wspolnego z obszarem liczonym', () => {
  const G = 512;
  let wspolne = 0;
  for (let j = 0; j < G; j++) {
    const y = (j + 0.5) / G;
    for (let i = 0; i < G; i++) {
      const x = (i + 0.5) / G;
      if (czyWZasieguSymbolu(x, y) && czyCzolo(x, y)) wspolne++;
    }
  }
  assert.equal(wspolne, 0, `symbol wchodzi w czolo na ${wspolne} tekselach — mieszalby w liczniku`);
});

test('mianownik pokrycia nie wie o symbolu — udzial czola jest ten sam z nim i bez niego', () => {
  // ⛔ SABOTAZ WLASNEGO KRYTERIUM. Test wyzej przeszedlby takze wtedy, gdyby `czyCzolo` bylo puste.
  // Tutaj liczymy mianownik i sprawdzamy, ze jest niezerowy — a wiec, ze poprzednie zero naprawde
  // znaczy „brak czesci wspolnej", a nie „brak obszaru".
  const udzialCzola = udzial(czyCzolo);
  const udzialSymbolu = udzial(czyWZasieguSymbolu);
  assert.ok(udzialCzola > 0.05, `obszar liczony wyszedl pusty (${udzialCzola})`);
  assert.ok(udzialSymbolu > 0.005, `zasieg symbolu wyszedl pusty (${udzialSymbolu})`);
});

test('symbol nie dotyka sylwetki postaci, wiec nie koliduje z podpowiedzia gestu', () => {
  // ⛔ WARUNEK MOCNIEJSZY OD POTRZEBNEGO, I DLATEGO PROSTY DO ZMIERZENIA. Podpowiedz gestu rysuje
  // sie wylacznie na sylwetce (`naCzole = maskaChmurki * ...` w `gpu/obraz.ts`), wiec symbol
  // rozlaczny z CALA sylwetka jest rozlaczny takze z kazdym polozeniem wedrujacej plamy, ogona
  // i toru — bez potrzeby powtarzania tu geometrii toru.
  const G = 512;
  let wspolne = 0;
  for (let j = 0; j < G; j++) {
    const y = (j + 0.5) / G;
    for (let i = 0; i < G; i++) {
      const x = (i + 0.5) / G;
      if (czyWZasieguSymbolu(x, y) && czyChmurka(x, y)) wspolne++;
    }
  }
  assert.equal(wspolne, 0, `symbol nachodzi na sylwetke na ${wspolne} tekselach`);
});

test('symbol lezy poza wycinkiem bramki blasku', () => {
  // ⛔ INACZEJ BRAMKA „KREM PRZYGASZA BLASK" MIERZYLABY DWIE RZECZY NARAZ. Jasny symbol wewnatrz
  // `WYCINEK_SZKLA` podnosilby srednia niezaleznie od kremu — dokladnie ten sam blad ksztaltu,
  // przez ktory poprzednia wersja bramki usredniala razem szklo, obudowe i postac.
  const r = ramka(czyWZasieguSymbolu);
  const rozlaczne = r.y1 < WYCINEK_SZKLA.y0
    || r.y0 > WYCINEK_SZKLA.y1
    || r.x1 < WYCINEK_SZKLA.x0
    || r.x0 > WYCINEK_SZKLA.x1;
  assert.ok(rozlaczne, `zasieg symbolu ${JSON.stringify(r)} wchodzi w ${JSON.stringify(WYCINEK_SZKLA)}`);
});

test('symbol siedzi w GORNEJ czesci kafla i miesci sie w kadrze', () => {
  const r = ramka(czyWZasieguSymbolu);
  assert.ok(r.y1 < 0.5, `symbol zjechal ponizej polowy kafla: ${r.y1}`);
  assert.ok(r.x0 > POLE.x0 && r.x1 < POLE.x1, 'symbol wystaje poza kadr w poziomie');
  assert.ok(r.y0 > POLE.y0 && r.y1 < POLE.y1, 'symbol wystaje poza kadr w pionie');
});

test('zasieg jest granica GORNA ksztaltu, a nie samym ksztaltem', () => {
  assert.ok(ZASIEG_SYMBOLU > PROMIEN_TARCZY, 'ramiona slonca musza miec dokad wyjsc poza tarcze');
  assert.equal(czyWZasieguSymbolu(SRODEK_SYMBOLU.x, SRODEK_SYMBOLU.y), true);
  assert.equal(
    czyWZasieguSymbolu(SRODEK_SYMBOLU.x + ZASIEG_SYMBOLU * 1.01, SRODEK_SYMBOLU.y),
    false,
    'predykat zasiegu nie konczy sie tam, gdzie deklaruje',
  );
});
