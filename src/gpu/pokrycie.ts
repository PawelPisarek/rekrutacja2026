import { tgpu, d, std } from 'typegpu';
import type { TgpuRoot } from 'typegpu';
import { GRUPA_ROBOCZA, GRUP_NA_OS, obszarWroga, PROG_POKRYCIA, uvTeksela } from './wspolne.ts';
import type { WidokMaski } from './wspolne.ts';

/**
 * Dwa liczniki atomikowe. `wroga` liczy sie co klatke od nowa razem z `pokryte`, choc jest stale —
 * gdyby brac je ze wzoru na CPU, kazda przyszla zmiana `obszarWroga` musialaby byc powtorzona
 * w drugim miejscu, a rozjazd objawilby sie pokryciem powyzej jedynki.
 */
const Liczniki = d.struct({
  wroga: d.atomic(d.u32),
  pokryte: d.atomic(d.u32),
});

/**
 * Licznik pokrycia obszaru chronionego.
 *
 * ⛔ POKRYCIE LICZY SIE PO CZOLE CHMURKI, NIE PO CALYM KAFLU. Krem wolno rozsmarowac gdziekolwiek
 * po swiecacym polu, ale punkty daje wylacznie to, co wyladowalo na gornej powierzchni chmurki.
 * Gdyby licznik zliczal caly kadr, dalo by sie „wygrac" zamalowujac puste rogi — a przy prostokacie
 * na caly kafel (tak bylo do zadania C2) celem malowania byl kafel, wiec gracz zaslanial soba
 * chmurke, czyli dokladnie te rzecz, dla ktorej maluje.
 */
export class Pokrycie {
  readonly #liczniki;
  readonly #potok;
  #ostatnie = 0;
  #odczytWToku = false;

  constructor(root: TgpuRoot, widokMaski: WidokMaski) {
    const liczniki = root.createMutable(Liczniki).$name('liczniki-pokrycia');

    const redukcja = tgpu.computeFn({
      in: { gid: d.builtin.globalInvocationId },
      workgroupSize: GRUPA_ROBOCZA,
    })((we) => {
      'use gpu';
      const xy = d.vec2u(we.gid.x, we.gid.y);
      const uv = uvTeksela(xy);
      if (obszarWroga(uv) > d.f32(0.5)) {
        std.atomicAdd(liczniki.$.wroga, 1);
        const teksel = std.textureLoad(widokMaski.$, xy, 0);
        if (teksel.x > d.f32(PROG_POKRYCIA)) {
          std.atomicAdd(liczniki.$.pokryte, 1);
        }
      }
    });

    this.#liczniki = liczniki;
    this.#potok = root.createComputePipeline({ compute: redukcja });
  }

  /** Zeruje liczniki i przelicza je od nowa z biezacej maski. Wolane co klatke. */
  krok(): void {
    this.#liczniki.write({ wroga: 0, pokryte: 0 });
    this.#potok.dispatchWorkgroups(GRUP_NA_OS, GRUP_NA_OS);
  }

  /**
   * Sciaga liczniki na CPU przez bufor posredni i `mapAsync` (robi to `TgpuBuffer.read()`).
   * ⚠️ ASYNCHRONICZNIE I RZADKO — synchroniczne czekanie na GPU zablokowaloby klatke, a jedna
   * klatka opoznienia nie ma znaczenia dla progu faz. Rownolegle odczyty sa odsiewane, zeby
   * kolejka nie rosla, gdy GPU nie nadaza.
   */
  async odczytaj(): Promise<void> {
    if (this.#odczytWToku) return;
    this.#odczytWToku = true;
    try {
      const wynik = await this.#liczniki.read();
      this.#ostatnie = wynik.wroga > 0 ? wynik.pokryte / wynik.wroga : 0;
    } finally {
      this.#odczytWToku = false;
    }
  }

  /** Udzial pokrytych tekseli wroga, 0..1. Wartosc z ostatniego udanego odczytu. */
  get ostatnie(): number {
    return this.#ostatnie;
  }
}
