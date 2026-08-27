# Fluff kontra Słońce — plan wdrożenia (wersja 2)

**Cel:** Osadzalna na stronie zabawka: gracz rozsmarowuje krem Fluffa po ekranie telefonu
udającego słońce (dzień) i świecącego zimnym błękitem w ciemności (noc). Krem wysycha i pęka,
więc trzeba domalowywać.

**Architektura:** Maska kremu w teksturze 512 × 512 o **stałych rolach** (czytamy A, piszemy B,
kopiujemy B→A). Trzy potoki TypeGPU: `malowanie` (compute), `pokrycie` (compute, redukcja
atomikowa po powierzchni wroga), `scena` (render — cała grafika proceduralnie w jednym
pełnoekranowym fragmencie). Logika, którą da się sprawdzić bez GPU, mieszka w `src/logika/`
jako czyste funkcje.

**Stos:** TypeScript, Vite 8, TypeGPU 0.12.3, `node --test` + `tsx`, GitHub Actions → Pages.

**Spec:** [`docs/design.md`](design.md) — wiążący autorytet; plan jest tylko jego argumentem.

---

## Czym ta wersja różni się od pierwszej

Pierwsza wersja miała cztery wady, które ujawniły się dopiero w wykonaniu. Nowa jest odpowiedzią
na każdą z nich. Jeśli będzie Cię kusić powrót do starego kształtu — przeczytaj najpierw to.

1. **Asercje liczone w głowie.** Test „pełna ścieżka faz" oczekiwał fazy `zachod`, a maszyna dawała
   `noc-gra` — bo autor planu źle policzył, ile kroków tyka w której fazie. Implementacja była
   poprawna; wadliwy był test. **Reguła: żadna asercja nie zawiera ręcznie policzonej liczby
   kroków ani czasu.**
2. **Plan był drugą kopią kodu.** 1800 linii dosłownych listingów; poprawka jednej rzeczy
   wymagała chirurgii na dokumencie. Teraz plan podaje **kontrakty, dokładne wartości i bramki**,
   a kod pisze wykonawca.
3. **Rozjechana granulacja.** Dziesięć zadań, z których dwa trzeba było połączyć już przy
   pierwszej wysyłce. Teraz pięć, każde z własną bramką i własną powierzchnią recenzji.
4. **Zadania GPU bez automatycznej bramki.** Kroki mówiły „sprawdź w przeglądarce", czego wykonawca bez oczu
   nie umie — największe ryzyko miało najsłabszy nadzór. Teraz **każde zadanie rysujące cokolwiek
   ma bramkę uruchamialną przez CDP**.

## Punkt wyjścia — co już istnieje

Na gałęzi `wdrozenie` są trzy commity kodu — ta praca jest już zrobiona.

| commit | zawartość |
|---|---|
| `62b01ea` | szkielet Vite + TypeScript + TypeGPU, `index.html`, `czyWebGPUDostepne`, `npm test`, zaślepka `src/gpu/scena.ts` |
| `92b1b43` | poprzednia wersja planu (zastąpiona tym dokumentem) |
| `0069b1f` | `src/logika/odcinek.ts` — `odlegloscOdOdcinka`; `src/logika/wysychanie.ts` — `krokWysychania`, `STALE_WYSYCHANIA`; oba z testami |
| `9e60525`, `222af62` | zadanie A: `scripts/sonda.mjs`, `fazy.ts`, `palety.ts` z testami |
| `8821652` | naprawa builda — `@types/node` (krok 0 zadania B) |
| `9fca4ba` | zadanie B: `wspolne.ts`, `maska.ts`, `pokrycie.ts`, podgląd maski w `scena.ts` |

Stan testów przed zadaniem A: **13 przechodzi, 0 nie przechodzi** (plan podawał wcześniej 10 —
to była pomyłka autora, wychwycona w zadaniu A).

Po zadaniu A (`9e60525`) doszły `scripts/sonda.mjs`, `src/logika/fazy.ts` i `src/logika/palety.ts`
z testami: **29 testów przechodzi**.

## Ograniczenia globalne

Każde zadanie dziedziczy poniższe wymagania.

- **TypeGPU 0.12.3+; WebGPU obowiązkowo.** Brak `navigator.gpu` → komunikat tekstowy dokładnie
  w brzmieniu: *„Ta strona wymaga WebGPU. Odpal ją w Chrome albo na innym urządzeniu."*
- **Brak dźwięku.** Żadnego `Audio`, `AudioContext`, żadnych plików dźwiękowych.
- **Brak fallbacku graficznego.** Żadnego Canvas2D, żadnej klatki zastępczej.
- **Dokładnie dwie bitmapy w całym projekcie:** `assets/produkt-dzien-spf50.webp`
  i `assets/produkt-noc-sleeping.webp`. **Wordmark `flüff` jest NIEZAAKCEPTOWANY — nie wolno go
  użyć.** Żadnych innych obrazów, ikon ani logotypów; reszta grafiki jest proceduralna.
- **Kolory tylko zmierzone.** Dzień: `#caaa9c`, `#c4a69b`, `#f5e2d3`, `#f3dccd`, `#f3d4ac`,
  `#eccbab`. Noc: `#cbcbcc`, `#d4d4d4`, `#c4c4c4`, `#bbbbbc`, `#c9cbea`, `#c4c4e5`, `#babbdd`,
  `#9b9abd`. Nie dobieraj, nie zaokrąglaj, nie dodawaj własnych.
- **Treść kart produktowych dosłownie ze specu §7.** Nie formułuj własnych obietnic o działaniu
  kosmetyków.
- **Dwie sceny, koniec.** Bez wyniku punktowego, licznika, rankingu, kamery, backendu, analityki.
- **Rozmiar maski: 512** — dzieli się przez 8, więc grupa robocza `[8, 8]` pokrywa ją dokładnie
  i shader nie potrzebuje strażnika zakresu.
- Komentarze i nazwy po polsku, **bez polskich znaków diakrytycznych w identyfikatorach**.
- **Bez `git checkout`, `git restore` i `git stash`.** W drzewie mogą leżeć zmiany spoza
  bieżącego zadania; commitowane są wyłącznie pliki wymienione w zadaniu.

## Bramka CDP — jak sprawdzić GPU bez oczu

Na `127.0.0.1:9222` działa **prawdziwy Chrome użytkownika** z protokołem DevTools. To jest bramka
dla każdego zadania rysującego cokolwiek. Nie instaluj puppeteera ani playwrighta — sterujesz
istniejącą przeglądarką zwykłym `fetch` i `WebSocket` z Node'a.

⚠️ **WebGPU wymaga bezpiecznego kontekstu.** Na `about:blank` `navigator.gpu` jest `undefined`
**z definicji**, niezależnie od sprzętu — poprzedni prototyp stracił na tym pół nocy i uznał
brak WebGPU za wadę sprzętu. `http://localhost` i `http://127.0.0.1` liczą się jako bezpieczne,
więc serwer deweloperski Vite jest w porządku. **Nigdy nie diagnozuj WebGPU na `about:blank`.**

Przepływ każdej bramki:

```bash
npm run dev &                      # serwer w tle
node scripts/sonda.mjs --url http://localhost:5173/rekrutacja2026/ --skrypt '<wyrazenie JS>'
```

⚠️ **Adres bramki to `localhost`, nie pętla zwrotna po IPv4, i zawiera `/rekrutacja2026/`.**
Serwer Vite nasłuchuje na `localhost` (na macOS rozwiązywanym najpierw jako IPv6), a `vite.config.ts`
ma ustawione `base: '/rekrutacja2026/'` pod GitHub Pages — bez tego przedrostka dostaniesz 404.
Zmierzone w zadaniu A.

Sonda otwiera nową kartę, czeka na gotowość aplikacji, wykonuje wyrażenie, wypisuje jego wynik
jako JSON i zamyka kartę. Buduje ją zadanie A.

## Składnia TGSL — ustalenia z zadania B

Te rzeczy zostały **zmierzone w wykonaniu**, nie odczytane z dokumentacji. Zadania C, D i E
oszczędzą sobie na nich godziny.

⛔ **Operatory arytmetyczne na wektorach NIE DZIAŁAJĄ w tym projekcie.** Zapis `a + b * t` na
`vec2f`/`vec3f` daje `TS2365`. Wcześniejszy prototyp WebGPU, do którego warto zaglądać po wzorce
składni, pisze właśnie tak — ale ma w `package.json` `"typescript": "npm:tsover@6.0.1"`, czyli
kompilator z przeciążaniem operatorów. Tutaj jest zwykły TypeScript. **Używaj `std.add`, `std.sub`,
`std.mul`, `std.div`.** Kopiowanie składni z tamtego projektu jeden do jednego się nie skompiluje.

⚠️ **Format maski to `rgba16float`, nie `rgba8unorm`.** Przy ośmiu bitach krok kwantyzacji wynosi
1/255 i jest **większy** niż ubytek wysychania na klatkę — każdy teksel schodziłby o dokładnie
jeden krok niezależnie od szumu, więc warstwa **płowiałaby równomiernie zamiast pękać**, a pękanie
jest sednem mechaniki. Koszt: kopia B→A rośnie z 1 MB do 2 MB na klatkę.

⚠️ **`widokDoOdczytu()` zwraca zawężony typ `WidokMaski`**, nie goły `TgpuTextureView` — ten
ostatni jest unią i `std.textureLoad` go nie przyjmuje. To nadal jest widok tekstury, więc
konsumenci nic nie tracą.

⚠️ **`wyczysc()` czyści tylko teksturę A.** B nie ma flagi `COPY_DST`, a i tak jest nadpisywana
w całości przy każdym przebiegu. Zmierzone: pokrycie 0,189 → 0.

⚠️ **Maska jest rozciągana na cały kadr bez korekty proporcji** — na szerokim ekranie pędzel jest
elipsą, nie kołem. Zostawione świadomie: mapowanie przestrzeni maski na ekran to decyzja
zadania C, które wprowadza `proporcja` do uniformu sceny. **Zadanie C ma to naprawić.**

⚠️ **Kanał `g` (wiek warstwy) nie jest sprawdzany przez żadną bramkę zadania B** — podgląd
pokazuje wyłącznie `r`. Pierwszym prawdziwym sprawdzianem dojrzewania kremu jest **bramka
zadania C**, gdzie świeża warstwa ma być biała, a dojrzała ciepła. Dopilnuj tego.

## Reguły testów — jak nie powtórzyć wpadki pierwszej wersji

⛔ **Nigdy nie pisz asercji z ręcznie policzoną liczbą kroków ani czasem.** To była przyczyna
jedynego błędu pierwszej wersji: „po 10 krokach po 0,2 s ma być faza X" wymaga, żeby autor testu
bezbłędnie zsymulował maszynę w głowie — a nie zsymulował, bo pierwsza pętla przełączała fazę
w połowie i pięć kolejnych kroków tykało już w następnej fazie.

Testuj własności, których nie da się źle policzyć:

- **Kolejność:** pędź maszynę drobnym krokiem, zbieraj każdą zmianę fazy i asertuj, że ciąg
  unikalnych faz to dokładnie `['dzien-gra','dzien-karta','zachod','noc-gra','noc-karta']`.
- **Monotoniczność:** wysychanie nigdy nie zwiększa grubości; faza nigdy się nie cofa.
- **Niezmienniki:** żadna składowa koloru poza `0..1`; grubość nigdy ujemna; pokrycie nigdy > 1.
- **Przypadki brzegowe nazwane z sensu, nie z arytmetyki:** odcinek zdegenerowany do punktu,
  pokrycie dokładnie na progu, `dt` większe niż cała faza.

Jeśli test potrzebuje liczby, którą trzeba policzyć — **niech policzy ją kod testu**, nie autor.

---

## Zadanie A: Przyrząd CDP i dokończenie czystej logiki

Kładzie bramkę, z której korzystają wszystkie kolejne zadania, i domyka warstwę logiki.

**Pliki:**
- Utwórz: `scripts/sonda.mjs`, `src/logika/fazy.ts`, `src/logika/palety.ts`
- Test: `test/fazy.test.ts`, `test/palety.test.ts`
- Zmodyfikuj: `src/gpu/scena.ts` (jedna linia — patrz krok 10)

**Interfejsy — produkuje:**

```ts
// src/logika/fazy.ts
export type Faza = 'dzien-gra' | 'dzien-karta' | 'zachod' | 'noc-gra' | 'noc-karta';
export interface StanFaz { faza: Faza; wPelniOd: number; wFazieOd: number }
export const PROG_POKRYCIA = 0.85;      // ile powierzchni WROGA musi byc zakryte
export const CZAS_POTWIERDZENIA = 1;    // ile sekund prog musi sie utrzymac
export const CZAS_KARTY = 3;            // jak dlugo karta stoi sama z siebie
export const CZAS_ZACHODU = 1.5;        // dlugosc animacji zachodu
export const STAN_POCZATKOWY: StanFaz;  // faza 'dzien-gra', oba liczniki zerowe
export function nastepnyStan(stan: StanFaz, pokrycie: number, dt: number): StanFaz;

// src/logika/palety.ts
export type Kolor = [number, number, number];
export function hexNaRgb(hex: string): Kolor;   // rzuca na zly zapis, NIE zwraca NaN
export const PALETA_DZIEN: Record<string, Kolor>;
export const PALETA_NOC: Record<string, Kolor>;
```

Przypisanie kolorów do nazw, dosłownie:

| `PALETA_DZIEN` | | `PALETA_NOC` | |
|---|---|---|---|
| `piasek` | `#caaa9c` | `poduszka` | `#cbcbcc` |
| `piasekCien` | `#c4a69b` | `poduszkaJasna` | `#d4d4d4` |
| `krem` | `#f5e2d3` | `poduszkaCien` | `#c4c4c4` |
| `kremCieply` | `#f3dccd` | `poduszkaGleboka` | `#bbbbbc` |
| `brzoskwinia` | `#f3d4ac` | `lawendaJasna` | `#c9cbea` |
| `brzoskwiniaCien` | `#eccbab` | `lawendaSrednia` | `#c4c4e5` |
| | | `lawendaCiemna` | `#babbdd` |
| | | `lawenda` | `#9b9abd` |

**Zachowanie maszyny faz:**

```
dzien-gra   ──(pokrycie ≥ PROG utrzymane przez CZAS_POTWIERDZENIA)──▶ dzien-karta
dzien-karta ──(CZAS_KARTY spędzone w fazie)──────────────────────────▶ zachod
zachod      ──(CZAS_ZACHODU spędzone w fazie)────────────────────────▶ noc-gra
noc-gra     ──(pokrycie ≥ PROG utrzymane przez CZAS_POTWIERDZENIA)───▶ noc-karta
noc-karta   ── stan końcowy
```

- `wPelniOd` **zeruje się**, gdy pokrycie spadnie poniżej progu; przejście zeruje oba liczniki.
- ⛔ **Histereza jest celowa.** Krem wysycha cały czas, więc tuż po pokazaniu karty pokrycie
  ZAWSZE spada poniżej progu. Bez blokady powrotu karta migałaby w tę i z powrotem. Raz pokazana
  karta zostaje aż do upływu własnego czasu.

- [ ] **Krok 1: Napisz `test/fazy.test.ts` według §Reguły testów**

Wymagane przypadki (nazwy Twoje, treść taka):
1. stan początkowy to `dzien-gra`;
2. pokrycie ponad progiem **krócej** niż `CZAS_POTWIERDZENIA` nie przełącza fazy — czas licz
   zmienną, nie liczbą kroków;
3. spadek pokrycia przed potwierdzeniem zeruje licznik: po spadku i powrocie faza wciąż `dzien-gra`;
4. **kolejność faz** — pędź maszynę drobnym krokiem przy pokryciu 0,9, zbieraj każdą zmianę fazy
   i asertuj, że ciąg unikalnych faz to dokładnie
   `['dzien-gra','dzien-karta','zachod','noc-gra','noc-karta']`;
5. **brak cofania** — pokrycie 0 podane po osiągnięciu `dzien-karta` nie wraca do `dzien-gra`;
6. `dt` większe niż cała faza nie przeskakuje więcej niż jednej fazy na wywołanie.

- [ ] **Krok 2: `npm test` — nowe testy NIE przechodzą** (brak modułu)
- [ ] **Krok 3: Zaimplementuj `src/logika/fazy.ts`**
- [ ] **Krok 4: `npm test` — nowe testy przechodzą**
- [ ] **Krok 5: Napisz `test/palety.test.ts`**

Wymagane przypadki: `hexNaRgb('#ff8000')` daje `[1, 128/255, 0]`; zły zapis (`'#fff'`, `'ff8000'`,
`'#gggggg'`) **rzuca**, a nie zwraca `NaN`; każda nazwa z tabeli ma dokładnie ten kolor;
**żadna składowa żadnej palety nie wychodzi poza `0..1`** — przelot po obu obiektach.

- [ ] **Krok 6: `npm test` — nie przechodzą**
- [ ] **Krok 7: Zaimplementuj `src/logika/palety.ts`**
- [ ] **Krok 8: `npm test` — wszystko przechodzi**
- [ ] **Krok 9: Napisz `scripts/sonda.mjs`**

Kontrakt wiersza poleceń:

```
node scripts/sonda.mjs --url <adres> --skrypt <wyrazenie JS> [--zrzut <plik.png>] [--czekaj <ms>]
```

Zachowanie:
- otwiera **nową kartę** w Chrome pod `127.0.0.1:9222` (`PUT /json/new?<url>`);
- czeka, aż `window.__gotowe === true`, najdłużej `--czekaj` (domyślnie 8000 ms);
- wykonuje `--skrypt` przez `Runtime.evaluate` z `awaitPromise: true, returnByValue: true`;
- wypisuje na standardowe wyjście **wyłącznie JSON** wyniku — bramki będą go parsować, więc
  żadnych ozdobników ani nagłówków;
- przy `--zrzut` zapisuje `Page.captureScreenshot` do podanego pliku;
- **zamyka kartę** (`GET /json/close/<id>`) także wtedy, gdy skrypt rzucił — inaczej po kilku
  bramkach użytkownik ma kilkanaście martwych kart;
- kody wyjścia: `0` sukces, `2` błąd połączenia z CDP, `3` przekroczony limit czasu,
  `4` wyjątek w skrypcie strony.

- [ ] **Krok 10: Dodaj `window.__gotowe = true` w `src/gpu/scena.ts`** po udanej inicjalizacji
      TypeGPU. To jedyna zmiana w tym pliku w tym zadaniu.

- [ ] **Krok 11: BRAMKA**

```bash
npm test
npm run dev & sleep 3
node scripts/sonda.mjs --url http://localhost:5173/rekrutacja2026/ --skrypt \
 '(async()=>{const a=await navigator.gpu.requestAdapter();return {gpu:typeof navigator.gpu,bezpieczny:isSecureContext,adapter:!!a,gotowe:window.__gotowe}})()'
```

Oczekiwane: `npm test` bez błędów; sonda wypisuje JSON, w którym `gpu` to `"object"`,
`bezpieczny` to `true`, `adapter` to `true`, `gotowe` to `true`. Wyjście bramki trafia do
raportu zadania.

- [ ] **Krok 12: Zatwierdzenie** — jednym commitem.

---

## Zadanie B: Maska kremu i licznik pokrycia na GPU

Najbardziej ryzykowne zadanie w projekcie: przypina API TypeGPU dla potoków obliczeniowych
i tekstur składowania. Wszystko dalsze na nim stoi.

**Pliki:**
- Utwórz: `src/gpu/wspolne.ts`, `src/gpu/maska.ts`, `src/gpu/pokrycie.ts`
- Zastąp: `src/gpu/scena.ts` — na razie rysuje **samą maskę** na czarnym tle

**Zweryfikowane w `typegpu@0.12.3`** (odczytane z deklaracji typów zainstalowanego pakietu, ale
**nieuruchomione** — składnię wolno poprawić, jeśli się nie kompiluje, zachowując zachowanie
i odnotowując zmianę w raporcie zadania): `tgpu.computeFn({ in, workgroupSize })`,
`root.createComputePipeline({ compute })`, `.dispatchWorkgroups(x, y)`, `root.createTexture`,
`.$usage(...)`, `.$overrideFlags(flagi)`, `.createView(...)`, `.clear()`,
`d.textureStorage2d(format, access)`, `d.texture2d(d.f32)`, `d.atomic(d.u32)`, `std.textureLoad`,
`std.textureStore`, `std.atomicAdd`, `root.createSampler`, `root.createMutable`.

**Interfejsy — produkuje:**

```ts
// src/gpu/wspolne.ts
export const MASKA_ROZMIAR = 512;
export const Sterowanie = d.struct({
  p0: d.vec2f, p1: d.vec2f,   // poprzednia i biezaca pozycja wskaznika, przestrzen maski 0..1
  promien: d.f32,             // promien pedzla w przestrzeni maski
  maluje: d.f32,              // 1 = wcisniety, 0 = puszczony
  dt: d.f32, zapas: d.f32,
});
export function obszarWroga(uv: v2f): f32;   // 1 wewnatrz wroga, 0 poza — JEDNA definicja

// src/gpu/maska.ts
export interface DaneSterowania {
  p0: [number, number]; p1: [number, number];
  promien: number; maluje: number; dt: number;
}
export class Maska {
  constructor(root: TgpuRoot);
  krok(dane: DaneSterowania): void;
  wyczysc(): void;
  widokDoOdczytu(): TgpuTextureView;   // STALY przez cale zycie — wolno przechwycic raz
}

// src/gpu/pokrycie.ts
export class Pokrycie {
  constructor(root: TgpuRoot, widokMaski: TgpuTextureView);
  krok(): void;
  odczytaj(): Promise<void>;
  readonly ostatnie: number;           // 0..1
}
```

**⛔ STAŁE ROLE TEKSTUR, NIE PING-PONG.** WebGPU nie pozwala w jednym przebiegu czytać i pisać
tej samej tekstury składowania, więc potrzebne są dwie. Ale **klasyczny ping-pong z zamianą ról
co klatkę ma tu pułapkę**: czytelnicy — scena i licznik pokrycia — przechwytują widok RAZ, przy
budowie potoku, więc po zamianie ról czytaliby co drugą klatkę teksturę nieaktualną. Objaw
(migocząca maska i licznik skaczący co klatkę) szukałoby się w shaderze, nie w zarządzaniu
teksturami. Dlatego: **czytamy zawsze A, piszemy zawsze do B, na koniec kroku kopiujemy B→A.**
Jeden potok zamiast dwóch, jeden stały widok dla całej aplikacji, koszt jednej kopii 1 MB
na klatkę (rzędu 0,05 ms).

Flagi przez `$overrideFlags`: A = `TEXTURE_BINDING | COPY_DST`, B = `STORAGE_BINDING | COPY_SRC`.

**Kanały maski:** `r` = grubość kremu `0..1`, `g` = wiek warstwy `0..1`, `b`/`a` nieużywane.
Nałożenie kremu **zeruje `g`** w dotkniętych tekselach — świeża warstwa jest znowu biała i dopiero
„się wchłania". To jest mechanika produktu *skin tone correcting*, nie ozdoba.

**Pędzel liczy odległość od ODCINKA** między poprzednią a bieżącą pozycją wskaźnika. Odciskanie
pojedynczego okręgu na zdarzenie zostawia przy szybkim ruchu kropki zamiast smugi. Funkcja
`odlegloscOdOdcinka` istnieje już w `src/logika/odcinek.ts` — w WGSL powstaje jej **lustro**;
oznacz oba miejsca komentarzem, że zmiana jednego wymaga zmiany drugiego.

**Wysychanie:** od `r` odejmij `dt * (baza + szum(uv) * amplituda)`, poniżej `prog` **utnij ostro
do zera**. Stałe bierz z `STALE_WYSYCHANIA` — nie wpisuj liczb ponownie. Nierówny szum sprawia,
że warstwa **pęka w płatki** zamiast płowieć; równomierne odejmowanie czyta się jak błąd
renderowania, nie jak zasychanie.

**⛔ POKRYCIE LICZY SIĘ PO POWIERZCHNI WROGA, NIE EKRANU.** Krem wolno rozsmarować gdziekolwiek —
to szkło ekranu. Ale gdyby licznik zliczał cały kadr, dałoby się „wygrać" zamalowując puste rogi.
Redukcja liczy **dwie sumy**: teksele wroga i teksele wroga pokryte powyżej progu `0.25`. Wróg to
prostokąt `x ∈ [0.18, 0.82]`, `y ∈ [0.10, 0.90]` w przestrzeni maski. **Wystaw to jako jedną
funkcję `obszarWroga` w `wspolne.ts`** — zadanie C użyje jej do rysowania i dwie kopie rozjechałyby
się po cichu.

**Odczyt na CPU:** bufor pośredni + `mapAsync`, wołane **co 6 klatek**, asynchronicznie. Jedna
klatka opóźnienia nie ma znaczenia dla progu faz, a synchroniczne czekanie zablokowałoby klatkę.

**Wejście:** Pointer Events (`pointerdown`/`move`/`up`/`cancel`) — jedno API dla myszy i dotyku.

- [ ] **Krok 0: NAPRAW ZEPSUTY BUILD** (wada odziedziczona, blokuje zadanie E)

`npm run build` uruchamia `tsc --noEmit && vite build` i **nie przechodzi**: `tsconfig.json` ma
jawną listę `types: ["@webgpu/types", "vite/client"]`, przez co znika domyślne `@types/node`,
a każdy plik testowy importuje `node:test` i `node:assert/strict`. Dziesięć błędów `TS2307`.
Testy przechodzą, bo `tsx` ich nie typuje — więc wada jest niewidoczna aż do wydania.

Napraw: dodaj `@types/node` do `devDependencies` i dopisz `"node"` do listy `types`
w `tsconfig.json`. `npm run build` ma się po tym kończyć bez błędu; poprawka idzie osobnym
commitem, przed resztą zadania.

- [ ] **Krok 1: `src/gpu/wspolne.ts`** — `MASKA_ROZMIAR`, `Sterowanie`, `obszarWroga`
- [ ] **Krok 2: `src/gpu/maska.ts`** — dwie tekstury, potok `malowanie`, kopia B→A, `wyczysc()`
- [ ] **Krok 3: `src/gpu/pokrycie.ts`** — redukcja atomikowa i asynchroniczny odczyt
- [ ] **Krok 4: `src/gpu/scena.ts`** — pełnoekranowy trójkąt, fragment pokazujący kanał `r` maski
      jako biel na czerni; obsługa wskaźnika; pętla klatki; `window.__gotowe`
- [ ] **Krok 5: Wystaw `window.__sonda`** — obiekt diagnostyczny dla bramek:

```ts
window.__sonda = {
  pokrycie: () => number,                    // 0..1, ostatni odczyt
  pociagnij: (x0, y0, x1, y1, krokow = 20) => void,   // syntetyczne malowanie, przestrzen 0..1
  czysc: () => void,                         // czysci maske
};
```

`pociagnij` ma wpisywać kolejne pary `p0`/`p1` tak, jak robiłby to prawdziwy wskaźnik — inaczej
bramka testowałaby coś innego niż gra.

- [ ] **Krok 6: BRAMKA — trzy asercje, każda osobno**

```bash
npm run dev & sleep 3
# 1. Malowanie w SRODKU podnosi pokrycie
node scripts/sonda.mjs --url http://localhost:5173/rekrutacja2026/ --skrypt \
 '(async()=>{__sonda.czysc();await new Promise(r=>setTimeout(r,300));const przed=__sonda.pokrycie();__sonda.pociagnij(0.25,0.2,0.75,0.8);__sonda.pociagnij(0.25,0.8,0.75,0.2);await new Promise(r=>setTimeout(r,400));return {przed,po:__sonda.pokrycie()}})()'
# 2. Po kilku sekundach bez malowania pokrycie SPADA (krem schnie)
node scripts/sonda.mjs --url http://localhost:5173/rekrutacja2026/ --czekaj 12000 --skrypt \
 '(async()=>{__sonda.pociagnij(0.25,0.2,0.75,0.8);await new Promise(r=>setTimeout(r,400));const zaraz=__sonda.pokrycie();await new Promise(r=>setTimeout(r,6000));return {zaraz,po6s:__sonda.pokrycie()}})()'
# 3. Malowanie w ROGU nie rusza licznika
node scripts/sonda.mjs --url http://localhost:5173/rekrutacja2026/ --skrypt \
 '(async()=>{__sonda.czysc();await new Promise(r=>setTimeout(r,300));const przed=__sonda.pokrycie();__sonda.pociagnij(0.02,0.02,0.10,0.06);await new Promise(r=>setTimeout(r,400));return {przed,po:__sonda.pokrycie()}})()'
```

Oczekiwane: (1) `po > przed + 0.2`; (2) `po6s < zaraz * 0.5`; (3) `|po - przed| < 0.01`.
Wyjście wszystkich trzech trafia do raportu zadania. Jeśli któraś nie wychodzi — strojenie liczb
nie jest odpowiedzią, przyczyna leży gdzie indziej.

- [ ] **Krok 7: Zatwierdzenie**

---

## Zadanie C: Scena dnia

**Pliki:**
- Zmodyfikuj: `src/gpu/scena.ts` (fragment — pełna scena), `src/gpu/wspolne.ts` (uniform + ACES)
- Utwórz: `src/gpu/wskaznik.ts` (wydzielenie warstwy wskaźnika — patrz C0a)

**Interfejsy — produkuje:**

```ts
// src/gpu/wspolne.ts
export const Scena = d.struct({
  czas: d.f32,
  proporcja: d.f32,    // szerokosc/wysokosc kanwy — bez tego kolo jest elipsa
  faza: d.f32,         // 0 = dzien, 1 = noc, wartosci posrednie = zachod
  pokrycie: d.f32,
  podpowiedz: d.f32,
});
export const aces: (kolor: v3f) => v3f;   // przyblizenie ACES
```

**Co ma być widać:**

- **Wróg** — telefon jako prostokąt z zaokrąglonymi rogami (SDF), w obszarze zwracanym przez
  `obszarWroga`. Wypala kadr jasną, ciepłą bielą; wokół poświata.
- **Blask słabnie tam, gdzie leży krem** — to cała mechanika w jednej linijce: moc przemnożona
  przez `(1 - grubosc)`.
- **Chmurka** — miękki kształt SDF na środku (trzy zlane koła wystarczą). Bez ochrony czerwienieje
  i grymasi, pod kremem blednie do bieli. **To zwykła chmurka, nie znak marki** — nie odtwarzaj
  logotypu ani nie stylizuj jej na wordmark.
- **Krem** — biały świeży, dojrzewa do `kremCieply` w funkcji kanału `g`. Krawędzie pęknięć
  (grubość tuż nad progiem) ciemniejsze.
- **Tło** — gradient `piasek` → `krem`, akcent `brzoskwinia` w poświacie.
- **Tonowanie ACES na końcu.** Proste `x/(x+1)` spłaszcza rozbłysk do szarości, a przepalone
  słońce ma zostać ciepłe.

Ciała shaderów piszesz sam — plan podaje zachowanie i wartości, bo strojenie SDF-a i wag jest
rzemiosłem, którego nie da się sensownie podyktować z góry. **Wszystkie kolory muszą pochodzić
z `PALETA_DZIEN`; żadnych literałów kolorów w shaderze.**

### Trzy rzeczy do naprawy zastanego kodu, zanim dołożysz scenę

Wyszły z recenzji zadania B i z przeglądu zastanego kodu. Wszystkie trzy są **tańsze teraz** niż po
dołożeniu pełnej sceny.

**C0a. Wyjmij warstwę wskaźnika z `scena.ts` do osobnego modułu** (`src/gpu/wskaznik.ts` albo
podobnie). `scena.ts` ma dziś 194 linie i trzyma potok renderujący, obsługę wskaźnika, kolejkę
odcinków, `ResizeObserver`, pętlę klatki, HUD i `window.__sonda`. Ty dokładasz do tego paletę,
wroga, chmurkę i krem; zadanie D dołoży fazy i karty. Warstwa wskaźnika wychodzi stąd najczyściej
i bez ryzyka — zrób to **pierwszym krokiem**, zanim plik urośnie.

**C0b. Napraw proporcje pędzla.** Maska jest dziś rozciągana na cały kadr bez korekty, więc na
szerokim ekranie **pędzel jest elipsą, nie kołem** — widać to gołym okiem na zrzucie świeżej
maski (zrzut poza repozytorium). Uniform `Scena` wprowadza pole `proporcja` właśnie po to.
Korekta może siedzieć przy odciskaniu pędzla albo przy mapowaniu maski na ekran — obie drogi
działają, ale mają różne skutki dla licznika pokrycia, więc wybór wymaga uzasadnienia.

**C0c. Kanał `g` dostaje w tym zadaniu pierwszy prawdziwy sprawdzian.** Zadanie B liczy wiek
warstwy poprawnie, ale nic go nie renderowało. Twoja scena zamienia go na kolor — świeży krem
biały, dojrzały ciepły. **Bramka musi to pokazać liczbą**, nie tylko na zrzucie: patrz krok 5.

- [ ] **Krok 1: Uniform `Scena` i funkcja `aces` w `wspolne.ts`**
- [ ] **Krok 2: SDF telefonu i chmurki, oparte na `obszarWroga`**
- [ ] **Krok 3: Fragment — tło, wróg, poświata, chmurka, krem, ACES**
- [ ] **Krok 4: Rozszerz `window.__sonda` o `jasnosc()`**

Zwraca `0..1` — średnią luminancję **obszaru wroga**. Licz ją w JS: przerysuj kanwę do
`OffscreenCanvas` przez `drawImage` i uśrednij piksele tego obszaru. To musi być liczba, bo bramka
ma asertować, a nie oglądać.

⚠️ Jeśli `drawImage` z kanwy WebGPU zwróci pusty obraz (kontekst bez zachowanego bufora), **nie
kombinuj z flagami kanwy** — zamiast tego licz luminancję po stronie Node'a: sonda i tak robi
`Page.captureScreenshot`, więc wystarczy uśrednić piksele zapisanego PNG. Wybrana droga i jej
powód trafiają do raportu zadania.

- [ ] **Krok 5: BRAMKA**

```bash
npm run dev & sleep 3
node scripts/sonda.mjs --url http://localhost:5173/rekrutacja2026/ --zrzut /tmp/scena-dzien.png --skrypt \
 '(async()=>{__sonda.czysc();await new Promise(r=>setTimeout(r,400));const jasno=__sonda.jasnosc();__sonda.pociagnij(0.22,0.15,0.78,0.85);__sonda.pociagnij(0.22,0.85,0.78,0.15);__sonda.pociagnij(0.22,0.5,0.78,0.5);await new Promise(r=>setTimeout(r,400));return {przedZakryciem:jasno,poZakryciu:__sonda.jasnosc(),pokrycie:__sonda.pokrycie()}})()'
```

Oczekiwane: `poZakryciu < przedZakryciem` — zakrycie kremem **musi** przygasić wroga.

**Druga bramka, na dojrzewanie kremu (kanał `g`):** zmierz barwę świeżej warstwy i tej samej
warstwy po ~1,5 s. Świeża ma być **chłodniejsza i jaśniejsza**, dojrzała **cieplejsza** — czyli
różnica `R − B` próbki ma wyraźnie wzrosnąć. Wystaw w `__sonda` hak zwracający uśrednioną barwę
zadanego wycinka kadru i zaasertuj na tej różnicy, nie na oko.

Raport zadania niesie JSON obu bramek i **ścieżki zrzutów** (świeży i dojrzały krem osobno) —
zrzuty ogląda się przy odbiorze.

⚠️ **Warunek odbioru wizualnego:** zadanie nie jest odebrane, jeśli po wyschnięciu warstwa
**rozmywa się zamiast pękać**, albo jeśli krem nie zmienia widocznie odcienia. Zadanie B
zostało z tego powodu odbite raz — bramki liczbowe mierzą, ile ubyło, nie jak to wygląda.

- [ ] **Krok 6: Zatwierdzenie**

---

## Zadanie D: Fazy, zachód, scena nocy i karty produktowe

**Pliki:**
- Zmodyfikuj: `src/gpu/scena.ts`, `index.html`
- Utwórz: `src/ui/karta.ts`

**Przejście dzień→noc jest fabularne, nie przełącznikiem:** zakryte słońce **zachodzi**, paleta
przechodzi z piaskowej w lawendową, maska się czyści, a w ciemności zaczyna świecić ten sam
telefon — tyle że **na zimno**. Pole `faza` uniformu idzie `0 → 1` przez czas trwania zachodu.

**Różnice nocy:** blask zimny błękitny zamiast ciepłej bieli; tło z `PALETA_NOC`; krem dojrzewa
do `lawendaJasna` (świeci perłowo) zamiast do beżu; winieta mocniejsza.

**Karty produktowe — treść dosłownie ze specu §7:**

| | dzień | noc |
|---|---|---|
| obraz | `assets/produkt-dzien-spf50.webp` | `assets/produkt-noc-sleeping.webp` |
| nagłówek | `Twoja tarcza przed UV` | `Ekran świeci, Ty regenerujesz` |
| tekst | `Krem SPF 50 wyrównujący koloryt — nakładasz na biało, dopasowuje się do Twojej cery.` | `Sleeping Cream z pyłem księżycowym — z Synchrolife™, chroni przed światłem niebieskim z telefonów i laptopów.` |
| odnośnik | `https://fluff.com.pl/krem-spf-50-wyrownujacy-koloryt-skory-50ml` | `https://fluff.com.pl/produkty/krem-sleeping-na-dobranoc` |
| przyciski | `Zobacz w sklepie →` | `Zobacz w sklepie →` oraz `zagraj jeszcze raz` |

Karta wjeżdża **na uspokojoną scenę**, nie zastępuje jej. `zagraj jeszcze raz` wraca do
`STAN_POCZATKOWY` i czyści maskę.

- [ ] **Krok 1: Wepnij `nastepnyStan` w pętlę klatki; policz `faza` liczbowo**
- [ ] **Krok 2: Zmieszaj palety dnia i nocy po `faza`; zimny blask nocą**
- [ ] **Krok 3: `src/ui/karta.ts` plus kontener i style w `index.html`**
- [ ] **Krok 4: Rozszerz `window.__sonda`** o `faza()` — bieżąca faza jako napis — oraz
      `przewin(sekundy)`, które dopycha maszynę faz o zadany czas **bez czekania na zegar**.
      Bez tego bramka trwałaby kilkanaście sekund na przebieg.
- [ ] **Krok 5: BRAMKA — kolejność faz i zawartość karty**

```bash
npm run dev & sleep 3
node scripts/sonda.mjs --url http://localhost:5173/rekrutacja2026/ --zrzut /tmp/scena-noc.png --skrypt \
 '(async()=>{const w=[];const z=()=>{const f=__sonda.faza();if(w[w.length-1]!==f)w.push(f)};z();for(let i=0;i<400;i++){__sonda.pociagnij(0.22,0.15,0.78,0.85);__sonda.przewin(0.05);z()}await new Promise(r=>setTimeout(r,600));const k=document.querySelector("#karta");return {widziane:w,kartaWidoczna:!!k&&!k.hidden,naglowek:k?.querySelector("h2")?.textContent,obraz:k?.querySelector("img")?.getAttribute("src")}})()'
```

Oczekiwane: `widziane` to dokładnie `["dzien-gra","dzien-karta","zachod","noc-gra","noc-karta"]`;
`kartaWidoczna` to `true`; `naglowek` to `Ekran świeci, Ty regenerujesz`; `obraz` wskazuje plik
nocny. Raport zadania niesie JSON i ścieżkę zrzutu.

- [ ] **Krok 6: BRAMKA — dwie bitmapy i ani jednej więcej**

```bash
node scripts/sonda.mjs --url http://localhost:5173/rekrutacja2026/ --skrypt \
 '(async()=>{await new Promise(r=>setTimeout(r,1500));return performance.getEntriesByType("resource").map(e=>e.name).filter(n=>/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(n))})()'
```

Oczekiwane: **dokładnie dwa** wpisy, oba z `assets/`, żadnego wordmarku.

- [ ] **Krok 7: Zatwierdzenie**

---

## Zadanie E: Podpowiedź, przyrząd pomiarowy i wydanie

**Pliki:**
- Utwórz: `src/ui/podpowiedz.ts`, `.github/workflows/deploy.yml`
- Zmodyfikuj: `src/gpu/scena.ts`, `src/gpu/wspolne.ts`, `README.md`
- Test: `test/podpowiedz.test.ts`

**Interfejsy — produkuje:**

```ts
export const PROG_PODPOWIEDZI = 2;   // sekundy bezczynnosci
export function czyPokazacPodpowiedz(bezczynnoscSek: number, malowal: boolean): boolean;
```

Podpowiedź pokazuje się **tylko graczowi, który jeszcze nic nie namalował** — kto raz zrozumiał
gest, nie potrzebuje przypomnienia, a powtarzana podpowiedź zaczyna przeszkadzać. Rysuj ją
w shaderze jako wędrujące w poziomie koło („duchowe muśnięcie palcem"), sterowane polem
`podpowiedz` uniformu.

**Przyrząd:** `window.__pomiar()` zwraca `{ pokrycie, faza, msKlatki }`, gdzie `msKlatki` to
średnia z ostatnich 60 klatek. Ten sam wzorzec co we wcześniejszym prototypie WebGPU: istnieje
po to, żeby dało się **zmierzyć** zachowanie zamiast oceniać je na oko.

- [ ] **Krok 1: Testy `czyPokazacPodpowiedz`** — przed progiem nie; po progu tak; po pierwszym
      malowaniu **nigdy więcej**
- [ ] **Krok 2: Implementacja i rysowanie podpowiedzi w shaderze**
- [ ] **Krok 3: `window.__pomiar()`**
- [ ] **Krok 4: `base` w `vite.config.ts`** — `/rekrutacja2026/`, czyli nazwa repozytorium.
      ⚠️ Zmienione w zadaniu E: przedrostek żyje teraz w jednym miejscu (`scripts/adres.mjs`),
      a `vite.config.ts` i wszystkie bramki go stamtąd importują. Wcześniej ta sama ścieżka była
      wpisana na sztywno w czterech plikach i każda zmiana miejsca wdrożenia rozjeżdżała je po cichu.
- [ ] **Krok 5: `npm run build` przechodzi** (`tsc --noEmit` + `vite build`); `npm run preview`
      działa tak samo jak tryb deweloperski
- [ ] **Krok 6: `.github/workflows/deploy.yml`** — wyzwalacze `push` na `main`
      i `workflow_dispatch`; kroki: `npm ci`, `npm test`, `npm run build`,
      `actions/upload-pages-artifact` z katalogiem `dist`, `actions/deploy-pages`.
      Uprawnienia: `pages: write`, `id-token: write`.
- [ ] **Krok 7: README** — czym to jest, adres demo (wstaw po wdrożeniu), wymóg WebGPU, dlaczego
      TypeGPU, jak uruchomić, odnośniki do `docs/`, nota o pochodzeniu grafiki.
      **Usuń z `docs/` wzmianki o wewnętrznej nazwie wcześniejszego prototypu** — dla czytelnika zgłoszenia
      to odwołanie do projektu, którego nie widzi. Pisz „wcześniejszy prototyp WebGPU".
- [ ] **Krok 8: BRAMKA**

```bash
npm test
npm run build
npm run preview & sleep 3
node scripts/sonda.mjs --url http://localhost:4173/rekrutacja2026/ --skrypt \
 '(async()=>{return {gotowe:window.__gotowe, pomiar:window.__pomiar()}})()'
```

Oczekiwane: testy zielone, build bez błędów, sonda zwraca `gotowe: true` i sensowny `msKlatki`.

- [ ] **Krok 9: Zatwierdzenie**

Utworzenie repozytorium zdalnego i włączenie GitHub Pages dzieje się **poza planem** — to
działanie na zewnątrz tego katalogu.

---

## Przegląd planu względem specu

| wymaganie specu | gdzie |
|---|---|
| §2 mechanika smarowania, wysychanie i pękanie | B |
| §2 dwie fazy dzień/noc, dwa produkty | A, D |
| §3 bramka WebGPU z dokładnym komunikatem | wykonane (`62b01ea`) |
| §3 brak dźwięku, brak fallbacku | ograniczenia globalne |
| §4 trzy potoki, dwie tekstury maski, kanały `r`/`g` | B, C |
| §4.2 pędzel po odcinku | wykonane (`0069b1f`) + lustro WGSL w B |
| §4.3 wysychanie z szumem i ostrym progiem | wykonane (`0069b1f`) + shader w B |
| §4.4 pokrycie liczone po powierzchni wroga | B, bramka 3 |
| §4.5 odczyt `mapAsync` co 6 klatek | B |
| §5 maszyna faz z histerezą, zachód, podpowiedź | A, D, E |
| §6 palety zmierzone, grafika proceduralna, ACES | A, C, D |
| §7 karty produktowe z treścią dosłowną | D, bramka 5 |
| §8 tylko dwie zatwierdzone bitmapy, brak wordmarku | D, bramka 6 |
| §9 czego nie budujemy | ograniczenia globalne |
| §10 testy jednostkowe i sonda | A, E |
| §11 Vite, GitHub Pages, README | E |

**Znane ryzyko:** API TypeGPU dla potoków obliczeniowych i tekstur składowania jest odczytane
z deklaracji typów, nie uruchomione. Zadanie B je przypina — jeśli nazwa okaże się inna, poprawka
idzie tam i do tego dokumentu, nie w obejście w kolejnych zadaniach.
