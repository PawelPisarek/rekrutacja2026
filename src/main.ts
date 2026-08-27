import { DOPISKI_BRAKU, zbadajWebGPU } from './logika/srodowisko.ts';
import type { PowodBrakuSceny } from './logika/srodowisko.ts';

/**
 * ⛔ ZADNA SCIEZKA NIE MOZE SKONCZYC SIE PUSTYM KAFLEM.
 *
 * Do 2026-08-27 ten plik sprawdzal wylacznie, czy `navigator.gpu` istnieje, a potem robil
 * `await start(kanwa)` BEZ `try/catch`. Na telefonie z Androidem API istnialo, adaptera nie bylo,
 * `tgpu.init()` sie wywracalo — i gornopoziomowe `await` odrzucalo w cisze. Uzytkownik zobaczyl
 * pusty prostokat: ani komunikatu, ani sladu w konsoli, czyli nie bylo nawet od czego zaczac
 * diagnozy. Dlatego CALA sciezka startu siedzi dzis w `try/catch`, a kazde niepowodzenie ma
 * dwa wyjscia: zdanie dla czytelnika i powod w konsoli dla tego, kto to bedzie naprawial.
 */

const kanwa = document.querySelector('#kanwa') as HTMLCanvasElement;
const brak = document.querySelector('#brak') as HTMLDivElement;

/**
 * Pokazuje zastepnik zamiast sceny. Zdanie bazowe stoi w `index.html` (i jest cytowane w specu),
 * wiec tutaj dokłada sie WYLACZNIE to, czego tam nie ma — patrz `DOPISKI_BRAKU`.
 */
function pokazBrak(powod: PowodBrakuSceny, blad?: unknown): void {
  // ⚠️ Konsola dostaje powod ZAWSZE, takze przy `brak-api`. To jedyny slad, po ktorym da sie
  // odroznic „przegladarka bez WebGPU" od „urzadzenie bez ukladu" na cudzym telefonie.
  console.error(`[fluff] scena nie ruszyla: ${powod}`, blad ?? '');
  kanwa.style.display = 'none';
  const dopisek = DOPISKI_BRAKU[powod];
  if (dopisek !== null) {
    const akapit = document.createElement('p');
    akapit.textContent = dopisek;
    brak.append(akapit);
  }
  brak.classList.add('widoczny');
}

try {
  const badanie = await zbadajWebGPU(navigator);
  if (!badanie.dziala) {
    pokazBrak(badanie.powod!, badanie.blad);
  } else {
    // ⚠️ Import modulu sceny tez jest w `try` — on ciagnie TypeGPU i potrafi rzucic sam z siebie.
    const { start } = await import('./gpu/scena.ts');
    await start(kanwa);
  }
} catch (blad) {
  pokazBrak('blad-startu', blad);
}
