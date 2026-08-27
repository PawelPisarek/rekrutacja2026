/** Czy przegladarka wystawia WebGPU. Wydzielone z `main.ts`, zeby dalo sie to przetestowac
 *  bez przegladarki — sama bramka jest jedna linijka, ale jest jedynym miejscem, ktore decyduje
 *  o tym, czy strona w ogole cokolwiek narysuje. */
export function czyWebGPUDostepne(nawigator: { gpu?: unknown }): boolean {
  return nawigator.gpu != null;
}

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
