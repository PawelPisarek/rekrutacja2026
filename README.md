# Fluff kontra Słońce

Interaktywny dodatek do strony marki kosmetycznej, napisany w **TypeGPU / WebGPU**.

**Demo na żywo: https://pawelpisarek.github.io/rekrutacja2026/**
Strona **wymaga przeglądarki z WebGPU** — bez niej zobaczysz sam komunikat, a nie pustą
stronę ani awarię (powód niżej).

## Czym to jest

Kafel wielkości karty produktu (~420 px), wstawiony **w kolumnę tekstu** — nie pełnoekranowa
scena, która stronę marki zasłania. Nad chmurką świeci rozpalona powierzchnia; chmurka mruży
ciemne oczy i krzywi się. Rozsmarowujesz po jej czole krem palcem albo myszą: tam, gdzie leży
warstwa, blask gaśnie, a mina się rozluźnia.

Krem **wysycha i pęka** w nierówne płatki, więc ochrona nie jest jednorazowa — trzeba domalowywać.
To jest cały hak: „filtr trzeba nakładać ponownie” jest tu mechaniką, a nie hasłem.

Nikt nie mówi Ci tego napisem: kto przez chwilę nic nie zrobi, zobaczy nad czołem chmurki
**duchowe muśnięcie palcem** wędrujące tam i z powrotem — pokazuje gest dokładnie w tym miejscu,
w którym malowanie w ogóle się liczy. Znika przy pierwszym pociągnięciu i nie wraca już nigdy,
bo przerwa jest tu **częścią mechaniki** (krem schnie sam, więc czekanie bywa świadome) i
podpowiedź wracająca w tym momencie mówiłaby graczowi, że robi coś źle.

Po zakryciu czoła wjeżdża karta produktu, potem zachód słońca i faza nocna z drugim produktem —
tam wrogiem jest niebieskie światło ekranu, a nie słońce.

## Wymóg: WebGPU

Rzecz działa **wyłącznie na przeglądarce z WebGPU** — w praktyce Chrome i Edge. Bez niej strona
pokazuje jeden komunikat i nic nie rysuje. To decyzja, nie przeoczenie: fallback na Canvas2D
oznaczałby drugą implementację całej sceny, która i tak nie umiałaby tego, co jest tu sednem
(niżej). Lepszy uczciwy komunikat niż uboga podróbka.

⚠️ WebGPU wymaga **bezpiecznego kontekstu** — `https://`, `http://localhost` albo `http://127.0.0.1`.
Na `about:blank` `navigator.gpu` jest `undefined` z definicji, niezależnie od sprzętu.

## Dlaczego TypeGPU, a nie Canvas2D

Nie dla efektu wizualnego — dla **struktury obliczeń**. Dwie rzeczy dzieją się w każdej klatce
na GPU i obie na CPU byłyby wąskim gardłem:

1. **Maska kremu w potoku obliczeniowym.** Warstwa żyje w teksturze 512×512 `rgba16float`:
   kanał `r` to grubość, `g` to wiek (świeży → wchłonięty). Pędzel odciska się po **odcinku**
   między dwiema pozycjami wskaźnika (nie po pojedynczym okręgu — przy szybkim ruchu zostawiałby
   kropki zamiast smugi), a wysychanie odejmuje w tym samym przebiegu grubość z szumem, więc
   warstwa **pęka w płatki**, zamiast równomiernie płowieć. To 262 144 tekseli aktualizowanych
   ~60 razy na sekundę.

2. **Redukcja pokrycia.** Mechanika pyta „jaka część czoła chmurki jest zakryta” — czyli o sumę
   po całej masce, sprowadzoną do jednej liczby. Robi to drugi potok obliczeniowy z operacjami
   atomowymi; na CPU trzeba by w każdej klatce **odczytać piksele** (`getImageData`) i przelecieć
   je pętlą. To jest dokładnie ten wzorzec, który zabija płynność w Canvas2D: transfer
   GPU→CPU plus pętla po ćwierci miliona pikseli, w każdej klatce.

Z całej sceny nic nie jest bitmapą: chmurka, jej mina, przepalone jądro światła, drganie
powietrza, winieta i materiał warstwy kremu (półprzezroczystość, mokry połysk, rant grubości)
to funkcje SDF liczone we fragmencie.

**Co daje TypeGPU ponad samo WebGPU:** shadery są zwykłymi funkcjami TypeScriptu (`tgpu.fn`,
`d.vec2f`, `std.mix`), więc typy layoutu bufora i uniformu są sprawdzane przez `tsc`, a nie
odkrywane jako czarny ekran w czasie działania. Wprost widać to na regułach lustrzanych: SDF
chmurki istnieje w dwóch wersjach — testowalnej bez GPU (`src/logika/chmurka.ts`) i shaderowej
(`src/gpu/wspolne.ts`) — i obie są zwykłym TypeScriptem, więc rozjazd między nimi jest
porównaniem dwóch funkcji, a nie ręcznym czytaniem WGSL-a obok TS-a.

## Jak uruchomić

```bash
npm ci
npm run dev        # http://localhost:5173/rekrutacja2026/
```

```bash
npm test           # logika bez GPU (node --test + tsx)
npm run build      # tsc --noEmit && vite build
npm run preview    # http://localhost:4173/rekrutacja2026/
```

⚠️ Adres zawiera przedrostek `/rekrutacja2026/` (nazwa repozytorium, `base` Vite'a pod GitHub
Pages). Bez niego serwer deweloperski odda 404. Przedrostek żyje w **jednym** miejscu —
`scripts/adres.mjs` — a `vite.config.ts` i wszystkie bramki go stamtąd importują.

### Przyrządy pomiarowe

Strona wystawia dwa haki, żeby jej zachowanie dało się **zmierzyć**, a nie ocenić na oko:

```js
window.__pomiar()   // { pokrycie, faza, msKlatki, klatek, odOstatniejMs, bledow }
window.__sonda      // sterowanie sceną dla bramek: malowanie, próbki maski, barwa,
                    // przewijanie faz, przypięcie fazy i czasu sceny
```

⚠️ `msKlatki` (średnia z 60 klatek) **sama nie odróżnia żywej pętli od martwej** — gdy pętla
stanie, średnia zamarza na ostatniej wartości i pokazuje wzorowe 16,7 ms. Dlatego obok niej stoją
`klatek` (obroty `requestAnimationFrame` od załadowania) i `odOstatniejMs` (jak dawno pętla
tyknęła): dwa odczyty tych liczb odpowiadają na pytanie „czy to jeszcze się rusza” bez
interpretowania czegokolwiek.

HUD deweloperski (`pokrycie 91.3% dzien-gra`) jest **domyślnie zgaszony**; zapala go `?hud`
w adresie albo tryb deweloperski, gasi jawne `?hud=0`.

Bramki wizualne sterują **prawdziwym** Chrome przez protokół DevTools (`127.0.0.1:9222`),
bez Puppeteera i Playwrighta — mierzą tę przeglądarkę, w której rzecz naprawdę działa:

```bash
node scripts/bramka-fazy.mjs        # kolejność faz i zawartość karty produktowej
node scripts/bramka-bitmapy.mjs     # dokładnie dwie bitmapy w całym projekcie
node scripts/bramka-blask.mjs       # krem przygasza blask — z kontrolą negatywną
node scripts/bramka-podpowiedz.mjs  # podpowiedź gestu jest widoczna i wędruje po czole
```

Każda przyjmuje `--url <adres>` albo `--podglad` (mierzy `npm run preview` zamiast serwera
deweloperskiego, bez przepisywania przedrostka z palca).

Ostatnia z nich mierzy **przechył plamy między dwoma końcami toru**, a nie średnią jasność —
średnia jasność rośnie tak samo, gdy podpowiedź jest czytelnym wędrującym muśnięciem, jak wtedy,
gdy jest równomierną poświatą nieznaczącą nic, więc bramka oparta o nią nagradzałaby podkręcenie
jednej stałej zamiast pilnować gestu. Fazę animacji bramka **przypina** (`__sonda.ustawCzas`),
bo duch jest funkcją czasu i próbka z losowej chwili daje losową odpowiedź.

Piąty plik pomiarowy, `scripts/luminancja-png.mjs`, nie jest bramką, tylko przyrządem: liczy
średnią luminancję prostokąta w zapisanym zrzucie PNG.
Istnieje obok haka `__sonda.jasnosc()`, bo tamten liczy tę samą funkcję sceny co fragment, więc
**z definicji nie widzi**, czy potok renderujący w ogóle rysuje — a ten mierzy piksele, które
naprawdę poszły na ekran. Dwie miary zawodzą z różnych powodów i dopiero razem coś znaczą.

## Dokumentacja

- [`docs/design.md`](docs/design.md) — koncepcja, architektura, przyjęte ograniczenia,
  uzasadnienia decyzji wizualnych i to, czego świadomie **nie** budujemy.
- [`docs/plan-wdrozenia.md`](docs/plan-wdrozenia.md) — **dziennik roboczy, nie dokumentacja
  produktu**: instrukcja dla wykonawcy, po której ten projekt powstawał, z polami wyboru,
  kryteriami akceptacji i bramką wymaganą dla każdego zadania. Zostaje w repozytorium, bo pokazuje,
  że bramki były zdefiniowane **przed** kodem, a nie dorobione do gotowego wyniku — ale czyta się
  go jak proces, nie jak opis rzeczy. Opis rzeczy jest wyżej i w `docs/design.md`.

## Pochodzenie grafiki

W całym projekcie są **dokładnie dwie bitmapy** i obie to oficjalne rendery ze sklepu marki
(karty produktowe): `assets/produkt-dzien-spf50.webp` i `assets/produkt-noc-sleeping.webp`.
Pilnuje tego automatyczna bramka, która liczy zasoby graficzne pobrane przez przeglądarkę —
nie pliki w repozytorium.

Cała reszta jest **proceduralna**: postać (leżąca kapsuła), twarz, symbol nieba
(słońce/księżyc), światło, krem, tło. Postać jest zwykłym kształtem geometrycznym i nie udaje
znaku marki ani żadnej istniejącej maskotki. Wordmarku `flüff` **nie odtwarzaliśmy własną
grafiką** — widać go wyłącznie tam, gdzie jest częścią oficjalnego renderu opakowania, czyli na
dwóch zdjęciach produktowych wyżej. Palety kolorów są **zmierzone z opakowań** ze sklepu —
nie dobrane (`src/logika/palety.ts`).

## Licencja

Projekt rekrutacyjny. Zdjęcia produktów należą do właściciela marki i są tu użyte wyłącznie
w celu prezentacji koncepcji.
