// ⛔ JEDYNE MIEJSCE, W KTORYM ZYJE ADRES BAZOWY. Nie dopisuj go drugi raz nigdzie indziej.
//
// Do 2026-08-27 ta sama sciezka byla wpisana na sztywno w czterech plikach: `vite.config.ts`
// i trzy bramki. Tego samego dnia miejsce wdrozenia zmienilo sie TRZY RAZY (inna nazwa
// repozytorium, potem wlasna subdomena w korzeniu, potem z powrotem GitHub Pages) — i przy
// czterech kopiach kazda taka zmiana rozjezdzala je po cichu. Objaw jest mylacy: bramka dostaje
// 404, sonda melduje „window.__gotowe nigdy sie nie ustawilo", i wyglada to na awarie aplikacji,
// a nie na zla sciezke.
//
// ⚠️ Ten projekt raz juz oberwal za zdublowana stala (`WROG` w skrypcie kontrolnym), wiec adres
// stoi tutaj, a `vite.config.ts` i bramki go IMPORTUJA. Po stronie samej aplikacji odpowiednikiem
// jest `import.meta.env.BASE_URL`, ktore Vite wylicza wlasnie z `BASE` — kod strony nie zna
// zadnej sciezki z palca.
//
// SPRAWDZIAN POPRAWNOSCI: zmiana `BASE` w tej jednej linii ma wystarczyc, zeby aplikacja i wszystkie
// trzy bramki dalej sie zgadzaly. Jesli trzeba poprawic cokolwiek jeszcze — przedrostek wyciekl.

/**
 * Sciezka, pod ktora stoi aplikacja = nazwa repozytorium na GitHub Pages. Ze znakiem `/` z obu stron.
 * Docelowo: https://pawelpisarek.github.io/rekrutacja2026/
 */
export const BASE = '/rekrutacja2026/';

/** Port `npm run dev` (Vite, tryb deweloperski). */
export const PORT_DEV = 5173;

/** Port `npm run preview` (Vite, podglad zbudowanego `dist/`). */
export const PORT_PODGLADU = 4173;

/**
 * ⚠️ `localhost`, NIE `127.0.0.1`. Vite nasluchuje na `localhost`, na macOS rozwiazywanym najpierw
 * jako IPv6; petla zwrotna po IPv4 potrafi nie odpowiedziec. Oba adresy licza sie jako bezpieczny
 * kontekst, wiec `navigator.gpu` jest dostepne — ale tylko pod jednym z nich cokolwiek stoi.
 * ⛔ WebGPU na `about:blank` jest `undefined` Z DEFINICJI. Nigdy tam nie diagnozuj.
 */
export const adresDev = () => `http://localhost:${PORT_DEV}${BASE}`;

/** Adres `npm run preview` — tego samego kodu, ale zbudowanego. */
export const adresPodgladu = () => `http://localhost:${PORT_PODGLADU}${BASE}`;
