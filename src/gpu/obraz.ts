import { tgpu, d, std } from 'typegpu';
import type { TgpuRoot } from 'typegpu';
import { PALETA_DZIEN, PALETA_NOC } from '../logika/palety.ts';
import { STALE_WYSYCHANIA } from '../logika/wysychanie.ts';
import { LINIA_CZOLA, OKO, USTA } from '../logika/chmurka.ts';
import {
  PROMIEN_TARCZY, PROMIEN_WCIECIA, PROMIENI, SRODEK_SYMBOLU, WCIECIE_SIERPA, ZASIEG_SYMBOLU,
} from '../logika/symbol.ts';
import { aces, POLE_SRODEK, Scena, sdfChmurki, wzgledemChmurki } from './wspolne.ts';
import type { WidokMaski } from './wspolne.ts';

/**
 * WARSTWA WIZUALNA KAFLA: paleta w przestrzeni liniowej, stale strojenia, SDF-y i `kolorSceny`.
 *
 * Wydzielone ze `scena.ts` (zadanie C2, uwaga W3 recenzji). Tamten plik trzymal naraz trzy
 * niezalezne odpowiedzialnosci — obraz, potok z petla klatki i przyrzad pomiarowy — i urosl do
 * 706 linii. Tutaj mieszka wylacznie to, co decyduje o KOLORZE punktu; nic z tego nie wie
 * o kanwie, o petli klatki ani o sondzie.
 */

// --- PALETA W PRZESTRZENI LINIOWEJ ------------------------------------------------------------
/**
 * ⛔ SWIATLO SIE DODAJE, KOLORY Z PIPETY NIE.
 *
 * Zmierzone kolory z palet sa zapisem sRGB (tak je widzi pipeta i tak wracaja na ekran).
 * Poswiata pola to swiatlo — dodaje sie liniowo — wiec caly fragment liczy w przestrzeni
 * liniowej: paleta wchodzi przez `^2,2`, a wynik wraca przez `^(1/2,2)` juz po tonowaniu.
 * Bez tego jasna plama wokol pola robilaby brudna szarosc zamiast rozjasniac barwe.
 *
 * ⚠️ To NIE jest dobieranie kolorow: zadna skladowa nie zostala zmieniona, zmienia sie wylacznie
 * przestrzen, w ktorej sie je miesza.
 */
const GAMMA = 2.2;

function liniowy(nazwa: string) {
  const kolor = PALETA_DZIEN[nazwa];
  if (!kolor) throw new Error(`brak koloru w PALETA_DZIEN: ${nazwa}`);
  return d.vec3f(kolor[0] ** GAMMA, kolor[1] ** GAMMA, kolor[2] ** GAMMA);
}

function liniowyNoc(nazwa: string) {
  const kolor = PALETA_NOC[nazwa];
  if (!kolor) throw new Error(`brak koloru w PALETA_NOC: ${nazwa}`);
  return d.vec3f(kolor[0] ** GAMMA, kolor[1] ** GAMMA, kolor[2] ** GAMMA);
}

const PIASEK_CIEN = liniowy('piasekCien');
const KREM = liniowy('krem');
const KREM_CIEPLY = liniowy('kremCieply');
const BRZOSKWINIA = liniowy('brzoskwinia');
const BRZOSKWINIA_CIEN = liniowy('brzoskwiniaCien');

/**
 * Tlo nocy: lawenda z `PALETA_NOC` — poprawna jako tlo, bo tak zostala zmierzona. To jest STAN
 * SPOKOJU (podloze pod swieceniem, rysy twarzy chmurki chronionej), wiec podlega pierwszej
 * polowie reguly barwy: wylacznie pomiar.
 *
 * ⚠️ `poduszkaGleboka` NIE JEST juz uzywana: byla chmurka bez ochrony, czyli ZAGROZENIEM, a nie
 * produktem — barwe bierze z listy `zagrozenie(...)` nizej. Zostaje w `PALETA_NOC`, bo paleta jest
 * zapisem pomiaru opakowania, a nie lista tego, co akurat rysujemy.
 *
 * ⚠️ `lawenda` WROCILA DO UZYCIA i jest teraz barwa, ktora pole ROZLEWA po calym kaflu poza
 * swoim rdzeniem — patrz `barwaEkranuNoc` w `kolorSceny`. To NIE jest rozluznienie reguly barwy,
 * tylko jej pierwsza polowa: kolor zmierzony wolno postawic wszedzie. Poza pomiar wychodzi
 * wylacznie CIASNY rdzen swiecenia.
 */
const NOC_LAWENDA_CIEMNA = liniowyNoc('lawendaCiemna');
const NOC_LAWENDA = liniowyNoc('lawenda');

/**
 * Krem nocny dojrzewa do barwy SLOICZKA (wieczko + korpus), NIE do lawendy tla — patrz komentarz
 * przy `PALETA_NOC`. `wieczko` samo jest niemal biale (#eee1fa) i pod silnym podswietleniem pola
 * ACES i tak splaszcza je do bieli (zmierzone: delta ~0,02 na kanal), wiec dojrzaly kolor idzie
 * od wyrazniej liliowego `wieczkoCien` (#d9c4ec) z `korpus` jako cieplejsza nuta.
 */
const NOC_WIECZKO_CIEN = liniowyNoc('wieczkoCien');
const NOC_KORPUS = liniowyNoc('korpus');
const NOC_KREM_DOJRZALY = std.mix(NOC_WIECZKO_CIEN, NOC_KORPUS, 0.35);

/**
 * ⚠️ BIEL NIE JEST KOLOREM MARKI, TYLKO SWIATLEM. Spec wymaga wprost, zeby pole „wypalalo kadr
 * jasna, ciepla biela", a swiezy krem byl bialy — jedno i drugie to jasnosc rowna 1 na wszystkich
 * kanalach, a nie probka z rendera produktu.
 */
const BIEL = d.vec3f(1, 1, 1);

/**
 * ⛔ REGULA BARWY — RAZEM Z GRANICA, KTORA JA ZAMYKA. Obie polowy obowiazuja.
 *
 * 1. BARWY PRODUKTU I STANU SPOKOJU POCHODZA WYLACZNIE Z POMIARU OPAKOWAN (`PALETA_DZIEN`,
 *    `PALETA_NOC`). Krem — swiezy i dojrzaly — chmurka CHRONIONA, podloze i CALA FAZA DNIA
 *    mowia zmierzonym kolorem i niczym innym.
 * 2. BARWA ZRODLA SWIATLA JEST WLASCIWOSCIA ZAGROZENIA, NIE MARKI, wiec wolno jej wyjsc poza
 *    pomiar — razem ze sladem, ktory to zrodlo zostawia na chmurce. Zmierzone opakowanie mowi,
 *    jak wyglada SLOICZEK; nie mowi i nie moze mowic, jak wyglada swiatlo, przed ktorym ten
 *    sloiczek chroni.
 *
 * ⚠️ LISTA ZAMKNIETA, NIE FURTKA. Poza pomiar wychodzi DOKLADNIE piec barw i dokladnie w NOCY:
 * rdzen i obrzeze swiecacej powierzchni, chmurka BEZ ochrony, jej rysy przy pelnym spieku,
 * podkrazenia. Dopisanie szostej jest zmiana reguly, a nie jej zastosowaniem.
 *
 * ⚠️ DLACZEGO NOC, A NIE DZIEN. Zadanie C2 cofnelo HURTEM cala liste barw dobranych
 * (`ZOLTY_RDZEN`, `POMARANCZ_*`, `CZERWIEN_SPIEKU`, `WEGIEL_SPIEKU` i ich nocne odpowiedniki),
 * bo uzytkownik obejrzal wynik i zglosil, ze woli kolory z palety, a scena jest zbyt czerwona
 * i pomaranczowa. Uwaga dotyczyla DNIA — a cofniecie objelo takze NOC
 * i tym samym bylo za szerokie. Blekit niesie caly sens fazy nocnej: swiatlo niebieskie z ekranu
 * jest tym, przed czym Sleeping Cream z Synchrolife™ ma chronic. Bez blekitu noc jest
 * szaro-lawendowa i nieodroznialna od dnia, czyli faza istnieje w uniformie, a nie na ekranie.
 *
 * ⚠️ ZASIEG TEGO BLEKITU ZOSTAL W ZADANIU G SCIETY DO SAMEGO RDZENIA — patrz `OPAD_ZIMNA`.
 * Zdanie wyzej mowi, ze noc POTRZEBUJE blekitu; nie mowi, ze blekit ma zalac caly kafel, a tak
 * bylo, bo zimna barwa gasla po tym samym gradiencie co MOC pola. Lista zamknieta sie nie zmienia:
 * te same piec barw, tylko dwie pierwsze zajmuja teraz rdzen zamiast calego kadru, a poza nim
 * swieci ZMIERZONA lawenda. To jest ta sama granica — barwa zrodla wolno wychodzic poza pomiar,
 * tlo nie — zastosowana ostrzej, a nie poluzowana.
 *
 * ⚠️ DZIEN ZOSTAJE W BARWACH ZMIERZONYCH — bez zolci, pomaranczy i czerwieni. Zagrozenie niesie
 * tam PIEC rzeczy, z ktorych zadna nie jest odcieniem: przepalenie rdzenia do bieli (jasnosc
 * powyzej 1 PRZED tonowaniem ACES), ostry kontrast jasnosci wobec kremu, drganie powietrza,
 * winieta zacisniajaca sie przy niskim pokryciu, mina chmurki.
 *
 * ⛔ TE BARWY NIE WCHODZA DO `PALETA_*`. Palety sa zapisem POMIARU opakowan, a `test/palety.test.ts`
 * liczy w nich klucze — dopelnienie palety barwa zagrozenia skasowaloby jedyna rzecz, ktora
 * pilnuje, ze marka mowi o sobie zmierzonym kolorem. Straznik zostaje BEZ ZMIANY: barwy
 * zagrozenia mieszkaja tutaj, w warstwie obrazu, i nigdy w palecie.
 */
function zagrozenie(r: number, g: number, b: number) {
  return d.vec3f(r ** GAMMA, g ** GAMMA, b ** GAMMA);
}
/** NOC: zimny blask matrycy o trzeciej w nocy — bialo-blekitny rdzen, elektryczne obrzeza. */
const NIEBIESKI_RDZEN = zagrozenie(0.80, 0.90, 1.0);
const BLEKIT_OBRZEZE = zagrozenie(0.20, 0.50, 1.0);
/** NOC: chmurka bez ochrony — nie oparzenie, tylko ZMECZENIE: sino-blada skora i podkrazenia. */
const SINY_ZMECZONY = zagrozenie(0.58, 0.58, 0.66);
const WEGIEL_ZMECZONY = zagrozenie(0.16, 0.17, 0.24);
const PODKRAZENIA_KOLOR = zagrozenie(0.30, 0.28, 0.42);

/**
 * ⛔ JEDYNA POWIERZCHNIA W CALYM KADRZE — I ZADNEGO GRUNTU WOKOL NIEJ.
 *
 * `GRUNT_*` (jasny margines obiegajacy swiecace pole) wypadl razem z wcieta rama: to on razem
 * z wlasna krawedzia pola dawal „prostokat w prostokacie", zglaszany dwa razy. Swiecenie
 * dochodzi teraz do brzegu kanwy, a zaokraglenie robi CSS kafla — jeden ksztalt.
 *
 * `PODLOZE_*` to powierzchnia pod swieceniem. Widac ja dopiero, gdy krem zgasi blask — i wtedy
 * ma czytac sie jako „powierzchnia wygaszona", a nie jako dziura w kaflu.
 */
const PODLOZE_DZIEN = std.mul(BRZOSKWINIA_CIEN, 0.30);
const PODLOZE_NOC = std.mul(NOC_LAWENDA_CIEMNA, 0.12);

// --- STROJENIE SCENY ---------------------------------------------------------------------------
/** Ekspozycja przed tonowaniem. Dobrana tak, zeby nieoswietlony grunt wracal na ekran w swoim
 *  zmierzonym kolorze — powyzej 1,0 krzywa ACES splaszcza cala palete do jednego bezu. */
const EKSPOZYCJA = 0.85;
/** Swiatlo rozproszone dnia. */
const SWIATLO_OTOCZENIA = 0.92;
/** NOC: pokoj jest ciemny, jedynym zrodlem swiatla jest pole. Dzien nie zmienia sie, bo obie
 *  wartosci wchodza wylacznie przez `std.mix(dzien, noc, pF)`. */
const SWIATLO_OTOCZENIA_NOC = 0.15;
/**
 * NOC: krem lezy WPROST na swiecacej powierzchni, wiec nawet gruba warstwa lapie podswietlenie od
 * spodu — inaczej niz reszta sceny. Bez tego czlonu, przy ciemnym pokoju, gruba swieza warstwa
 * wychodzila szara jak brud zamiast biala (zmierzone na zrzucie `N-02` wariantu nocnego).
 */
const PODSWIETLENIE_KREMU_NOC = 0.40;
/**
 * Ile razy jasniejsze od otoczenia jest pole w samym srodku.
 * ⚠️ ZBITE Z 6,5 DO 3,4 RAZEM Z COFNIECIEM GORACEJ PALETY. Przy 6,5 do bieli przepalalo sie
 * CALE pole, nie jego rdzen: barwy z palety sa jasne (brzoskwinia 0,95/0,83/0,67), wiec juz przy
 * mocy rzedu 1,5 wychodza z tonowania jako papier. Poprzednie 6,5 dzialalo tylko dlatego, ze
 * obrzeza byly gleboko nasyconym pomaranczem. Zmierzone na zrzucie: przy 6,5 caly kafel wracal
 * bialy i zagrozenia nie bylo widac wcale — przepalenie musi byc PUNKTEM, nie tlem.
 */
const MOC_EKRANU = 3.4;
/** NOC: pole bije mocniej wzgledem (ciemniejszego) otoczenia — ma byc nieprzyjemne dla oczu. */
const MOC_EKRANU_NOC = 4.2;
/**
 * Jaka czesc mocy pola zbiera sie w gorace jadro na srodku i jak szybko to jadro gasnie.
 * ⛔ BEZ TEGO GRADIENTU CALE POLE PRZYCINA SIE DO PLASKIEJ BIELI. Zmierzone: przy rownomiernej
 * mocy 7,0 cala powierzchnia wychodzila z tonowania jako (0,98; 0,98; 0,97) — czyli papier,
 * a nie „przepalone, ale wciaz cieple slonce".
 */
const UDZIAL_JADRA = 0.95;
const OPAD_JADRA = 5.0;
/**
 * ⛔ NOC: JAK CIASNY JEST ZIMNY RDZEN. To jest cala druga zmiana zadania F.
 *
 * Do teraz noc mieszala `BLEKIT_OBRZEZE` z `NIEBIESKI_RDZEN` po `jadro`, czyli po TYM SAMYM
 * gradiencie, ktory niesie moc pola (`OPAD_JADRA` = 5). Na krawedzi kadru `jadro` schodzi do 0,05,
 * ale barwa docelowa BYLA TAM elektrycznym blekitem — wiec blekit zalewal caly kafel i nocna scena
 * czytala sie jako jeden nasycony niebieski prostokat — i tak tez zostala zgloszona.
 *
 * Zimno dostaje wiec WLASNY, szybszy opad: przy 7,0 spada do 0,1 na promieniu 0,33 przestrzeni
 * maski, czyli mniej wiecej w polowie drogi od srodka do rogu kadru. Poza nim swiatlo
 * pola rozlewa sie ZMIERZONA lawenda, a wiec tlo wraca do marki. Reguly granicy to nie rusza:
 * barwa zrodla dalej wolno wychodzic poza pomiar, tylko ZRODLO jest juz punktem, a nie kadrem.
 */
const OPAD_ZIMNA = 7.0;
/**
 * Jak mocno symbol nieba (slonce/ksiezyc) doklada sie do kadru. ⚠️ DWIE LICZBY, BO TLO POD NIM
 * JEST INNE: w dzien symbol lezy na rozpalonej powierzchni i musi ja przebic, w nocy — na ciemnej
 * lawendzie, gdzie ta sama moc zrobilaby z ksiezyca reflektor.
 */
const MOC_SYMBOLU_DZIEN = 1.55;
const MOC_SYMBOLU_NOC = 0.85;
/**
 * ⛔ POSWIATA I `ROG_POLA` WYPADLY. Poswiata z definicji istniala „na zewnatrz pola", a pole nie
 * ma juz zewnetrza — swieci caly kadr. `ROG_POLA` byl drugim promieniem zaokraglenia w kafelku,
 * ktory ma tylko jeden (ten z CSS-a). Razem z nimi wypadl `sdfProstokat`, bo nie mial juz czego
 * rysowac. Drganie powietrza, ktore jechalo na poswiacie, siedzi teraz w `falowanie`.
 */
/**
 * ⛔ CHMURKA MA BYC JASNA, PRAWIE BIALA — NIE SZARA; w zgloszeniu zostala porownana do cebuli.
 *
 * Sama barwa nie wystarczyla: `mix(krem, biel)` przemnozone przez swiatlo otoczenia 0,92
 * wracalo z tonowania okolo 0,63 w sRGB, czyli jako szarosc obok przepalonego pola. Chmurka
 * dostaje wiec WLASNE swiatlo powyzej jedynki — stoi bezposrednio przed swiecaca powierzchnia
 * i to ona ja oswietla. Kontrast z polem zostaje, bo pole i tak przycina sie do bieli.
 */
const SWIATLO_CHMURKI = 1.30;
/** NOC: pokoj jest ciemny, wiec chmurke oswietla juz prawie samo pole — baza duzo nizsza. */
const SWIATLO_CHMURKI_NOC = 0.55;
/**
 * WINIETA ZACISNIAJACA SIE PRZY NISKIM POKRYCIU — jedno z pieciu narzedzi zagrozenia, ktore
 * NIE jest odcieniem. Przy zerowej ochronie ciemny pierscien podchodzi blisko chmurki i kadr
 * sie dusi; w miare zakrywania czola pierscien cofa sie na krawedz kafla.
 */
const PROMIEN_WINIETY_CIASNO = 0.34;
const PROMIEN_WINIETY_LUZNO = 0.66;
const MIEKKOSC_WINIETY = 0.30;
const SILA_WINIETY = 0.45;
/** Powyzej tego pokrycia CZOLA chmurka jest juz w pelni chroniona. */
const POKRYCIE_PELNEJ_OCHRONY = 0.45;
/** Grubosc, powyzej ktorej krem przestaje byc „krawedzia pekniecia" i jest pelna warstwa. */
const GRUBOSC_PELNEJ_WARSTWY = 0.24;

// --- MATERIAL WARSTWY KREMU --------------------------------------------------------------------
/**
 * ⛔ KREM I CHMURKA SA OBA PRAWIE BIALE, WIEC PAS KREMU NIE MA SIE OD CZEGO ODBIC.
 *
 * Objaw: smuga czytala sie jak SZARY PLASTER naklejony na chmurke i ZJADALA
 * jej gorne garby — sylwetka nad smuga znikala. Krycie warstwy bylo pelne (`alfaKremu` dochodzila
 * do 1), a jedyna cecha materialu byla plaska barwa.
 *
 * ⛔ NIE ROZWIAZUJE SIE TEGO ROZJASNIANIEM KREMU ANI PRZYCIEMNIANIEM CHMURKI. Obie te drogi
 * kupuja czytelnosc kosztem czegos innego: pierwsza wysadza bramke „krem przygasza blask"
 * (jasniejszy krem = mniejszy spadek), druga wraca do „cebuli". Zamiast tego warstwa dostaje
 * MATERIAL — trzy cechy naraz, bo zadna z osobna nie wystarcza:
 *
 *   1. POLPRZEZROCZYSTOSC (`KRYCIE_*`) — garby chmurki przeswituja spod warstwy, wiec sylwetka
 *      nie znika. Swieza maz jest RZADSZA, wiec kryje SLABIEJ; dojrzala matowieje i kryje mocniej,
 *      ale jest juz cienka, wiec i tak nie zabija obrysu.
 *   2. POLYSK (`POLYSK_*`) — waskie jasne pasmo odbicia wzdluz grzbietu smugi, liczone
 *      z NACHYLENIA warstwy. Mocne na swiezej, gasnace z dojrzewaniem (kanal `g`), bo mokra maz
 *      odbija, a wchlonieta nie.
 *   3. RANT (`RANT_*`) — cienki ciemniejszy pasek tam, gdzie warstwa sie KONCZY. To on mowi, ze
 *      krem lezy NA chmurce, a nie W niej: bez wlasnej grubosci przy krawedzi warstwa jest
 *      naklejka, a nie maz.
 */
/** Krycie pelnej warstwy: swiezej i dojrzalej. ⛔ ANI JEDNO NIE MOZE BYC 1 — wtedy wraca plaster. */
const KRYCIE_SWIEZE = 0.55;
const KRYCIE_DOJRZALE = 0.82;
/** Grubosc, przy ktorej warstwa osiaga swoje pelne (i wciaz czesciowe) krycie. */
const GRUBOSC_PELNEGO_KRYCIA = 0.12;
/**
 * O ile teksela w bok probkuje sie maske, zeby policzyc NACHYLENIE warstwy.
 *
 * ⛔ TO NIE JEST „jak najmniej, zeby bylo dokladnie". ZMIERZONE: przy 1,5 teksela nachylenie
 * bierze sie glownie z PLATKOW WYSYCHANIA (`PLATKOW_NA_BOK` = 32, czyli platek ~16 tekseli),
 * a nie z ksztaltu smugi — odblask rysowal wtedy siatke drucianych kresek po calej lacie,
 * i to najjasniej na warstwie SWIEZEJ, bo tam `mokrosc` jest najwyzsza.
 *
 * 5 tekseli (rozstaw probek 10) usrednia platek i zostawia ksztalt pociagniecia: pedzel ma
 * promien 0,055 maski, czyli 28 tekseli, wiec grzbiet smugi jest o rzad wielkosci szerszy.
 */
const KROK_NACHYLENIA = 5 / 512;
/**
 * Jak mocno nachylenie warstwy odchyla normalna. ⚠️ Rzedu jedynki, bo roznica centralna na
 * rozstawie 10 tekseli daje na zboczu smugi wartosc rzedu 0,5 — czyli nachylenie okolo 27°,
 * dokladnie tam, gdzie przy `WYSOKOSC_ZRODLA` = 0,12 wypada szczyt odblasku.
 */
const WYPUKLOSC_WARSTWY = 1.0;
/** Wykladnik odblasku. Wysoki, bo to ma byc WASKIE pasmo, a nie polysk calej laty. */
const OSTROSC_POLYSKU = 34.0;
/** Sila odblasku na SWIEZEJ i na DOJRZALEJ warstwie — cala roznica „mokre kontra matowe". */
const POLYSK_SWIEZY = 3.2;
const POLYSK_DOJRZALY = 0.10;
/**
 * Wysokosc zrodla swiatla nad plaszczyzna kafla.
 *
 * ⛔ MALA, BO SWIATLO PADA PLASKO. Kafel JEST swiecaca powierzchnia, wiec zrodlo lezy prawie
 * w jego plaszczyznie. To nie jest kosmetyka: przy 0,85 wektor polowy drogi stoi niemal pionowo,
 * wiec PLASKIE wnetrze warstwy trafia w lustrzany kierunek i swieci cala lata (zmierzone:
 * `dot(n, h)^26` = 0,94 na plaskim). Przy 0,12 plaskie wnetrze daje 0,03, a szczyt wypada na
 * ZBOCZU — czyli tam, gdzie ma byc grzbiet smugi.
 */
const WYSOKOSC_ZRODLA = 0.12;
/** Pasmo grubosci, w ktorym warstwa „ma krawedz": ponizej progu jej nie ma, powyzej jest plaska. */
const RANT_OD = 0.045;
const RANT_DO = 0.150;
/** Jak mocno rant przyciemnia. Cien od GRUBOSCI warstwy, nie od chmurki — stad tak malo. */
const SILA_RANTU = 0.34;

// --- PODPOWIEDZ GESTU --------------------------------------------------------------------------
/**
 * ⛔ PODPOWIEDZ WEDRUJE TAM, GDZIE TRZEBA MALOWAC — PO CZOLE CHMURKI, A NIE „GDZIES NA KAFLU".
 *
 * Punkty daje wylacznie krem, ktory wyladowal na czole (`obszarWroga` w `wspolne.ts`), wiec
 * podpowiedz pokazujaca gest w dowolnym innym miejscu uczylaby ruchu, ktory NIC nie robi —
 * gorzej niz brak podpowiedzi, bo gracz wykonalby go i uznal, ze dodatek nie dziala.
 *
 * ⚠️ WSPOLRZEDNE PONIZEJ SA ZMIERZONE, NIE DOBRANE — i PRZELICZONE PO ZMIANIE SYLWETKI NA KAPSULE.
 * Czolo (`czyCzolo` z `logika/chmurka.ts`, siatka 512x512) lezy w prostokacie x 0,116..0,884,
 * y 0,552..0,675 przestrzeni maski, czyli wzgledem srodka postaci y od -0,1682 do `LINIA_CZOLA`
 * = -0,0452. Kapsula jest szersza od poprzedniego ksztaltu i nie zweza sie ku gorze tak ostro:
 * polowa szerokosci pasma to 0,2764 przy y = -0,160, 0,3154 przy -0,140, 0,3525 przy -0,106,
 * 0,3740 przy -0,070.
 *
 * ⛔ OBIE OSIE PRZESTROJONE PO RECENZJI (uwaga W4) — WCZESNIEJ NIE ZGADZALA SIE ZADNA.
 * `PODPOWIEDZ_Y` bylo -0,070 z komentarzem „srodek zmierzonego pasma czola", choc srodek pasma
 * -0,1682..-0,0452 wypada na -0,1067. Skutek bylo widac na zrzucie: plama o promieniu 0,050 na
 * wysokosci -0,070 siegala do -0,020, a `naCzole` wygasza ja juz od `LINIA_CZOLA`, wiec DOLNA
 * POLOWA DUCHA byla scinana i podpowiedz przyklejala sie do dolnej krawedzi zamiast prowadzic
 * przez srodek czola. `PODPOWIEDZ_WEDROWKA` bylo 0,13 przy polszerokosci 0,375, czyli duch
 * pokazywal gest niemal trzykrotnie krotszy od tego, ktorego wymaga domkniecie rundy.
 */
/**
 * Wysokosc toru wzgledem srodka postaci — SRODEK ZMIERZONEGO PASMA CZOLA, czyli
 * (-0,1682 + -0,0452) / 2. Przy promieniu plamy 0,050 duch siega od -0,156 do -0,056, wiec caly
 * miesci sie nad `LINIA_CZOLA` i nic go nie scina.
 */
const PODPOWIEDZ_Y = -0.106;
/**
 * Polowa dlugosci przejazdu w poziomie. LICZONA Z PASMA: polszerokosc czola na wysokosci
 * `PODPOWIEDZ_Y` to 0,3525, minus promien plamy (0,050) daje 0,3025 — stad 0,30, przy ktorym
 * brzeg ducha zatrzymuje sie tuz przed krawedzia sylwetki.
 *
 * ⛔ PODPOWIEDZ MA UCZYC GESTU O DLUGOSCI, JAKIEJ NAPRAWDE WYMAGA DOMKNIECIE RUNDY. Prog pokrycia
 * domykaja dwa przejazdy przez CALA szerokosc czola; duch wedrujacy po 0,13 pokazywal ruch, ktory
 * zakrywa srodek pasma i nic wiecej, czyli uczyl za malo. Maska czola i tak miekko przycina to,
 * co wyjdzie poza sylwetke, wiec bledem w te strone jest slabsza podpowiedz, a nie plama wiszaca
 * obok postaci.
 */
const PODPOWIEDZ_WEDROWKA = 0.30;
/** Promien „duchowego" musniecia. Rzedu pedzla gracza (0,055), zeby uczyl skali gestu. */
const PODPOWIEDZ_PROMIEN = 0.050;
/** Predkosc katowa przejazdu w radianach na sekunde. Pelny tam-i-z-powrotem trwa okolo 3,5 s. */
const PODPOWIEDZ_TEMPO = 1.8;
/** Dlugosc ogona ciagnacego sie ZA palcem — to on mowi, ze gest jest poziomy i ma kierunek. */
const PODPOWIEDZ_OGON = 0.20;
/** Krycie plamy, ogona i calego toru. ⛔ To ma byc DUCH gestu, nie druga warstwa kremu. */
const PODPOWIEDZ_KRYCIE = 0.62;
const PODPOWIEDZ_KRYCIE_OGONA = 0.34;
const PODPOWIEDZ_KRYCIE_TORU = 0.18;
/**
 * Jak mocno obrys plamy przyciemnia — to samo, co rant robi prawdziwej warstwie.
 * ⚠️ MIEKKI I SZEROKI, NIE OSTRY. Waska, mocna obwodka czytala sie na zrzucie jak BABEL albo
 * dziura w chmurce, a nie jak palec: oko widzi zamkniety okrag, zanim zdazy zobaczyc, ze jasny
 * srodek jest kremem. Rozmyty cien pod plama daje jej grubosc, nie ksztalt.
 */
const PODPOWIEDZ_SILA_OBRYSU = 0.20;
/**
 * ⛔ DUCH JEST JASNIEJSZY OD CHMURKI, INACZEJ GO NIE WIDAC. Zmierzone 2026-08-27: przy oswietleniu
 * kremu (`oswietlenieKremu`) srednia jasnosc pasma czola zmieniala sie o 0,0005 — czyli MNIEJ niz
 * dryf sceny w czasie (0,002), a wiec podpowiedz byla technicznie narysowana i praktycznie
 * niewidoczna. Krem lezy NA polu i dostaje glownie swiatlo otoczenia; duch lezy na CHMURCE, ktora
 * stoi przed swiecaca powierzchnia i ma wlasne swiatlo powyzej jedynki — stad mnoznik od niego.
 */
const PODPOWIEDZ_ROZJASNIENIE = 1.26;
/** Pasmo, na ktorym podpowiedz gasnie przy linii oczu. Ponizej czola nie ma juz czego pokazywac. */
const PODPOWIEDZ_ZANIK = 0.020;

// --- SDF-y --------------------------------------------------------------------------------------
/**
 * ⛔ SYLWETKA CHMURKI MIESZKA W `wspolne.ts` / `logika/chmurka.ts`, NIE TUTAJ.
 *
 * Odkad mianownikiem pokrycia jest CZOLO chmurki, ten sam ksztalt musi znac licznik pokrycia
 * i fragment. Druga kopia rozjechalaby sie po cichu. Zostaje tu wylacznie twarz, ktorej licznik
 * nie potrzebuje — ale jej wspolrzedne tez pochodza z `logika/chmurka.ts` (`OKO`, `USTA`),
 * bo to one ustalaja, gdzie przebiega `LINIA_CZOLA`.
 */

/**
 * Rysy twarzy: 1 tam, gdzie ma byc ciemna kreska. `spiek` 0 = spokoj, 1 = grymas.
 *
 * ⛔ DWIE CZESCI: OCZY I USTA. Gogle — soczewki, rant i mostek — wypadly w calosci na wyrazne
 * zyczenie uzytkownika, ktory zglosil, ze woli poprzednie oczy — wiec wrocily proste ciemne
 * elipsy. Mruza sie, czyli splaszczaja w pionie, razem ze spiekiem; usta przechodza z usmiechu
 * w podkowe w dol. Mina jest jednym z pieciu nosnikow zagrozenia, ktory NIE jest odcieniem.
 */
const rysyChmurki = tgpu.fn([d.vec2f, d.f32], d.f32)((p, spiek) => {
  'use gpu';
  // OCZY — mruza sie, czyli splaszczaja w pionie, razem ze spiekiem.
  const splaszczenie = d.f32(1) + spiek * d.f32(2.4);
  const skalaOka = d.vec2f(1, splaszczenie);
  const lewe = std.length(std.mul(std.sub(p, d.vec2f(-OKO.x, OKO.y)), skalaOka)) - d.f32(OKO.r);
  const prawe = std.length(std.mul(std.sub(p, d.vec2f(OKO.x, OKO.y)), skalaOka)) - d.f32(OKO.r);
  const oczy = d.f32(1) - std.smoothstep(d.f32(0), d.f32(0.005), std.min(lewe, prawe));

  // Os Y idzie w dol, wiec dodatnie `wygiecie` unosi katy ust do gory — usmiech.
  const wygiecie = std.mix(d.f32(3.2), d.f32(-4.0), spiek);
  const doUst = std.abs(p.y - (d.f32(USTA.y) - wygiecie * p.x * p.x)) - d.f32(USTA.grubosc);
  const wZakresie = d.f32(1)
    - std.smoothstep(d.f32(USTA.polowaSzerokosci), d.f32(USTA.polowaSzerokosci * 1.5), std.abs(p.x));
  const usta = (d.f32(1) - std.smoothstep(d.f32(0), d.f32(0.005), doUst)) * wZakresie;

  return std.clamp(oczy + usta, d.f32(0), d.f32(1));
});

/** Jak plaski i szeroki jest owal podkrazenia wzgledem samego oka. */
const PODKRAZENIA_SKALA: readonly [number, number] = [1.7, 0.75];
/** O ile srodek owalu zjezdza pod srodek oka — w promieniach oka. */
const PODKRAZENIA_ZEJSCIE = 0.85;
/** Jak miekki jest ten cien. Duzo, bo to ma byc cien zmeczenia, a nie druga kreska. */
const PODKRAZENIA_ROZMYCIE = 0.030;

/**
 * NOC: podkrazenia pod oczami — miekki, spionizowany owal tuz pod kazdym okiem (te same srodki
 * co w `rysyChmurki`, przesuniete w dol). Zwraca 0..1 MIEKKO, bo to ma czytac sie jak cien
 * zmeczenia, nie kreska. Wywolujacy mnozy wynik przez `spiek` i `pF`, wiec w dzien i przy pelnej
 * ochronie funkcja nie zmienia obrazu.
 *
 * ⚠️ WROCILO DO OWALI RAZEM Z OCZAMI. W wersji z goglami cien liczyl sie z `sdfGogli`, bo owal
 * o promieniu POWIEKSZONEGO oka zajmowal pol twarzy. Przy oku o promieniu 0,024 owal znowu jest
 * cieniem pod okiem, a nie druga oprawka — i skaluje sie z `OKO`, wiec nie ma czego stroic osobno.
 */
const podkrazeniaChmurki = tgpu.fn([d.vec2f], d.f32)((p) => {
  'use gpu';
  const skalaOwalu = d.vec2f(PODKRAZENIA_SKALA[0], PODKRAZENIA_SKALA[1]);
  const srodek = d.f32(OKO.y + OKO.r * PODKRAZENIA_ZEJSCIE);
  const lewe = std.length(std.mul(std.sub(p, d.vec2f(-OKO.x, srodek)), skalaOwalu)) - d.f32(OKO.r);
  const prawe = std.length(std.mul(std.sub(p, d.vec2f(OKO.x, srodek)), skalaOwalu)) - d.f32(OKO.r);
  return d.f32(1) - std.smoothstep(d.f32(0), d.f32(PODKRAZENIA_ROZMYCIE), std.min(lewe, prawe));
});

/**
 * ⛔ SYMBOL NIEBA: SLONCE W DZIEN, SIERP W NOCY — JEDNA FUNKCJA, DWA KSZTALTY, PRZENIKANIE PO `faza`.
 *
 * Zwraca krycie 0..1. Umiejscowienie i zasieg mieszkaja w `logika/symbol.ts`, bo tylko one musza
 * dac sie zmierzyc bez GPU (symbol ma lezec poza obszarem liczonym i poza sylwetka postaci).
 *
 * ⚠️ OSTATNI MNOZNIK — `wZasiegu` — NIE JEST OZDOBA. To on czyni prawdziwym zdanie, ktore sprawdza
 * `test/symbol.test.ts`: poza kolem o promieniu `ZASIEG_SYMBOLU` symbol nie rysuje niczego.
 * Bez niego ramiona slonca konczylyby sie tam, gdzie wypadnie z `smoothstep`, a test orzekalby
 * o kole, ktore z rysowanym ksztaltem laczy tylko nadzieja.
 */
const symbolNieba = tgpu.fn([d.vec2f, d.f32], d.f32)((p, faza) => {
  'use gpu';
  const q = std.sub(p, d.vec2f(SRODEK_SYMBOLU.x, SRODEK_SYMBOLU.y));
  const r = std.length(q);
  const tarcza = d.f32(1) - std.smoothstep(d.f32(PROMIEN_TARCZY * 0.88), d.f32(PROMIEN_TARCZY), r);

  // SLONCE — tarcza plus ramiona. Ramiona sa okresowe po kacie (`|cos|` podniesiony do potegi
  // zwezajacej je w szpice) i gasna wraz z odlegloscia od tarczy.
  const kat = std.atan2(q.y, q.x);
  const ramie = std.pow(std.abs(std.cos(kat * d.f32(PROMIENI / 2))), d.f32(7));
  const wzdluz = std.smoothstep(d.f32(ZASIEG_SYMBOLU), d.f32(PROMIEN_TARCZY * 0.9), r);
  const slonce = std.clamp(tarcza + ramie * wzdluz, d.f32(0), d.f32(1));

  // KSIEZYC — ta sama tarcza minus przesuniete kolo. Sierp bierze sie z odjecia, wiec ma
  // dokladnie te grubosc, ktora wynika z `WCIECIE_SIERPA`, i nie trzeba go rysowac lukami.
  const doWciecia = std.length(std.sub(
    q,
    d.vec2f(d.f32(PROMIEN_TARCZY * WCIECIE_SIERPA.x), d.f32(PROMIEN_TARCZY * WCIECIE_SIERPA.y)),
  )) - d.f32(PROMIEN_TARCZY * PROMIEN_WCIECIA);
  const ksiezyc = tarcza * std.smoothstep(d.f32(0), d.f32(0.005), doWciecia);

  const wZasiegu = d.f32(1) - std.smoothstep(d.f32(ZASIEG_SYMBOLU * 0.96), d.f32(ZASIEG_SYMBOLU), r);
  return std.mix(slonce, ksiezyc, faza) * wZasiegu;
});

/**
 * Buduje uniform sceny, probnik maski i funkcje `kolorSceny`.
 *
 * ⛔ JEDNA FUNKCJA NA CALY OBRAZ. `kolorSceny` liczy kolor punktu podanego w PRZESTRZENI MASKI,
 * ktora jest zarazem przestrzenia kafla: kwadrat, ta sama skala na obu osiach. Fragment tylko
 * przelicza na nia wspolrzedne kanwy, a przyrzad `jasnosc`/`barwa` wola ja wprost — dzieki temu
 * bramka mierzy DOKLADNIE ten obraz, ktory idzie na ekran, a nie jego drugie wcielenie.
 */
export function stworzObraz(root: TgpuRoot, widokMaski: WidokMaski) {
  const probnik = root.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const uniformSceny = root.createUniform(Scena);

  // Srodek swiecenia. Liczony z `POLE`, ktore obejmuje caly kadr — czyli srodek kafla.
  const srodekPola = d.vec2f(POLE_SRODEK[0], POLE_SRODEK[1]);

  /**
   * Grubosc warstwy w punkcie maski, ZE STRAZNIKIEM ZAKRESU.
   *
   * ⛔ JEDNA DEFINICJA, BO CZYTA SIE JA W PIECIU PUNKTACH. `kolorSceny` potrzebuje grubosci
   * nie tylko pod soba, ale i w czterech sasiadach — z nich liczy NACHYLENIE warstwy pod polysk.
   * Gdyby straznik `wRamach` byl przepisany osobno przy kazdej probce, jedna z pieciu kopii
   * rozjechalaby sie po cichu i krem z krawedzi maski rozmazalby sie po marginesie kafla
   * TYLKO w odblasku — objaw nie do znalezienia.
   */
  const gruboscMaski = tgpu.fn([d.vec2f], d.f32)((p) => {
    'use gpu';
    // Probnik zaciska brzeg, wiec poza kwadratem maski zwracamy zero: nie ma tam na czym malowac.
    const wRamach = std.step(d.f32(0), p.x) * std.step(p.x, d.f32(1))
      * std.step(d.f32(0), p.y) * std.step(p.y, d.f32(1));
    const teksel = std.textureSampleLevel(widokMaski.$, probnik.$, p, 0);
    return std.clamp(teksel.x, d.f32(0), d.f32(1)) * wRamach;
  });

  const kolorSceny = tgpu.fn([d.vec2f], d.vec3f)((p) => {
    'use gpu';
    // `pF` steruje KAZDA barwa i stala, ktora rozni dzien od nocy, wylacznie przez
    // `std.mix(dzien, noc, pF)`. Przy `pF = 0` kazdy taki mix zwraca algebraicznie wartosc dnia.
    const pF = uniformSceny.$.faza;

    // --- MASKA KREMU -------------------------------------------------------------------------
    const grubosc = gruboscMaski(p);
    const teksel = std.textureSampleLevel(widokMaski.$, probnik.$, p, 0);
    const wiek = std.clamp(teksel.y, d.f32(0), d.f32(1));

    // NACHYLENIE WARSTWY — roznica centralna grubosci w czterech sasiadach. To z niej bierze sie
    // normalna do powierzchni kremu, a z niej odblask. Liczone TUTAJ, bo grubosc pod palcem
    // i w sasiedztwie musza pochodzic z jednej funkcji (patrz `gruboscMaski`).
    const krok = d.f32(KROK_NACHYLENIA);
    const nachylenie = d.vec2f(
      gruboscMaski(std.add(p, d.vec2f(krok, 0))) - gruboscMaski(std.sub(p, d.vec2f(krok, 0))),
      gruboscMaski(std.add(p, d.vec2f(0, krok))) - gruboscMaski(std.sub(p, d.vec2f(0, krok))),
    );

    // ⛔ CALA MECHANIKA GRY W JEDNEJ LINII: moc swiatla przemnozona przez (1 - grubosc).
    const przeslona = d.f32(1) - grubosc;

    // --- SWIECACA POWIERZCHNIA: CALY KADR, BEZ WLASNEJ KRAWEDZI ------------------------------
    // ⛔ ZADNEGO SDF-a RAMY. Kafel jest powierzchnia, ktora sie smaruje, i niczym wiecej;
    // jedyne zaokraglenie w calym dodatku robi CSS. Patrz `POLE` w `wspolne.ts`.
    const odSrodka = std.sub(p, srodekPola);

    // Ochrona i jej dopelnienie sa potrzebne juz tutaj — steruja drganiem, winieta i mina.
    const ochrona = std.smoothstep(d.f32(0.04), d.f32(POKRYCIE_PELNEJ_OCHRONY), uniformSceny.$.pokrycie);
    const spiek = d.f32(1) - ochrona;

    // ⛔ DRGANIE POWIETRZA NAD GORACA POWIERZCHNIA — NIE MNOZNIK JASNOSCI, TYLKO ZABURZENIE
    // WSPOLRZEDNEJ. Falujaca jasnosc rozchwialaby bramke „krem przygasza blask": jej miara jest
    // srednia po wycinku, wiec kazdy mnoznik zmienialby ja wprost. Przesuniecie punktu, z ktorego
    // liczy sie jadro, przelewa jasnosc w obrebie wycinka i w sredniej sie znosi — a widac je,
    // bo gorace jadro faluje. Uspokaja sie razem ze spiekiem.
    //
    // ⛔ KAZDA SKLADOWA ZABURZENIA ZALEZY OD OBU WSPOLRZEDNYCH — I TO JEST CALA NAPRAWA PASOW.
    // Poprzednia wersja przesuwala punkt WYLACZNIE w pionie i wylacznie w funkcji `p.x`
    // (`sin(46·x)`, `sin(97·x)`). Przy takim zaburzeniu CALA KOLUMNA pikseli dostaje ten sam
    // przesuw, wiec jasnosc wzdluz promienia bijacego ze srodka jest spojna na calej dlugosci —
    // z rdzenia wychodza pionowe smugi „jak promienie". Na beżowym tle dnia mieszcily sie
    // w szumie palety; na nasyconym blekicie nocy czytaly sie jako wada rysunku.
    // Kod sie nie zmienil — zmienilo sie tlo.
    //
    // Cztery fale biegnace w czterech roznych kierunkach (zadna nie jest rownolegla do osi ani do
    // pozostalych) i po dwie na kazda os przesuwu. Zadna prosta na kadrze nie ma juz stalego
    // zaburzenia, wiec nie ma z czego powstac smudze. Czestotliwosci rzedu 20–45 zamiast 46–97:
    // dlugosc fali okolo 0,13 przestrzeni maski, czyli komorka rzedu 55 px na kaflu 420 px —
    // drganie powietrza, a nie prazkowanie. Amplituda w przestrzeni maski, wiec nie zalezy od
    // proporcji kadru i nie rusza ani geometrii, ani maski.
    const drzenie = d.f32(0.30) + d.f32(0.70) * spiek;
    const czas = uniformSceny.$.czas;
    const falowanieX = drzenie * (
      d.f32(0.010) * std.sin(d.f32(21) * p.y + d.f32(13) * p.x - czas * d.f32(2.6))
      + d.f32(0.005) * std.sin(d.f32(37) * p.y - d.f32(29) * p.x + czas * d.f32(5.1))
    );
    const falowanieY = drzenie * (
      d.f32(0.010) * std.sin(d.f32(17) * p.x - d.f32(23) * p.y - czas * d.f32(2.2))
      + d.f32(0.005) * std.sin(d.f32(31) * p.x + d.f32(19) * p.y + czas * d.f32(4.3))
    );
    const odSrodkaDrgajace = std.add(odSrodka, d.vec2f(falowanieX, falowanieY));

    // Gorace jadro na srodku: tam swiatlo przycina sie do bieli, a im dalej od srodka, tym
    // wyrazniej wraca barwa obrzeza. To jest to „przepalone, ale wciaz cieple".
    const jadro = std.exp(d.f32(-OPAD_JADRA) * std.length(odSrodkaDrgajace));
    const puls = d.f32(1) + d.f32(0.045) * std.sin(uniformSceny.$.czas * d.f32(1.7));
    const mocEkranuBaza = std.mix(d.f32(MOC_EKRANU), d.f32(MOC_EKRANU_NOC), pF);
    // ⚠️ DWIE MOCE, NIE JEDNA. `mocPadajaca` to swiatlo, ktore DOCHODZI do powierzchni kremu;
    // `mocEkranu` to ta czesc, ktora przez krem PRZESZLA. Odblask powstaje na WIERZCHU warstwy,
    // wiec swieci go moc padajaca — inaczej gruba, swieza maz gasilaby wlasny polysk i im
    // bardziej mokra by byla, tym mniej by blyszczala.
    const mocPadajaca = mocEkranuBaza
      * (d.f32(1 - UDZIAL_JADRA) + d.f32(UDZIAL_JADRA) * jadro) * puls;
    const mocEkranu = mocPadajaca * przeslona;

    // --- POWIERZCHNIA POD SWIECENIEM ----------------------------------------------------------
    const powierzchnia = std.mix(PODLOZE_DZIEN, PODLOZE_NOC, pF);

    // ⛔ DZIEN NIESIE ZAGROZENIE NATEZENIEM, NOC — ODCIENIEM. To NIE jest niekonsekwencja, tylko
    // regula barwy z gory pliku zastosowana do dwoch roznych zrodel swiatla.
    // DZIEN: slonce jest biale, wiec rdzen przepala sie do bieli, a obrzeza trzymaja zmierzona
    // brzoskwinie; `mocEkranu` siega `MOC_EKRANU` razy swiatlo otoczenia, wiec srodek wchodzi
    // w tonowanie ACES grubo powyzej 1.
    // NOC: swiatlo NIEBIESKIE z ekranu jest tym, przed czym chroni Sleeping Cream — jego barwa
    // jest wlasciwoscia zagrozenia, nie marki, wiec RDZEN jest bialo-blekitny, a jego najblizsze
    // obrzeze elektrycznie blekitne. Poza rdzeniem (`OPAD_ZIMNA`) pole rozlewa juz ZMIERZONA
    // lawende: blekit nazywa zrodlo, a nie zalewa kafla.
    const barwaEkranuDzien = std.mix(BRZOSKWINIA, BIEL, jadro);
    // ⛔ NOCA ZIMNY JEST SAM RDZEN, A TLO JEST MARKA. `zimno` ma wlasny, ciasny opad
    // (`OPAD_ZIMNA`), wiec poza rdzeniem pole rozlewa ZMIERZONA lawende, a nie elektryczny blekit.
    // Wewnatrz rdzenia zostaje dokladnie to, co bylo: obrzeze blekitne, srodek bialo-blekitny.
    const zimno = std.exp(d.f32(-OPAD_ZIMNA) * std.length(odSrodkaDrgajace));
    const barwaEkranuNoc = std.mix(
      NOC_LAWENDA,
      std.mix(BLEKIT_OBRZEZE, NIEBIESKI_RDZEN, jadro),
      zimno,
    );
    const barwaEkranu = std.mix(barwaEkranuDzien, barwaEkranuNoc, pF);
    const emisja = std.mul(barwaEkranu, mocEkranu);
    const oswietlenieOtoczenia = std.mix(d.f32(SWIATLO_OTOCZENIA), d.f32(SWIATLO_OTOCZENIA_NOC), pF);
    const zeSloncem = std.add(std.mul(powierzchnia, oswietlenieOtoczenia), emisja);

    // --- SYMBOL NIEBA -------------------------------------------------------------------------
    // ⛔ DOKLADANY DO TLA, A NIE RYSOWANY NA WIERZCHU. Symbol jest czescia nieba, wiec postac stoi
    // przed nim, a krem daje sie po nim rozsmarowac jak po kazdym innym kawalku powierzchni.
    // Lezy w gornym pasie kadru — poza obszarem liczonym, poza sylwetka (a wiec i poza podpowiedzia
    // gestu, ktora rysuje sie wylacznie na niej) i poza wycinkiem bramki blasku. Wszystkie trzy
    // warunki sa MIERZONE w `test/symbol.test.ts`, nie zalozone.
    //
    // ⚠️ BARWA BEZ ANI JEDNEJ NOWEJ WARTOSCI: dzien to `BRZOSKWINIA` rozbielona do slonecznej
    // bieli, noc to `NIEBIESKI_RDZEN` rozbielony do ksiezycowej. Obie stale juz istnialy, wiec
    // zamknieta lista barw spoza pomiaru zostaje piecioelementowa.
    const barwaSymbolu = std.mix(
      std.mix(BRZOSKWINIA, BIEL, d.f32(0.75)),
      std.mix(NIEBIESKI_RDZEN, BIEL, d.f32(0.45)),
      pF,
    );
    const mocSymbolu = std.mix(d.f32(MOC_SYMBOLU_DZIEN), d.f32(MOC_SYMBOLU_NOC), pF);
    const zeSymbolem = std.add(zeSloncem, std.mul(barwaSymbolu, symbolNieba(p, pF) * mocSymbolu));

    // --- CHMURKA -----------------------------------------------------------------------------
    // ⛔ BEZ KOLYSANIA. Chmurka jest teraz OBSZAREM LICZONYM (`obszarWroga` = jej czolo),
    // a licznik pokrycia nie ma uniformu sceny — kolysanie w funkcji czasu rozjezdzaloby ksztalt
    // liczony z rysowanym o +-0,008 w kazdej klatce. Ruch dostarcza mina i drganie powietrza.
    const pc = wzgledemChmurki(p);
    const doChmurki = sdfChmurki(pc);
    const maskaChmurki = d.f32(1) - std.smoothstep(d.f32(0), d.f32(0.004), doChmurki);
    // Miekki cien pod chmurka — bez niego biala chmurka na bialym polu znika.
    const cienChmurki = std.step(d.f32(0), doChmurki)
      * (d.f32(1) - std.smoothstep(d.f32(0), d.f32(0.045), doChmurki));
    const zeSloncemZCieniem = std.mul(zeSymbolem, d.f32(1) - cienChmurki * d.f32(0.45));

    // ⛔ CHMURKA JEST JASNA, PRAWIE BIALA — Z NAJJASNIEJSZYCH BARW PALETY. Dzien: `krem`
    // i `kremCieply`; noc: `wieczko` i `korpus`, czyli sloiczek. Bez ochrony NIE czerwienieje —
    // tylko traci nasycenie i swiatlo (dzien: przykurzony `piasekCien`; noc: sino-szara
    // `poduszkaGleboka`), a cale „boli" niesie mina, nie odcien.
    const kremowa = std.mix(KREM, KREM_CIEPLY, d.f32(0.5));
    const sloiczkowa = std.mix(NOC_WIECZKO_CIEN, NOC_KORPUS, d.f32(0.5));
    const chmurkaChronionaDzien = std.mix(kremowa, BIEL, d.f32(0.45));
    const chmurkaChronionaNoc = std.mix(sloiczkowa, BIEL, d.f32(0.45));
    const chmurkaChroniona = std.mix(chmurkaChronionaDzien, chmurkaChronionaNoc, pF);
    // ⛔ BEZ OCHRONY CHMURKA NIE CIEMNIEJE DO PLAMY. W DZIEN traci tylko czesc nasycenia
    // (przykurzony, ZMIERZONY `piasekCien`) — kusi, zeby zrobic ja czerwona, ale to znowu byloby
    // niesienie zagrozenia odcieniem marki, a do tego robi z niej „cebule".
    // W NOCY zagrozeniem nie jest oparzenie, tylko BRAK SNU — a to ma wlasny, rozpoznawalny
    // kolor: sino-blada skora. `SINY_ZMECZONY` jest sladem, ktory zostawia niebieskie swiatlo,
    // wiec podlega drugiej polowie reguly barwy z gory pliku, tak jak samo swiatlo.
    const spieczonaDzien = std.mix(kremowa, PIASEK_CIEN, d.f32(0.5));
    const spieczonaNoc = std.mix(sloiczkowa, SINY_ZMECZONY, d.f32(0.8));
    const chmurkaSpieczona = std.mix(spieczonaDzien, spieczonaNoc, pF);
    const barwaChmurki = std.mix(chmurkaChroniona, chmurkaSpieczona, spiek);
    // Obwodka: bez niej biala, chroniona chmurka znika w bialym blasku pola.
    const obwodka = d.f32(1) - std.smoothstep(d.f32(0.004), d.f32(0.014), std.abs(doChmurki));
    // Rysy twarzy: przy spiek = 0 barwa zmierzona; przy pelnym spieku ciemnieja do prawie wegla.
    const barwaRysowDzien = std.mix(std.mul(PIASEK_CIEN, d.f32(0.16)), std.mul(PIASEK_CIEN, d.f32(0.05)), spiek);
    const barwaRysowNoc = std.mix(std.mul(NOC_LAWENDA_CIEMNA, d.f32(0.16)), WEGIEL_ZMECZONY, spiek);
    const barwaRysow = std.mix(barwaRysowDzien, barwaRysowNoc, pF);
    const zRysami = std.mix(barwaChmurki, barwaRysow, rysyChmurki(pc, spiek));
    // Podkrazenia: czytelny znak „zmeczona", nie „oparzona". Widoczne wylacznie noca (`pF`)
    // i wylacznie przy braku ochrony (`spiek`). Fiolet z domieszka blekitu — lawenda z palety
    // byla za jasna i za rozowa, zeby czytac sie jako cien pod okiem.
    const zPodkrazeniami = std.mix(
      zRysami,
      PODKRAZENIA_KOLOR,
      podkrazeniaChmurki(pc) * spiek * pF * d.f32(0.75),
    );
    const kolorChmurki = std.mul(zPodkrazeniami, d.f32(1) - obwodka * d.f32(0.30));
    // Chmurka stoi PRZED polem, wiec to ono ja oswietla. Baza powyzej jedynki (patrz
    // `SWIATLO_CHMURKI`) — bez niej wracala z tonowania jako szarosc obok przepalonego pola.
    const swiatloChmurki = std.mix(d.f32(SWIATLO_CHMURKI), d.f32(SWIATLO_CHMURKI_NOC), pF);
    const oswietlenieChmurki = swiatloChmurki
      + mocEkranu * d.f32(0.05) * (d.f32(0.5) + spiek * d.f32(0.8));
    const zChmurka = std.mix(
      zeSloncemZCieniem,
      std.mul(kolorChmurki, oswietlenieChmurki),
      maskaChmurki,
    );

    // --- KREM --------------------------------------------------------------------------------
    // Swiezy jest bialy; dojrzewa (kanal `g`) do zmierzonego `kremCieply` (dzien) albo do barwy
    // sloiczka nocnego (noc). To jedyne miejsce, w ktorym kanal wieku zamienia sie w cos widocznego.
    // ⚠️ „SWIEZY" TO BIEL Z NUTA PALETY, NIE BIEL NEUTRALNA. Na przepalonym polu neutralna biel
    // przemnozona przez wlasne, nizsze oswietlenie wraca jako SZAROSC — a krem ma czytac sie jak
    // gesta maz, nie jak brud. 18% zmierzonej barwy wystarcza, zeby odzyskal cieplo, i nie rusza
    // mechaniki: swiezy dalej jest najjasniejszy, jaki bywa.
    const swiezyDzien = std.mix(BIEL, KREM, d.f32(0.18));
    const swiezyNoc = std.mix(BIEL, NOC_WIECZKO_CIEN, d.f32(0.18));
    const dojrzalosc = std.smoothstep(d.f32(0.02), d.f32(0.70), wiek);
    const barwaKremuDzien = std.mix(swiezyDzien, KREM_CIEPLY, dojrzalosc);
    const barwaKremuNoc = std.mix(swiezyNoc, NOC_KREM_DOJRZALY, dojrzalosc);
    const barwaKremu = std.mix(barwaKremuDzien, barwaKremuNoc, pF);
    // Krawedzie pekniec: grubosc tuz nad progiem scinania jest ciemniejsza, wiec platki dostaja
    // obwodke i pekanie widac takze wtedy, gdy warstwa jest juz mocno wyschnieta.
    const krawedz = d.f32(1)
      - std.smoothstep(d.f32(STALE_WYSYCHANIA.prog), d.f32(GRUBOSC_PELNEJ_WARSTWY), grubosc);
    const kremZKrawedzia = std.mul(barwaKremu, d.f32(1) - krawedz * d.f32(0.45));
    // ⛔ KREM JEST OSWIETLONY, A NIE SWIECI. Lezy NA powierzchni, wiec dostaje glownie swiatlo
    // otoczenia — to dlatego biala warstwa na rozpalonym polu wychodzi CIEMNIEJSZA niz to pole.
    const oswietlenieKremu = oswietlenieOtoczenia * d.f32(0.78)
      + mocEkranu * d.f32(0.26)
      + d.f32(PODSWIETLENIE_KREMU_NOC) * pF;

    // ⛔ MATERIAL WARSTWY: POLPRZEZROCZYSTOSC + POLYSK + RANT. Uzasadnienie i objaw, ktory to
    // naprawia (szary plaster zjadajacy garby chmurki) — patrz „MATERIAL WARSTWY KREMU" wyzej.

    // 1. POLPRZEZROCZYSTOSC. Krycie NIGDY nie dochodzi do 1, wiec pod warstwa zawsze cos widac:
    // nad chmurka jej garby, nad polem — przygaszony blask. Swieza maz jest rzadsza i kryje
    // slabiej niz dojrzala, ktora juz zmatowiala.
    const kryciePelne = std.mix(d.f32(KRYCIE_SWIEZE), d.f32(KRYCIE_DOJRZALE), dojrzalosc);
    const alfaKremu = std.smoothstep(d.f32(0), d.f32(GRUBOSC_PELNEGO_KRYCIA), grubosc) * kryciePelne;
    const zWarstwa = std.mix(zChmurka, std.mul(kremZKrawedzia, oswietlenieKremu), alfaKremu);

    // 2. RANT — cienki ciemniejszy pasek DOKLADNIE tam, gdzie warstwa sie konczy: pasmo grubosci
    // miedzy „nie ma nic" a „jest juz plaska warstwa". Bez niego krem jest naklejka bez grubosci.
    // ⚠️ Liczony z GRUBOSCI, nie z odleglosci do krawedzi smugi — dzieki temu obchodzi takze
    // dziury po pekaniu, a nie tylko obrys pociagniecia.
    const rant = std.smoothstep(d.f32(0), d.f32(RANT_OD), grubosc)
      * (d.f32(1) - std.smoothstep(d.f32(RANT_OD), d.f32(RANT_DO), grubosc));
    const zRantem = std.mul(zWarstwa, d.f32(1) - rant * d.f32(SILA_RANTU));

    // 3. POLYSK — wilgotny refleks wzdluz grzbietu smugi. Normalna z nachylenia warstwy, swiatlo
    // z kierunku jadra (`WYSOKOSC_ZRODLA` nad plaszczyzna kafla), model polowy drogi.
    // ⚠️ Odblask niesie barwe ZRODLA (`barwaEkranu`), nie kremu: mokra maz odbija to, co na nia
    // swieci — w dzien cieple bielenie, w nocy blekit. To jest tez powod, dla ktorego swieci go
    // `mocPadajaca`, a nie `mocEkranu`: refleks powstaje na WIERZCHU warstwy, przed przeslona.
    const normalna = std.normalize(d.vec3f(
      -nachylenie.x * d.f32(WYPUKLOSC_WARSTWY),
      -nachylenie.y * d.f32(WYPUKLOSC_WARSTWY),
      1,
    ));
    const doZrodla = std.sub(srodekPola, p);
    const kierunekSwiatla = std.normalize(d.vec3f(doZrodla.x, doZrodla.y, d.f32(WYSOKOSC_ZRODLA)));
    const polowaDrogi = std.normalize(std.add(kierunekSwiatla, d.vec3f(0, 0, 1)));
    const odblask = std.pow(
      std.max(std.dot(normalna, polowaDrogi), d.f32(0)),
      d.f32(OSTROSC_POLYSKU),
    );
    // Mokra warstwa odbija, wchlonieta juz nie — to ta sama miara dojrzalosci, ktora zmienia
    // barwe, wiec bramka dojrzewania widzi obie zmiany naraz.
    const mokrosc = std.mix(d.f32(POLYSK_SWIEZY), d.f32(POLYSK_DOJRZALY), dojrzalosc);
    const polysk = odblask * mokrosc * alfaKremu * std.clamp(mocPadajaca, d.f32(0.35), d.f32(1.6));
    const zKremem = std.add(zRantem, std.mul(barwaEkranu, polysk));

    // --- PODPOWIEDZ GESTU --------------------------------------------------------------------
    // ⛔ RYSOWANA W SHADERZE, NAD CZOLEM CHMURKI — a wiec dokladnie tam, gdzie malowanie w ogole
    // sie liczy. Warunek „kiedy" siedzi w `src/ui/podpowiedz.ts` i dochodzi tu jedna liczba
    // (`uniformSceny.$.podpowiedz`, 0 albo 1); tutaj mieszka wylacznie „jak to wyglada".
    //
    // ⚠️ RYSUJE SIE NA KREMIE, NIE POD NIM. Gracz, ktory dostaje podpowiedz, z definicji nie
    // namalowal jeszcze niczego (patrz `czyPokazacPodpowiedz`), wiec kolejnosc nie ma jak zaslonic
    // jego pracy — a duch pod warstwa bylby niewidoczny w jedynym przypadku, w ktorym cos na
    // czole lezy: po wyczyszczeniu maski w nocy, gdy podpowiedzi i tak juz nie ma.
    const silaPodpowiedzi = uniformSceny.$.podpowiedz;
    // Tam i z powrotem po sinusie: ruch zwalnia na koncach i przyspiesza w polowie, czyli ma
    // rytm prawdziwego pociagniecia, a nie przesuwu ze stala predkoscia.
    const wychylenie = std.sin(czas * d.f32(PODPOWIEDZ_TEMPO));
    const srodekPalca = d.vec2f(d.f32(PODPOWIEDZ_WEDROWKA) * wychylenie, d.f32(PODPOWIEDZ_Y));
    const doPalca = std.length(std.sub(pc, srodekPalca));
    const plamaPalca = d.f32(1)
      - std.smoothstep(d.f32(PODPOWIEDZ_PROMIEN * 0.35), d.f32(PODPOWIEDZ_PROMIEN), doPalca);
    // Obrys — ten sam chwyt, ktorym `rant` mowi, ze prawdziwy krem LEZY na chmurce, a nie w niej.
    // Na jasnej chmurce ciemna obwodka niesie wiecej kontrastu niz samo rozjasnienie srodka.
    const obrysPalca = std.smoothstep(d.f32(PODPOWIEDZ_PROMIEN * 0.45), d.f32(PODPOWIEDZ_PROMIEN * 0.95), doPalca)
      * (d.f32(1) - std.smoothstep(d.f32(PODPOWIEDZ_PROMIEN * 0.95), d.f32(PODPOWIEDZ_PROMIEN * 1.55), doPalca));
    // OGON KOMETY ZA PALCEM. ⛔ TO ON NIESIE „POZIOMO", A NIE SAMA WEDRUJACA PLAMA: jedno ujecie
    // (zrzut, oko gracza w pierwszej sekundzie) pokazuje plame w jednym miejscu i nie mowi
    // o kierunku niczego. Pochodna toru (`cos`) daje znak kierunku, wiec ogon zawsze wlecze sie
    // z wlasciwej strony i na zawrocie przerzuca sie sam.
    const kierunek = std.cos(czas * d.f32(PODPOWIEDZ_TEMPO));
    const wzdluz = (srodekPalca.x - pc.x) * std.sign(kierunek);
    const wOgonie = std.smoothstep(d.f32(0), d.f32(PODPOWIEDZ_PROMIEN * 0.5), wzdluz)
      * (d.f32(1) - std.smoothstep(d.f32(PODPOWIEDZ_OGON * 0.25), d.f32(PODPOWIEDZ_OGON), wzdluz))
      * (d.f32(1) - std.smoothstep(d.f32(PODPOWIEDZ_PROMIEN * 0.30), d.f32(PODPOWIEDZ_PROMIEN * 0.85),
        std.abs(pc.y - d.f32(PODPOWIEDZ_Y))));
    // CALY TOR JAKO KAPSULA — smuga, ktora gest ma zostawic, widoczna zanim palec tam dojedzie.
    // ⚠️ Odleglosc do ODCINKA, nie do prostokata: zaokraglone konce czytaja sie jak koniec
    // pociagniecia pedzlem, a scieta krawedz jak naklejony pasek. To ten sam ksztalt, ktory
    // prawdziwy pedzel odciska w masce (`logika/odcinek.ts`), tylko zamrozony na calej trasie.
    const doToru = std.length(d.vec2f(
      std.max(std.abs(pc.x) - d.f32(PODPOWIEDZ_WEDROWKA), d.f32(0)),
      pc.y - d.f32(PODPOWIEDZ_Y),
    ));
    const wPasie = d.f32(1)
      - std.smoothstep(d.f32(PODPOWIEDZ_PROMIEN * 0.45), d.f32(PODPOWIEDZ_PROMIEN * 0.95), doToru);
    // ⛔ MASKA CZOLA, NIE CALEGO KAFLA: sylwetka chmurki razy zanik przy linii oczu. Bez niej duch
    // wyjechalby na swiecaca powierzchnie, czyli pokazywalby gest tam, gdzie nie daje on punktow.
    const naCzole = maskaChmurki
      * (d.f32(1) - std.smoothstep(d.f32(LINIA_CZOLA), d.f32(LINIA_CZOLA + PODPOWIEDZ_ZANIK), pc.y));
    const duch = silaPodpowiedzi * naCzole;
    // Barwa swiezego kremu tej fazy — podpowiedz pokazuje ten sam material, ktory gracz zaraz
    // rozsmaruje, wiec nie wnosi do kadru zadnej nowej wartosci koloru.
    const barwaDucha = std.mix(swiezyDzien, swiezyNoc, pF);
    const alfaDucha = std.clamp(
      plamaPalca * d.f32(PODPOWIEDZ_KRYCIE)
      + wOgonie * d.f32(PODPOWIEDZ_KRYCIE_OGONA)
      + wPasie * d.f32(PODPOWIEDZ_KRYCIE_TORU),
      d.f32(0),
      d.f32(1),
    ) * duch;
    const zDuchem = std.mix(
      zKremem,
      std.mul(barwaDucha, oswietlenieChmurki * d.f32(PODPOWIEDZ_ROZJASNIENIE)),
      alfaDucha,
    );
    const zPodpowiedzia = std.mul(zDuchem, d.f32(1) - obrysPalca * d.f32(PODPOWIEDZ_SILA_OBRYSU) * duch);

    // --- WINIETA -----------------------------------------------------------------------------
    // Zacisniecie kadru przy niskim pokryciu. Liczona od srodka KAFLA (nie pola), bo to kafel
    // ma sie dusic. Przy pelnej ochronie pierscien cofa sie na sama krawedz.
    const odSrodkaKafla = std.length(std.sub(p, d.vec2f(0.5, 0.5)));
    const promienWiniety = std.mix(d.f32(PROMIEN_WINIETY_CIASNO), d.f32(PROMIEN_WINIETY_LUZNO), ochrona);
    const winieta = d.f32(1) - d.f32(SILA_WINIETY)
      * std.smoothstep(promienWiniety, promienWiniety + d.f32(MIEKKOSC_WINIETY), odSrodkaKafla);

    // --- TONOWANIE ---------------------------------------------------------------------------
    const tonowany = aces(std.mul(std.mul(zPodpowiedzia, winieta), d.f32(EKSPOZYCJA)));
    return std.pow(tonowany, d.vec3f(1 / GAMMA));
  });

  return { uniformSceny, kolorSceny };
}

/** Typ funkcji `kolorSceny` — potrzebny przyrzadowi, ktory wola ja z wlasnego potoku. */
export type KolorSceny = ReturnType<typeof stworzObraz>['kolorSceny'];
