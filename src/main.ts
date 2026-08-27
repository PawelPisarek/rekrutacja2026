import { czyWebGPUDostepne } from './logika/srodowisko.ts';

const kanwa = document.querySelector('#kanwa') as HTMLCanvasElement;
const brak = document.querySelector('#brak') as HTMLDivElement;

if (!czyWebGPUDostepne(navigator)) {
  kanwa.style.display = 'none';
  brak.classList.add('widoczny');
} else {
  const { start } = await import('./gpu/scena.ts');
  await start(kanwa);
}
