/** Czy przegladarka wystawia WebGPU. Wydzielone z `main.ts`, zeby dalo sie to przetestowac
 *  bez przegladarki — sama bramka jest jedna linijka, ale jest jedynym miejscem, ktore decyduje
 *  o tym, czy strona w ogole cokolwiek narysuje.
 *
 *  ⚠️ ODPOWIADA NA PYTANIE „CZY API ISTNIEJE", A NIE „CZY WEBGPU DZIALA" — patrz `zbadajWebGPU`
 *  nizej, ktore jej uzywa jako bramki wstepnej. Ta funkcja zostaje osobno, bo jest synchroniczna
 *  i to ona jest otestowana od zadania A. */
export function czyWebGPUDostepne(nawigator: { gpu?: unknown }): boolean {
  return nawigator.gpu != null;
}

/**
 * ⛔ TRZY POWODY, DLA KTORYCH SCENA NIE RUSZA — I DO 2026-08-27 OBSLUGIWANY BYL TYLKO PIERWSZY.
 *
 * Uzytkownik otworzyl wydana strone na telefonie z Androidem i zobaczyl PUSTY KAFEL zamiast
 * komunikatu. Diagnoza: `navigator.gpu` na tym urzadzeniu ISTNIEJE (Chrome je wystawia), wiec
 * `czyWebGPUDostepne` przepuszczalo — ale `requestAdapter()` oddawalo `null`, bo urzadzenie nie
 * ma zgodnego ukladu graficznego. `tgpu.init()` wywracalo sie, gornopoziomowe `await` w `main.ts`
 * odrzucalo i NIKT tego nie lapal. Zero sladu na ekranie, zero w konsoli.
 *
 * Stad rozroznienie: obecnosc API to za malo, trzeba SPROBOWAC wziac adapter.
 *
 * `blad-startu` nie pochodzi stad — zglasza go `main.ts`, gdy adapter byl, a wywrocil sie import
 * modulu sceny, `tgpu.init()` albo budowa potokow. Siedzi w tym samym typie, zeby kazdy powod
 * mial dokladnie jedno miejsce, w ktorym jest nazwany, i zeby `DOPISKI_BRAKU` nie mialo luk.
 */
export type PowodBrakuSceny = 'brak-api' | 'brak-adaptera' | 'blad-adaptera' | 'blad-startu';

export interface WynikBadaniaGpu {
  dziala: boolean;
  /** `null` wylacznie wtedy, gdy adapter naprawde wrocil. */
  powod: PowodBrakuSceny | null;
  /** Wyjatek z `requestAdapter` — idzie do konsoli, nie na ekran. */
  blad?: unknown;
}

/** Ksztalt `navigator` w tej jednej sprawie. Wlasny, bo `@webgpu/types` opisuje przegladarke,
 *  a ten kod ma dac sie zawolac na atrapie w tescie bez GPU. */
export interface NawigatorZGpu {
  gpu?: { requestAdapter?: () => Promise<unknown> };
}

/**
 * Czy WebGPU na tym urzadzeniu NAPRAWDE zadziala: probuje wziac adapter i mowi, czego zabraklo.
 *
 * ⛔ `null` Z `requestAdapter` NIE JEST BLEDEM — to udana odpowiedz „nie ma czym rysowac"
 * i wlasnie ona wychodzila na telefonie uzytkownika. Wyjatek to osobny przypadek (`blad-adaptera`):
 * spotyka sie go, gdy `gpu` istnieje, ale nie jest tym, czym udaje (np. atrapa bez `requestAdapter`).
 */
export async function zbadajWebGPU(nawigator: NawigatorZGpu): Promise<WynikBadaniaGpu> {
  if (!czyWebGPUDostepne(nawigator)) return { dziala: false, powod: 'brak-api' };
  try {
    const adapter = await nawigator.gpu!.requestAdapter!();
    if (adapter == null) return { dziala: false, powod: 'brak-adaptera' };
    return { dziala: true, powod: null };
  } catch (blad) {
    return { dziala: false, powod: 'blad-adaptera', blad };
  }
}

/**
 * Zdanie DOPISYWANE do komunikatu w `#brak`, osobno dla kazdego powodu.
 *
 * ⛔ DOPISEK, A NIE CALY KOMUNIKAT — I TO NIE JEST OSZCZEDNOSC, TYLKO BRAK DUBLA. Zdanie
 * „Ta strona wymaga WebGPU. Odpal ja w Chrome albo na innym urzadzeniu." stoi w `index.html`
 * i jest cytowane w specyfikacji (`docs/design.md` §7, `docs/plan-wdrozenia.md`). Gdyby ten plik
 * ustawial CALY tekst, ta sama tresc zylaby w dwoch miejscach — a projekt raz juz oberwal za
 * zdublowana stala. Tutaj mieszka wylacznie to, czego w HTML-u nie ma.
 *
 * `brak-api` nie ma dopisku, bo zdanie z HTML-a mowi o nim wszystko: przegladarka nie ma WebGPU.
 * Pozostale trzy MAJA, bo przy nich rada „odpal ja w Chrome" jest mylaca — czytelnik JEST
 * w Chrome i to nie przegladarka jest problemem.
 */
export const DOPISKI_BRAKU: Record<PowodBrakuSceny, string | null> = {
  'brak-api': null,
  // ⚠️ TE TRZY NAPISY WIDZI UZYTKOWNIK, wiec sa po polsku Z ZNAKAMI DIAKRYTYCZNYMI — tak samo jak
  // zdanie w `index.html` i teksty kart w `src/ui/karta.ts`. Komentarze w kodzie zostaja bez.
  'brak-adaptera':
    'WebGPU jest w tej przeglądarce, ale to urządzenie nie udostępnia zgodnego układu graficznego.',
  'blad-adaptera':
    'WebGPU jest w tej przeglądarce, ale nie udało się zapytać o układ graficzny.',
  'blad-startu':
    'WebGPU jest w tej przeglądarce, ale scena nie wystartowała — szczegóły w konsoli.',
};

/**
 * ⛔ HUD JEST PRZYRZADEM DEWELOPERSKIM I W WYDANEJ WERSJI MA GO NIE BYC.
 *
 * Napis `pokrycie 91.3% noc-karta` w rogu kafla jest niezastapiony przy strojeniu i bezwartosciowy
 * dla kogos, kto wszedl obejrzec dodatek do strony marki — pokazuje mu wewnetrzna nazwe fazy
 * i liczbe, ktorej nie ma jak zinterpretowac. Zadanie D uczynilo go przy okazji BARDZIEJ widocznym
 * (doszla nazwa fazy), wiec przed wydaniem gasnie.
 *
 * ⛔ GASNIE, A NIE ZNIKA. Usuniecie HUD-a kosztowaloby przy nastepnym strojeniu odbudowanie go od
 * nowa, wiec zostaje — wylaczony domyslnie, z dwoma niezaleznymi wlacznikami:
 *
 *   1. tryb deweloperski (`import.meta.env.DEV`) — `npm run dev` pokazuje HUD bez pytania;
 *   2. parametr adresu `?hud` — dziala takze na wydanej stronie i na `npm run preview`, czyli
 *      tam, gdzie `DEV` jest juz falszem, a przyrzad wciaz bywa potrzebny.
 *
 * Jawne `?hud=0` (albo `?hud=false`) wygrywa z trybem deweloperskim — bez tego zrzutu „kafel bez
 * HUD-a" nie dalo by sie zrobic na serwerze deweloperskim, czyli wynik pomiaru zalezalby od tego,
 * ktorym poleceniem ktos akurat wystartowal strone.
 *
 * ⚠️ Bramki CDP HUD-a NIE czytaja — mierza przez `window.__sonda` i `window.__pomiar` — wiec
 * zgaszenie go niczego w nich nie rusza.
 */
export function czyPokazacHud(szukajkaAdresu: string, trybDeweloperski: boolean): boolean {
  const parametry = new URLSearchParams(szukajkaAdresu);
  if (!parametry.has('hud')) return trybDeweloperski;
  const wartosc = parametry.get('hud');
  return wartosc !== '0' && wartosc !== 'false';
}
