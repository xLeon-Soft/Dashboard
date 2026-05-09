import { Component, OnInit, OnDestroy, computed, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DashboardService } from '../../services/dashboard';
import { ResumenPorDia } from '../../models/dashboard';
import { Subscription } from 'rxjs';

interface PuntoSVG { x: number; y: number; dia: ResumenPorDia; }

@Component({
  selector: 'app-tendencias',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tendencias.html',
  styleUrls: ['./tendencias.scss']
})
export class Tendencias implements OnInit, OnDestroy {
  Math = Math;

  cargando = signal(true);
  error    = signal('');
  dias     = signal<ResumenPorDia[]>([]);
  hoveredDia = signal<ResumenPorDia | null>(null);
  tooltipX   = signal(0);
  tooltipY   = signal(0);

  private sub?: Subscription;

  // ── computed ────────────────────────────────────────────────

  promedioDiario = computed(() => {
    const d = this.dias();
    return d.length ? Math.round(d.reduce((s, i) => s + i.personas, 0) / d.length) : 0;
  });

  maxPersonas = computed(() =>
    this.dias().length ? Math.max(...this.dias().map(d => d.personas)) : 0
  );

  minPersonas = computed(() =>
    this.dias().length ? Math.min(...this.dias().map(d => d.personas)) : 0
  );

  crecimientoTotal = computed(() => {
    const d = this.dias();
    if (d.length < 2) return 0;
    const first = d[0].personas, last = d[d.length - 1].personas;
    return first ? Math.round(((last - first) / first) * 100) : 0;
  });

  mejorDia = computed(() =>
    this.dias().reduce((best, d) => d.personas > best.personas ? d : best,
      { fecha: '—', personas: 0, hombres: 0, mujeres: 0, eventos: 0 } as ResumenPorDia)
  );

  // Trend direction per day (up/down vs previous)
  tendenciaDias = computed(() =>
    this.dias().map((d, i) => ({
      ...d,
      tendencia: i === 0 ? 'neutral' :
        d.personas > this.dias()[i - 1].personas ? 'up' :
        d.personas < this.dias()[i - 1].personas ? 'down' : 'neutral',
      cambio: i === 0 ? 0 : d.personas - this.dias()[i - 1].personas
    }))
  );

  // SVG path for the combined chart (personas, hombres, mujeres)
  readonly W = 1000;
  readonly H = 260;
  readonly PAD = 50;

  puntosSVG = computed<PuntoSVG[]>(() => {
    const d = this.dias();
    if (!d.length) return [];
    const max = this.maxPersonas() || 1;
    const step = (this.W - this.PAD * 2) / Math.max(d.length - 1, 1);
    return d.map((dia, i) => ({
      x: this.PAD + i * step,
      y: this.H - this.PAD - ((dia.personas / max) * (this.H - this.PAD * 2)),
      dia
    }));
  });

  puntosHombres = computed<PuntoSVG[]>(() => {
    const d = this.dias();
    if (!d.length) return [];
    const max = this.maxPersonas() || 1;
    const step = (this.W - this.PAD * 2) / Math.max(d.length - 1, 1);
    return d.map((dia, i) => ({
      x: this.PAD + i * step,
      y: this.H - this.PAD - ((dia.hombres / max) * (this.H - this.PAD * 2)),
      dia
    }));
  });

  puntosMujeres = computed<PuntoSVG[]>(() => {
    const d = this.dias();
    if (!d.length) return [];
    const max = this.maxPersonas() || 1;
    const step = (this.W - this.PAD * 2) / Math.max(d.length - 1, 1);
    return d.map((dia, i) => ({
      x: this.PAD + i * step,
      y: this.H - this.PAD - ((dia.mujeres / max) * (this.H - this.PAD * 2)),
      dia
    }));
  });

  pathPersonas = computed(() => this.buildPath(this.puntosSVG()));
  pathHombres  = computed(() => this.buildPath(this.puntosHombres()));
  pathMujeres  = computed(() => this.buildPath(this.puntosMujeres()));

  areaPersonas = computed(() => {
    const pts = this.puntosSVG();
    if (!pts.length) return '';
    const last = pts[pts.length - 1];
    return `${this.pathPersonas()} L ${last.x} ${this.H - this.PAD} L ${this.PAD} ${this.H - this.PAD} Z`;
  });

  // Heatmap: 7 columns (days of week), weeks as rows
  heatmapCells = computed(() => {
    return this.dias().map(d => {
      const personas = d.personas;
      const max = this.maxPersonas() || 1;
      const intensity = Math.round((personas / max) * 4); // 0-4
      return { fecha: d.fecha, personas, intensity };
    });
  });

  // Simple linear forecast (next 3 days)
  previsiones = computed(() => {
    const d = this.dias();
    if (d.length < 3) return [];
    const n = d.length;
    const sumX = d.reduce((s, _, i) => s + i, 0);
    const sumY = d.reduce((s, day) => s + day.personas, 0);
    const sumXY = d.reduce((s, day, i) => s + i * day.personas, 0);
    const sumXX = d.reduce((s, _, i) => s + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n;
    return [1, 2, 3].map(offset => ({
      dia: offset,
      valor: Math.max(0, Math.round(intercept + slope * (n - 1 + offset)))
    }));
  });

  // ── lifecycle ────────────────────────────────────────────────

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
        },
        error: () => {
          this.error.set('No se pudieron cargar los datos de tendencias.');
          this.cargando.set(false);
        }
      });
    } else {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ── helpers ──────────────────────────────────────────────────

  private buildPath(pts: PuntoSVG[]): string {
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  yLabels = computed(() => {
    const max = this.maxPersonas();
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, i) => ({
      y: this.PAD + (i / steps) * (this.H - this.PAD * 2),
      val: Math.round(max - (i / steps) * max)
    }));
  });

  onDotHover(pt: PuntoSVG, event: MouseEvent): void {
    this.hoveredDia.set(pt.dia);
    this.tooltipX.set(event.clientX + 12);
    this.tooltipY.set(event.clientY - 8);
  }

  onDotLeave(): void { this.hoveredDia.set(null); }
}
