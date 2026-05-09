import { Component, OnInit, OnDestroy, computed, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DashboardService } from '../../services/dashboard';
import { DashboardResponse, ResumenPorDia } from '../../models/dashboard';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-distribucion-genero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './distribucion-genero.html',
  styleUrls: ['./distribucion-genero.scss']
})
export class DistribucionGenero implements OnInit, OnDestroy {
  Math = Math;

  cargando = signal(true);
  error = signal('');
  totales = signal<DashboardResponse['totales'] | null>(null);
  dias = signal<ResumenPorDia[]>([]);
  diaSeleccionado = signal<ResumenPorDia | null>(null);
  vista = signal<'total' | 'diaria'>('total');
  fechaInputRaw = signal<string>('');          // YYYY-MM-DD from input
  sinDatosEnFecha = signal(false);             // No data for chosen date

  private sub?: Subscription;
  private refreshSub?: Subscription;

  // ── computed ────────────────────────────────────────────────

  datosActivos = computed(() => {
    if (this.vista() === 'diaria') {
      if (this.sinDatosEnFecha()) return null;   // empty state
      return this.diaSeleccionado();
    }
    return this.totales();
  });

  porcentajeHombres = computed(() => {
    const d = this.datosActivos();
    if (!d || (d.hombres + d.mujeres) === 0) return 0;
    return Math.round((d.hombres / (d.hombres + d.mujeres)) * 100);
  });

  porcentajeMujeres = computed(() => {
    const d = this.datosActivos();
    if (!d || (d.hombres + d.mujeres) === 0) return 0;
    return 100 - this.porcentajeHombres();
  });

  dominante = computed(() => {
    const h = this.porcentajeHombres();
    const m = this.porcentajeMujeres();
    if (h === m) return 'Equilibrio';
    return h > m ? 'Hombres' : 'Mujeres';
  });

  diferencia = computed(() =>
    Math.abs(this.porcentajeHombres() - this.porcentajeMujeres())
  );

  fechaDisplay = computed(() => {
    const raw = this.fechaInputRaw();
    if (!raw) return '';
    if (raw.includes('-')) {
      const [y, m, d] = raw.split('-');
      return `${d}/${m}/${y}`;
    }
    return raw;
  });

  // Coordinates for labels inside pie chart
  labelCoordsMujeres = computed(() => {
    const m = this.porcentajeMujeres();
    if (m < 5) return null;
    const angleDeg = (m / 2) * 3.6;
    const rad = (angleDeg - 90) * Math.PI / 180;
    const r = 35; 
    return { x: 60 + r * Math.cos(rad), y: 60 + r * Math.sin(rad) };
  });

  labelCoordsHombres = computed(() => {
    const h = this.porcentajeHombres();
    const m = this.porcentajeMujeres();
    if (h < 5) return null;
    const angleDeg = (m + h / 2) * 3.6;
    const rad = (angleDeg - 90) * Math.PI / 180;
    const r = 35;
    return { x: 60 + r * Math.cos(rad), y: 60 + r * Math.sin(rad) };
  });

  // Hover states for tooltips
  hoveredSlice = signal<'hombres' | 'mujeres' | null>(null);
  mouseX = signal(0);
  mouseY = signal(0);

  // ── lifecycle ────────────────────────────────────────────────

  constructor(
    private dashboardService: DashboardService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.cargarDatos();
      // Auto-refresh every 10 seconds
      this.refreshSub = this.dashboardService.getEstadisticasLive(10).subscribe({
        next: (resp) => {
          this.totales.set(resp.totales);
          this.dias.set(resp.por_dia ?? []);
          // If we are in daily view, re-find the selected date
          if (this.vista() === 'diaria' && this.fechaInputRaw()) {
            this.buscarFecha(this.fechaInputRaw());
          }
        },
        error: (err) => {
          console.error('Error refreshing data:', err);
        }
      });
    } else {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.refreshSub?.unsubscribe();
  }

  // ── data loading ─────────────────────────────────────────────

  cargarDatos(): void {
    this.cargando.set(true);
    this.error.set('');
    this.sub = this.dashboardService.getEstadisticas().subscribe({
      next: (resp) => {
        this.totales.set(resp.totales);
        this.dias.set(resp.por_dia ?? []);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los datos de distribución.');
        this.cargando.set(false);
      }
    });
  }

  // ── actions ──────────────────────────────────────────────────

  onFechaSeleccionada(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.fechaInputRaw.set(raw);
    if (raw) {
      this.buscarFecha(raw);
    } else {
      this.verTotal();
    }
  }

  private buscarFecha(raw: string): void {
    // raw comes as YYYY-MM-DD from the date input
    // Backend may return dates as YYYY-MM-DD or DD/MM/YYYY
    // Try matching both formats
    const [y, m, d] = raw.split('-');
    const formatoSlash = `${d}/${m}/${y}`;
    const formatoDash = `${y}-${m}-${d}`;

    const encontrado = this.dias().find(dia =>
      dia.fecha === formatoSlash || dia.fecha === formatoDash
    );

    if (encontrado) {
      this.diaSeleccionado.set(encontrado);
      this.sinDatosEnFecha.set(false);
    } else {
      this.diaSeleccionado.set(null);
      this.sinDatosEnFecha.set(true);
    }
    this.vista.set('diaria');
  }

  verTotal(): void {
    this.vista.set('total');
    this.fechaInputRaw.set('');
    this.diaSeleccionado.set(null);
    this.sinDatosEnFecha.set(false);
  }

  seleccionarDia(dia: ResumenPorDia): void {
    this.diaSeleccionado.set(dia);
    this.sinDatosEnFecha.set(false);
    this.vista.set('diaria');
    // Sync the input with the selected day — handle both date formats
    if (dia.fecha.includes('/')) {
      const [d, m, y] = dia.fecha.split('/');
      this.fechaInputRaw.set(`${y}-${m}-${d}`);
    } else {
      // Already YYYY-MM-DD
      this.fechaInputRaw.set(dia.fecha);
    }
  }

  esDiaSeleccionado(dia: ResumenPorDia): boolean {
    return this.diaSeleccionado() === dia && this.vista() === 'diaria';
  }

  // Convenience helpers for SVG pie chart
  donutDash(pct: number): string {
    const circ = 2 * Math.PI * 30;
    return `${(pct / 100) * circ} ${circ}`;
  }

  // Tooltip interactions
  onSliceHover(event: MouseEvent, slice: 'hombres' | 'mujeres'): void {
    this.hoveredSlice.set(slice);
    this.mouseX.set(event.clientX);
    this.mouseY.set(event.clientY);
  }

  onSliceMove(event: MouseEvent): void {
    if (this.hoveredSlice()) {
      this.mouseX.set(event.clientX);
      this.mouseY.set(event.clientY);
    }
  }

  onSliceLeave(): void {
    this.hoveredSlice.set(null);
  }
}
