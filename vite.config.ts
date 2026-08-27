import { defineConfig } from 'vite';
import typegpu from 'unplugin-typegpu/vite';
import { BASE } from './scripts/adres.mjs';

/**
 * ⛔ `base` NIE JEST TU WPISANE — jest IMPORTOWANE z `scripts/adres.mjs`.
 *
 * Ta wartosc musi zgadzac sie co do znaku z adresem, ktorego uzywaja bramki CDP. Gdy byla wpisana
 * osobno tutaj i osobno w trzech bramkach, zmiana miejsca wdrozenia (dwa razy w ciagu jednego dnia:
 * inna nazwa repozytorium, potem wlasna subdomena) rozjezdzala kopie po cichu — a objawem jest
 * „strona sie nie uruchomila", nie „zly przedrostek". Jedna stala, cztery czytelnicy.
 */
export default defineConfig({
  base: BASE,
  plugins: [typegpu({})],
});
