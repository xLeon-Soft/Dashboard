import { Component, OnInit, OnDestroy, computed, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard';
import { ResumenPorDia } from '../../models/dashboard';
import { Subscription } from 'rxjs';

interface RangoFecha { desde: string; hasta: string; }
interface ChartDiaRow { i: number; diaA: ResumenPorDia | null; diaB: ResumenPorDia | null; }

@Component({
  selector: 'app-comparaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comparaciones.html',
  styleUrls: ['./comparaciones.scss']
})
export class Comparaciones implements OnInit, OnDestroy {
  Math = Math;

  cargando = signal(true);
  error    = signal('');
  dias     = signal<ResumenPorDia[]>([]);

  // Date range pickers (YYYY-MM-DD)
  rangoA = signal<RangoFecha>({ desde: '', hasta: '' });
  rangoB = signal<RangoFecha>({ desde: '', hasta: '' });

  private sub?: Subscription;

  // ── derived: filtered ranges ───────────────────────────────
  diasRangoA = computed(() => this.filtrarRango(this.dias(), this.rangoA()));
  diasRangoB = computed(() => this.filtrarRango(this.dias(), this.rangoB()));

  totalesA = computed(() => this.sumarDias(this.diasRangoA()));
  totalesB = computed(() => this.sumarDias(this.diasRangoB()));

  // Comparison metrics
  comparaciones = computed(() => {
    const a = this.totalesA(), b = this.totalesB();
    const mk = (label: string, va: number, vb: number) => {
      const diff = vb - va;
      const pct  = va ? Math.round((diff / va) * 100) : 0;
      return { label, a: va, b: vb, diff, pct, positivo: diff >= 0 };
    };
    return [
      mk('Personas',  a.personas, b.personas),
      mk('Hombres',   a.hombres,  b.hombres),
      mk('Mujeres',   a.mujeres,  b.mujeres),
      mk('Eventos',   a.eventos,  b.eventos),
    ];
  });

  // Max value for charts
  maxChart = computed(() => {
    const vals = this.comparaciones().flatMap(c => [c.a, c.b]);
    return Math.max(...vals, 1);
  });

  // Days with highest activity in each range
  diaConMasA = computed(() =>
    this.diasRangoA().reduce((best, d) => d.personas > best.personas ? d : best,
      { fecha: '—', personas: 0, hombres: 0, mujeres: 0, eventos: 0 } as ResumenPorDia)
  );

  diaConMasB = computed(() =>
    this.diasRangoB().reduce((best, d) => d.personas > best.personas ? d : best,
      { fecha: '—', personas: 0, hombres: 0, mujeres: 0, eventos: 0 } as ResumenPorDia)
  );

  // Daily comparison chart (aligned by index, max 7 days each)
  chartDias = computed<ChartDiaRow[]>(() => {
    const a = this.diasRangoA().slice(-7);
    const b = this.diasRangoB().slice(-7);
    const n = Math.max(a.length, b.length);
    return Array.from({ length: n }, (_, i): ChartDiaRow => ({
      i,
      diaA: a[i] ?? null,
      diaB: b[i] ?? null,
    }));
  });

  maxDiario = computed(() => {
    const vals = this.chartDias().flatMap(r => [
      r.diaA?.personas ?? 0, r.diaB?.personas ?? 0
    ]);
    return Math.max(...vals, 1);
  });

  // Quick stats availability
  rangoACargado = computed(() => this.diasRangoA().length > 0);
  rangoBCargado = computed(() => this.diasRangoB().length > 0);
  ambosCargados = computed(() => this.rangoACargado() && this.rangoBCargado());

  constructor(
    private dashboardService: DashboardService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.sub = this.dashboardService.getEstadisticasLive(10).subscribe({
        next: (resp) => {
          this.dias.set(resp.por_dia ?? []);
          this.cargando.set(false);
          // Auto-set default ranges if not set
          if (resp.por_dia && resp.por_dia.length >= 2 && !this.rangoA().desde) {
            this.setDefaultRanges(resp.por_dia);
          }
        },
        error: () => {
          this.error.set('No se pudieron cargar los datos de comparación.');
          this.cargando.set(false);
        }
      });
    } else {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ── helpers ────────────────────────────────────────────────
  private setDefaultRanges(dias: ResumenPorDia[]): void {
    const mid = Math.floor(dias.length / 2);
    const a0 = dias[0], aZ = dias[mid - 1] ?? dias[0];
    const b0 = dias[mid], bZ = dias[dias.length - 1];
    this.rangoA.set({ desde: this.fechaToInput(a0.fecha), hasta: this.fechaToInput(aZ.fecha) });
    this.rangoB.set({ desde: this.fechaToInput(b0.fecha), hasta: this.fechaToInput(bZ.fecha) });
  }

  private filtrarRango(dias: ResumenPorDia[], rango: RangoFecha): ResumenPorDia[] {
    if (!rango.desde && !rango.hasta) return dias;
    return dias.filter(d => {
      const f = this.fechaToInput(d.fecha);
      if (rango.desde && f < rango.desde) return false;
      if (rango.hasta && f > rango.hasta) return false;
      return true;
    });
  }

  private sumarDias(dias: ResumenPorDia[]) {
    return dias.reduce(
      (acc, d) => ({
        personas: acc.personas + d.personas,
        hombres:  acc.hombres  + d.hombres,
        mujeres:  acc.mujeres  + d.mujeres,
        eventos:  acc.eventos  + d.eventos,
      }),
      { personas: 0, hombres: 0, mujeres: 0, eventos: 0 }
    );
  }

  fechaToInput(f: string): string {       
    if (!f) return '';
    // Backend returns YYYY-MM-DD; handle both formats for safety
    if (f.includes('/')) {
      const [d, m, y] = f.split('/');
      return `${y}-${m}-${d}`;
    }
    // Already YYYY-MM-DD
    return f;
  }

  onRangoADesde(e: Event) { this.rangoA.update(r => ({ ...r, desde: (e.target as HTMLInputElement).value })); }
  onRangoAHasta(e: Event) { this.rangoA.update(r => ({ ...r, hasta: (e.target as HTMLInputElement).value })); }
  onRangoBDesde(e: Event) { this.rangoB.update(r => ({ ...r, desde: (e.target as HTMLInputElement).value })); }
  onRangoBHasta(e: Event) { this.rangoB.update(r => ({ ...r, hasta: (e.target as HTMLInputElement).value })); }

  barWidth(v: number): number { return Math.round((v / this.maxChart()) * 100); }
  barWidthDiario(v: number): number { return Math.round((v / this.maxDiario()) * 100); }

  pctHombresA = computed(() => {
    const t = this.totalesA();
    return t.personas ? Math.round((t.hombres / t.personas) * 100) : 0;
  });
  pctMujeresA = computed(() => 100 - this.pctHombresA());
  pctHombresB = computed(() => {
    const t = this.totalesB();
    return t.personas ? Math.round((t.hombres / t.personas) * 100) : 0;
  });
  pctMujeresB = computed(() => 100 - this.pctHombresB());
}
