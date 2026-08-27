# Fluff kontra Słońce — design

**Data:** 2026-08-27
**Status:** zatwierdzony, przed planem wdrożenia

---

## 1. Po co to jest

Zadanie rekrutacyjne nr 2: *„Wymyśl i przygotuj prosty prototyp interaktywnego dodatku do
strony marki Fluff, skierowanego do generacji Z i Alfa. Rozwiązanie powinno pasować do
charakteru marki, angażować użytkownika i wspierać zainteresowanie produktami lub sprzedaż."*

Odpowiedź: osadzalny na stronie baner-zabawka, w którym gest rozsmarowywania kremu **jest**
komunikatem produktowym, a nie ozdobą wokół niego.

## 1a. Czym to jest fizycznie: KAFEL NA STRONIE, nie pełny ekran

⛔ **To jest dodatek osadzany w sekcji strony, nie samodzielna scena na pełny ekran.** Brief mówi
wprost: *„interaktywnego dodatku do strony marki Fluff"*. Pierwsza wersja implementacji zjechała
w stronę pełnoekranowego obrazu z wymyślonym pokojem w tle — czyli czegoś, co stronę marki
**zasłania**, zamiast na niej siedzieć. Wykryte 2026-08-27 po obejrzeniu zrzutów.

Konsekwencje, które obowiązują cały dalszy projekt:

- **Rozmiar:** kafel wielkości karty produktu, wstawiany w kolumnę treści. Szerokość maksymalna
  rzędu 420 px, proporcja bliska kwadratowi, responsywnie w dół. Nigdy `100vw`/`100vh`.
- **Tło sceny znika.** Gruntem jest strona, nie wymyślony pokój. Kafel ma własne, ciasne tło
  wyłącznie w obrębie swojej ramki.
- **Ramka przestaje udawać telefon.** W pierwszej wersji prostokąt z zaokrąglonymi rogami miał
  być „telefonem-słońcem" — ale użytkownik ogląda to **na telefonie**, więc rysowanie telefonu
  w telefonie jest o jeden poziom za daleko i żart nie ląduje. Kafel jest po prostu polem
  do zabawy: świecącą powierzchnią, którą się smaruje.
- **Strona-gość do demo** budowana wyłącznie z zatwierdzonych zdjęć produktów i prawdziwych
  tekstów marki, oszczędnie i neutralnie. **Nie odtwarzamy layoutu ani identyfikacji Fluffa** —
  to byłoby wymyślanie wyglądu marki, czego reguła zasobów zabrania (§8).

## 2. Koncepcja

Wrogiem jest **ekran telefonu**. Gracz broni się kremem Fluffa. Rzecz ma dwie fazy, płynnie
przechodzące jedna w drugą:

| | wróg | krem | co dzieje się pod palcem |
|---|---|---|---|
| **DZIEŃ** | telefon-słońce wypala kadr | SPF 50 wyrównujący koloryt (tubka) | biała maź **zmienia odcień na kolor skóry** |
| **NOC** | telefon świeci zimnym niebieskim światłem w ciemnym pokoju | Sleeping Cream z pyłem księżycowym (słoiczek) | maź **świeci perłowo** i gasi niebieski blask |

Krem **wysycha i pęka** po kilku sekundach, więc trzeba domalowywać. To jedyna mechanika
i jednocześnie prawdziwy komunikat: filtr trzeba reaplikować.

Postać: chmurka na środku kadru, która smaży się bez ochrony i uspokaja pod kremem.

## 2a. Celem malowania jest CHMURKA, a nie kafel

⛔ **Obszarem liczonym jest górna powierzchnia chmurki — jej czoło — a nie prostokąt na cały
kafel.** Wykryte 2026-08-27 po obejrzeniu wersji z zadania C2: użytkownik zgłosił, że malowanie
palcem zasłania mu maskotkę. Gdy licznik zliczał cały kafel, gracz wodził dłonią po całej powierzchni i zasłaniał
sobą dokładnie tę rzecz, która jest nagrodą za malowanie.

Konsekwencje obowiązujące dalej:

- **Postać jest dużym elementem kafla, osadzonym nisko** — dominuje, a nie zdobi środek.
  Sylwetka 0,78 × 0,32 przestrzeni maski, spód płaski, a górna krawędź to **jedna ciągła krzywa**:
  leżąca kapsuła (odcinek + promień), nie zlepek garbów. ⛔ Poprzedni obrys — duży garb pośrodku
  nad dwoma niższymi po bokach — został **zgłoszony jako budzący niezamierzone skojarzenia**, a przyczyna
  była strukturalna, nie w doborze promieni: trzy garby o różnej wysokości zawsze układają się
  w tę sylwetkę. Twarz: **dwoje małych ciemnych oczu** (mrużą się ze spiekiem) i kreska ust pod
  nimi. ⛔ Gogle z zadania F — soczewki, rant i mostek — **wypadły w całości** na wyraźne życzenie
  użytkownika, który zgłosił, że woli proste ciemne oczy sprzed tamtej zmiany; kształt
  kapsuły został.
- **Punkty daje krem, który wylądował na CAŁEJ sylwetce.** Rozsmarować wolno gdziekolwiek —
  to dalej świecąca powierzchnia — ale liczy się to, co wylądowało na postaci. ⛔ Między zadaniem
  C2 a 2026-08-28 liczył się wyłącznie **wąski pas czoła**, żeby dłoń pracowała nad oczami i mina
  została widoczna. Rozwiązało to zasłanianie i **stworzyło gorszy problem**: gra przestała
  reagować na gest, który człowiek wykonuje bez instrukcji. Zmierzone sondą na żywej scenie
  (`scripts/mierz-gesty.mjs`, mianownik = czoło): poziomo przez środek kafla **0,000**, krzyż przez
  cały kafel 0,126, bazgranie po kaflu **0,711 — progu 0,85 nie dotyka ani razu**, celnie w pas
  czoła 1,000. Trafiał więc tylko ten, kto **wiedział** o pasie czoła. Dziś obszarem liczonym jest
  cała sylwetka, a czytelność miny niesie **materiał warstwy** (krycie nigdy nie dochodzi do 1),
  nie geometria obszaru.
- **Mianownik pokrycia szedł 70,6% maski → 2,38% (czoło chmurki) → 8,55% (czoło kapsuły) →
  22,86% (cała kapsuła)**, więc progi bramek trzeba **przeliczać pomiarem, a nie przepisywać** —
  pomiary przy `PROG_POKRYCIA` w `src/logika/fazy.ts`. Geometria jest dobrana tak, żeby **jednym
  poziomym pociągnięciem nie dało się domknąć rundy przy żadnym ułożeniu**: zmierzone maksimum to
  **0,299 przy progu 0,55** (test „jeden poziomy przejazd nie domyka progu pokrycia"), a dwa
  przejazdy dają 0,576, czyli już domykają. Poszerzenie obszaru **wzmocniło** ten niezmiennik:
  stosunek „ile daje jeden ruch" do progu spadł z 0,88 na 0,54.

## 2b. Zagrożenie niesie natężenie, nie odcień

⛔ **Żadnej barwy spoza `PALETA_DZIEN` i `PALETA_NOC`.** Zadanie C2 wpuściło na chwilę osobną
listę barw „dobranych" (żółty rdzeń, pomarańczowe obrzeża, czerwień spieku) pod uzasadnieniem, że
wróg i maskotka nie mówią niczego o produkcie. Użytkownik obejrzał wynik i zgłosił, że woli kolory
z palety, a scena jest zbyt czerwona i pomarańczowa. Lista wypadła razem
z funkcją, która ją wpuszczała.

Zagrożenie budują odtąd: przepalenie do bieli w rdzeniu (jasność powyżej 1 przed tonowaniem ACES),
kontrast jasności między rozpaloną powierzchnią a chłodnym kremem, drganie powietrza nad polem,
winieta zacieśniająca się przy niskim pokryciu oraz **mina** chmurki. Chmurka zostaje jasna,
prawie biała, **także bez ochrony** — traci tylko światło i nasycenie.

### 2.1. Dlaczego ekran jako wróg jest merytorycznie w porządku

To wymagało rozstrzygnięcia, bo pierwsza wersja koncepcji łączyła ekran telefonu z kremem SPF,
a filtr przeciwsłoneczny chroni przed UV, nie przed ekranem. Rozwiązanie jest dwutorowe:

- **W dzień** obowiązuje jawna fikcja: *w tym świecie telefon zastąpił słońce*. Gra nie twierdzi,
  że ekran emituje UV — opowiada absurdalną premisę, której nikt nie weźmie za poradę.
- **W nocy** żadna fikcja nie jest potrzebna. Fluff Sleeping Cream zawiera **Synchrolife™**,
  reklamowany przez markę jako ochrona przed **światłem niebieskim z telefonów i laptopów**.
  To jest komunikat samej marki, więc noc mówi prawdę dosłownie.

## 3. Ograniczenia przyjęte świadomie

| ograniczenie | powód |
|---|---|
| **TypeGPU / WebGPU obowiązkowo** | wymóg zadania |
| **Prototyp na jedno urządzenie** — Mac, Chrome | nie wspieramy urządzeń; Android mile widziany, ale nietestowany i nieobiecywany |
| **Brak dźwięku** | decyzja projektowa; dodatkowo przeglądarki blokują autoplay w `<iframe>` |
| **Brak fallbacku graficznego** | przy braku `navigator.gpu` pokazujemy tekst: *„Ta strona wymaga WebGPU. Odpal ją w Chrome albo na innym urządzeniu."* |
| **Zastępnik obejmuje TRZY przypadki, nie jeden** | ⛔ zgłoszone 2026-08-27 z prawdziwego telefonu z Androidem: `navigator.gpu` **istniało**, a `requestAdapter()` oddawało `null` — bramka sprawdzająca samą obecność API przepuszczała, `tgpu.init()` się wywracało i użytkownik widział **pusty kafel**. Dziś rozpoznawane są: brak API, brak adaptera, wyjątek przy starcie sceny; każdy dopisuje własne zdanie i **zawsze** wypisuje powód do konsoli (`src/logika/srodowisko.ts`) |
| **Brak nagrania w zgłoszeniu** | brief dopuszcza sam link (*„materiały, linki **lub** nagranie"*) |
| **Dwa ekrany, ~20 s zabawy** | to ma być dodatek do strony, nie aplikacja na tydzień |
| **Zero wymyślania wyglądu marki** | żadnych zmyślonych logotypów, opakowań ani palet — patrz §8 |

## 4. Architektura

Trzy potoki TypeGPU nad jedną teksturą maski. Maska żyje w przestrzeni ekranu, 512 × 512,
ping-pongowana między dwiema teksturami (WebGPU nie pozwala czytać i pisać tej samej tekstury
składowania w jednym przebiegu).

| potok | rodzaj | zadanie |
|---|---|---|
| `malowanie` | compute | odciska pędzel wzdłuż **odcinka** poprzednia→bieżąca pozycja wskaźnika i w tym samym przebiegu odejmuje wysychanie |
| `pokrycie` | compute | redukcja: ile maski jest ponad progiem — atomik w pamięci grupy roboczej, jeden `atomicAdd` globalny na grupę |
| `obraz` | render | jeden pełnoekranowy fragment rysujący całą scenę |

### 4.1. Kanały maski

- `r` — grubość kremu, `0..1`
- `g` — wiek warstwy, `0..1`; **to on steruje odcieniem** (biel → kolor skóry w dzień,
  biel → perła w nocy)
- `b`, `a` — nieużywane, zarezerwowane

Nałożenie kremu zeruje `g` w dotkniętych tekselach, więc świeżo domalowana warstwa jest znowu
biała i dopiero się „wchłania". To jest dokładnie to, co robi produkt: *skin tone correcting*.

### 4.2. Pędzel po odcinku

Odciskanie pojedynczego okręgu na `pointermove` zostawia przy szybkim ruchu kropki zamiast
smugi. Pędzel liczy więc odległość teksela od **odcinka** między poprzednią a bieżącą pozycją
wskaźnika. Ta sama funkcja `odlegloscOdOdcinka` istnieje w TS (testowalna bez GPU) i w WGSL.

### 4.3. Wysychanie i pękanie

Krem nie płowieje — pęka. Od `r` odejmujemy `dt * (bazaSchniecia + szum(uv) * amplituda)`,
a poniżej progu ścinamy ostro do zera. Nierówny szum sprawia, że warstwa rozpada się w płatki
jak zaschnięte błoto, zamiast gasnąć równomiernie. W przebiegu obrazu krawędzie pęknięć dostają
ciemniejszy rant z gradientu maski.

### 4.4. Co dokładnie znaczy „pokrycie"

Krem można rozsmarować gdziekolwiek — to jest szkło ekranu, nie sam wróg. Ale **licznik pokrycia
zlicza wyłącznie teksele, na których stoi wróg.** Inaczej dałoby się „wygrać" zamalowując rogi
kanwy, gdzie i tak nic nie świeci.

Wróg jest liczony tym samym SDF-em co w przebiegu obrazu, więc mianownik (powierzchnia wroga)
jest znany bez dodatkowego przebiegu. Redukcja liczy dwie sumy: teksele wroga i teksele wroga
pokryte kremem powyżej progu.

### 4.5. Pokrycie na CPU

Wynik redukcji wraca przez bufor pośredni i `mapAsync` **co 6 klatek**, asynchronicznie, bez
blokowania klatki. Jedna klatka opóźnienia nie ma znaczenia dla progu przejścia faz.

## 5. Przepływ stanów

```
DZIEŃ_GRA ──(pokrycie > 85% przez 1 s)──> DZIEŃ_KARTA
                                              │ (klik „dalej" albo 3 s)
                                              ▼
                                        ZACHÓD (1,5 s)
                                              │
                                              ▼
NOC_GRA ──(pokrycie > 85% przez 1 s)──> NOC_KARTA ──> „zagraj jeszcze raz"
```

Przejście dzień→noc jest fabularne, nie przełącznikiem: zakryte słońce **zachodzi**, paleta
przechodzi z piaskowej w lawendową, maska się czyści, a w ciemności zaczyna świecić ten sam
telefon — tyle że teraz na zimno.

Pokrycie steruje sceną **ciągle**, nie skokowo: jasnością wroga, drganiem powietrza, winietą,
nasyceniem i miną chmurki. Jedyne progowe przejście to wejście w kartę produktu; wszystko inne
jest interpolacją, bo inaczej czuć maszynę stanów zamiast materii.

Po 2 s bezczynności na starcie każdej fazy leci animowana podpowiedź: duchowe muśnięcie palcem.

## 6. Warstwa wizualna

Wszystko proceduralne w jednym fragmencie — SDF zaokrąglonego kafla (patrz §1a: to pole gry,
nie wizerunek telefonu),
SDF postaci, **SDF symbolu nieba** (słońce w dzień, sierp w nocy, przenikanie w zachodzie —
w górnym pasie kadru, poza obszarem liczonym i poza wycinkiem bramki blasku) i gradienty tła.
Jedyne bitmapy w całym projekcie to dwa zatwierdzone rendery produktu w kartach CTA.

**Palety zmierzone z zatwierdzonych renderów** (kwantyzacja 5 bitów na kanał, pomiar 2026-08-27):

| faza | kolory | udział |
|---|---|---|
| **dzień** | `#caaa9c`, `#c4a69b` (piasek) | ~9% |
| | `#f5e2d3`, `#f3dccd` (rozjaśnienia) | ~5% |
| | `#f3d4ac`, `#eccbab` (brzoskwinia) | ~3% |
| **noc** | `#cbcbcc`, `#d4d4d4`, `#c4c4c4`, `#bbbbbc` (poduszka) | ~20% |
| | `#c9cbea`, `#c4c4e5`, `#babbdd`, `#9b9abd` (lawenda) | ~14% |

Kontrast buduje wróg, nie marka: telefon może palić ostrą bielą w dzień i zimnym błękitem
w nocy, ale krem, karta produktu i stan spokoju siedzą wyłącznie w powyższych kolorach, bo to
są kolory prawdziwych opakowań.

Tonowanie filmowe (przybliżenie ACES) przeniesione z wcześniejszego prototypu WebGPU — proste
`x/(x+1)` spłaszcza rozbłysk do szarości, a chcemy, żeby przepalone słońce zostało ciepłe.

## 7. Zakończenie — hak produktowy

Karta wjeżdża **na uspokojoną scenę**, nie zastępuje jej.

**Dzień:**
> **Twoja tarcza przed UV**
> Krem SPF 50 wyrównujący koloryt — nakładasz na biało, dopasowuje się do Twojej cery.
> `[ Zobacz w sklepie → ]`

**Noc:**
> **Ekran świeci, Ty regenerujesz**
> Sleeping Cream z pyłem księżycowym — z Synchrolife™, chroni przed światłem niebieskim
> z telefonów i laptopów.
> `[ Zobacz w sklepie → ]`   `[ zagraj jeszcze raz ]`

Cytat *„Twoja tarcza przed UV"* i twierdzenie o świetle niebieskim pochodzą z komunikacji samej
marki — nie formułujemy własnych obietnic o działaniu kosmetyków.

## 8. Zasoby graficzne

Reguła bezwzględna: **nie wymyślamy, jak wygląda marka, jej logo ani jej produkty.** Każda
bitmapa musi pochodzić ze sklepu fluff.com.pl i zostać zaakceptowana przed użyciem.

| plik | źródło | status |
|---|---|---|
| `assets/produkt-dzien-spf50.webp` | strona produktu „Krem SPF 50 wyrównujący koloryt skóry 50ml" | **zaakceptowany 2026-08-27** |
| `assets/produkt-noc-sleeping.webp` | strona produktu „Krem Sleeping — na dobranoc 50ml" | **zaakceptowany 2026-08-27** |
| wordmark `flüff` | sklep fluff.com.pl | **NIEZAAKCEPTOWANY — nie używać** |

Chmurka jest rysowana jako zwykły kształt proceduralny i nie udaje znaku marki.

## 9. Czego świadomie nie budujemy

Wyniku punktowego, licznika czasu, rankingu, dźwięku, kamery, backendu, analityki, wersji
językowych, obsługi kolejnych produktów, fallbacku na Canvas2D, matrycy urządzeń.

Każda z tych rzeczy to osobny kawał roboty i żadnej nie ma w briefie.

## 10. Testy

**Czysta logika w TS, bez GPU** (`node --test` + `tsx`):

- `odlegloscOdOdcinka` — ta sama funkcja co w WGSL; przypadki: punkt na odcinku, za końcem,
  odcinek zdegenerowany do punktu;
- `wysychanie` — monotoniczny spadek, ścięcie do zera poniżej progu, brak wartości ujemnych;
- `maszynaStanow` — pokrycie i `dt` na wejściu, faza na wyjściu; histereza (raz pokazana karta
  nie cofa się przy spadku pokrycia).

**Sonda w stronie**, w stylu `__pomiar` z wcześniejszego prototypu WebGPU: syntetyczne ciągnięcie po kanwie, sprawdzenie
że pokrycie rośnie, a po zatrzymaniu opada; do tego ms na klatkę i ms na przebieg maski.

**Ręcznie:** Chrome na Macu. Plus jedno sprawdzenie ścieżki bez WebGPU (wyłączona flaga).

## 11. Dostarczenie

- Vite + TypeScript + TypeGPU, jedna strona statyczna.
- Deploy na GitHub Pages przez GitHub Actions; `base` w konfiguracji Vite ustawiony na nazwę repo.
- Do zgłoszenia: link na żywo + README z koncepcją i uzasadnieniem wyboru TypeGPU
  (maska w compute plus redukcja pokrycia to rzecz, której na Canvas2D nie zrobi się płynnie).

## 12. Ryzyka

| ryzyko | waga | co robimy |
|---|---|---|
| Rekruter otworzy link bez WebGPU i zobaczy sam komunikat | średnia | przyjęte świadomie — bez nagrania i bez klatki zastępczej, decyzja z 2026-08-27 |
| Dwie fazy zamiast jednej rozdmuchają zakres | średnia | silnik, maska, wysychanie i redukcja są wspólne; różni się paleta, kształt wroga i copy — szacunkowo +60% roboty, nie +100% |
| Pękanie kremu wyjdzie brzydko i zamiast „zaschło" da „miga" | niska | próg i amplituda szumu jako nazwane stałe do strojenia; sonda mierzy pokrycie w czasie, więc widać, czy warstwa opada płynnie |
