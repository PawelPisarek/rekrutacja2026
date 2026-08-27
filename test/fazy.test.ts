import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nastepnyStan,
  STAN_POCZATKOWY,
  PROG_POKRYCIA,
  CZAS_POTWIERDZENIA,
  CZAS_KARTY,
  CZAS_ZACHODU,
  type Faza,
  type StanFaz,
} from '../src/logika/fazy.ts';

test('stan poczatkowy to dzien-gra z zerowymi licznikami', () => {
  assert.equal(STAN_POCZATKOWY.faza, 'dzien-gra');
  assert.equal(STAN_POCZATKOWY.wPelniOd, 0);
  assert.equal(STAN_POCZATKOWY.wFazieOd, 0);
});

test('pokrycie ponad progiem krocej niz czas potwierdzenia nie przelacza fazy', () => {
  // dwa kroki, kazdy krotszy niz polowa czasu potwierdzenia — suma i tak ponizej progu czasu
  let stan = STAN_POCZATKOWY;
  const dt = CZAS_POTWIERDZENIA / 3;
  stan = nastepnyStan(stan, PROG_POKRYCIA + 0.05, dt);
  stan = nastepnyStan(stan, PROG_POKRYCIA + 0.05, dt);
  assert.equal(stan.faza, 'dzien-gra', `po ${2 * dt}s (< ${CZAS_POTWIERDZENIA}s) faza nie moze sie przelaczyc`);
});

test('spadek pokrycia przed potwierdzeniem zeruje licznik wPelniOd', () => {
  let stan = STAN_POCZATKOWY;
  // prawie caly czas potwierdzenia, ale jeszcze nie przelaczylo
  stan = nastepnyStan(stan, PROG_POKRYCIA + 0.05, CZAS_POTWIERDZENIA * 0.9);
  assert.equal(stan.faza, 'dzien-gra');
  assert.ok(stan.wPelniOd > 0, 'licznik mial sie juz naliczyc');

  // spadek ponizej progu — licznik musi wrocic do zera
  stan = nastepnyStan(stan, PROG_POKRYCIA - 0.1, 0.01);
  assert.equal(stan.wPelniOd, 0, 'spadek ponizej progu musi wyzerowac licznik potwierdzenia');

  // powrot ponad prog na czas ktory sam w sobie by wystarczyl, gdyby licznik nie byl zerowany,
  // ale bez zerowania test by nic nie sprawdzal — sprawdzamy ze faza NIE przeszla mimo
  // ze skumulowany (blednie) czas przekroczylby prog
  stan = nastepnyStan(stan, PROG_POKRYCIA + 0.05, CZAS_POTWIERDZENIA * 0.9);
  assert.equal(stan.faza, 'dzien-gra', 'zerowanie po spadku wymaga pelnego czasu potwierdzenia od nowa');
});

test('kolejnosc faz: przy stalym pokryciu ponad progiem przechodzi dokladnie przez piec faz w kolejnosci', () => {
  let stan: StanFaz = STAN_POCZATKOWY;
  const dt = 0.01;
  const pokrycie = 0.9;
  assert.ok(pokrycie >= PROG_POKRYCIA, 'zalozenie testu: pokrycie musi byc ponad progiem');

  const kolejnoscUnikalna: Faza[] = [stan.faza];
  // margines bezpieczenstwa: potrzebny czas to suma wszystkich progow czasowych na trasie,
  // licznik mnozymy razy 3, zeby drobny krok napewno zdazyl - liczba pochodzi z importowanych
  // stalych, nie jest zgadywana ani symulowana recznie
  const potrzebnyCzas = CZAS_POTWIERDZENIA + CZAS_KARTY + CZAS_ZACHODU + CZAS_POTWIERDZENIA;
  const maksKrokow = Math.ceil((potrzebnyCzas / dt) * 3);

  for (let i = 0; i < maksKrokow && stan.faza !== 'noc-karta'; i++) {
    const nastepny = nastepnyStan(stan, pokrycie, dt);
    if (nastepny.faza !== stan.faza) kolejnoscUnikalna.push(nastepny.faza);
    stan = nastepny;
  }

  assert.deepEqual(kolejnoscUnikalna, ['dzien-gra', 'dzien-karta', 'zachod', 'noc-gra', 'noc-karta']);
});

test('brak cofania: pokrycie zerowe podane po osiagnieciu dzien-karta nie wraca do dzien-gra', () => {
  let stan = STAN_POCZATKOWY;
  // pelny czas potwierdzenia za jednym zamachem, przechodzi do dzien-karta
  stan = nastepnyStan(stan, 1, CZAS_POTWIERDZENIA + 0.01);
  assert.equal(stan.faza, 'dzien-karta');

  stan = nastepnyStan(stan, 0, 0.01);
  assert.equal(stan.faza, 'dzien-karta', 'histereza: karta raz pokazana nie wraca do gry mimo spadku pokrycia');
});

test('brak cofania: faza pozniejsza w kolejnosci nigdy nie wraca do wczesniejszej, mimo cyklicznych spadkow pokrycia w fazach -gra', () => {
  const kolejnosc: Faza[] = ['dzien-gra', 'dzien-karta', 'zachod', 'noc-gra', 'noc-karta'];
  let stan: StanFaz = STAN_POCZATKOWY;
  let maxIndeksDotad = kolejnosc.indexOf(stan.faza);
  const odwiedzone = new Set<Faza>([stan.faza]);
  const dt = 0.05;

  // Poprzednia wersja tego testu (pokrycie 0/1 na przemian co krok) nigdy nie zbierala
  // CZAS_POTWIERDZENIA sekund POD RZAD w fazach -gra, wiec maszyna nigdy nie ruszala z dzien-gra —
  // asercja `indeksTeraz >= maxIndeksDotad` byla spelniona trywialnie (0 >= 0) i nie sprawdzala
  // niczego dla pozostalych czterech faz. Tutaj pokrycie jest ponad progiem przez dlugie odcinki
  // (wyraznie dluzsze niz CZAS_POTWIERDZENIA), z pojedynczym spadkiem ponizej progu co `okresSpadku`
  // krokow — dosc rzadkim, zeby potwierdzenie zdazylo sie zebrac miedzy spadkami, ale realnym,
  // bo trafia takze w trakcie fazy noc-gra i musi tam zresetowac licznik bez cofania fazy.
  const okresSpadku = 30;
  assert.ok(
    (okresSpadku - 1) * dt > CZAS_POTWIERDZENIA,
    'zalozenie testu: miedzy spadkami musi starczyc czasu na potwierdzenie, inaczej test znowu nie ruszy z miejsca',
  );

  const potrzebnyCzas = CZAS_POTWIERDZENIA + CZAS_KARTY + CZAS_ZACHODU + CZAS_POTWIERDZENIA;
  // spory margines, bo cykliczne spadki pokrycia w fazach -gra spowalniaja zbieranie potwierdzenia
  const maksKrokow = Math.ceil((potrzebnyCzas / dt) * okresSpadku);

  for (let i = 0; i < maksKrokow && stan.faza !== 'noc-karta'; i++) {
    const pokrycie = i % okresSpadku === 0 ? 0 : 1;
    stan = nastepnyStan(stan, pokrycie, dt);
    odwiedzone.add(stan.faza);
    const indeksTeraz = kolejnosc.indexOf(stan.faza);
    assert.ok(indeksTeraz >= maxIndeksDotad, `faza cofnela sie: ${kolejnosc[maxIndeksDotad]} -> ${stan.faza}`);
    maxIndeksDotad = indeksTeraz;
  }

  assert.equal(
    stan.faza,
    'noc-karta',
    'maszyna musiala faktycznie dojechac do konca trasy pomimo cyklicznych spadkow pokrycia',
  );
  assert.deepEqual(
    [...odwiedzone].sort(),
    [...kolejnosc].sort(),
    'trasa musiala odwiedzic wszystkie piec faz, nie utknac na jednej',
  );
});

test('dt wieksze niz cala faza nie przeskakuje wiecej niz jednej fazy na wywolanie', () => {
  const stanStartowy: StanFaz = { faza: 'dzien-karta', wPelniOd: 0, wFazieOd: 0 };
  // ogromny dt, znacznie wiecej niz potrzeba na cala reszte maszyny
  const dtOgromne = (CZAS_KARTY + CZAS_ZACHODU + CZAS_POTWIERDZENIA) * 100;
  const stan = nastepnyStan(stanStartowy, 0.9, dtOgromne);
  assert.equal(stan.faza, 'zachod', 'jedno wywolanie moze przesunac najwyzej o jedna faze');
});

test('odcinek zdegenerowany czasowo: dt=0 nigdy nie zmienia fazy', () => {
  let stan = STAN_POCZATKOWY;
  stan = nastepnyStan(stan, 1, 0);
  assert.equal(stan.faza, 'dzien-gra');
  assert.equal(stan.wPelniOd, 0);
});

test('pokrycie dokladnie na progu liczy sie jako potwierdzenie (>=, nie >)', () => {
  let stan = STAN_POCZATKOWY;
  stan = nastepnyStan(stan, PROG_POKRYCIA, CZAS_POTWIERDZENIA + 0.01);
  assert.equal(stan.faza, 'dzien-karta', 'pokrycie rowne progowi musi sie liczyc jako potwierdzone');
});
