import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { DashboardService } from '../../services/dashboard';
import { DashboardResponse, ResumenPorDia } from '../../models/dashboard';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {
  cargando = signal(true);
  error = signal('');
  data = signal<DashboardResponse | null>(null);
  ultimaActualizacion = signal('');
  pageSize = signal(3);
  currentPage = signal(1);
  tablePageSize = signal(7);
  currentTablePage = signal(1);

  apiUrl = 'http://127.0.0.1:8000';
  videoUrl = `${this.apiUrl}/video`;

  private refreshSubscription?: Subscription;

  maxPersonas = computed(() => {
    const items: ResumenPorDia[] = this.data()?.por_dia ?? [];
    return Math.max(...items.map((i: ResumenPorDia) => i.personas), 1);
  });

  totalPages = computed(() => {
    const items: ResumenPorDia[] = this.data()?.por_dia ?? [];
    return Math.max(1, Math.ceil(items.length / this.pageSize()));
  });

  paginaPorDia = computed(() => {
    const items: ResumenPorDia[] = this.data()?.por_dia ?? [];
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  });

  totalTablePages = computed(() => {
    const items: ResumenPorDia[] = this.data()?.por_dia ?? [];
    return Math.max(1, Math.ceil(items.length / this.tablePageSize()));
  });

  tablaPorDia = computed(() => {
    const items: ResumenPorDia[] = this.data()?.por_dia ?? [];
    const page = this.currentTablePage();
    const size = this.tablePageSize();
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  });

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.cargarDatos(true);
    this.iniciarActualizacionAutomatica();
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  iniciarActualizacionAutomatica(): void {
    this.refreshSubscription = interval(3000).subscribe(() => {
      this.cargarDatos(false);
    });
  }

  cargarDatos(mostrarLoader: boolean = false): void {
    if (mostrarLoader) {
      this.cargando.set(true);
    }

    this.error.set('');

    const isInitialLoad = this.data() === null;

    this.dashboardService.getEstadisticas().subscribe({
      next: (resp) => {
        this.data.set(resp);
        if (isInitialLoad) {
          this.currentPage.set(1);
          this.currentTablePage.set(1);
        }
        this.ultimaActualizacion.set(this.obtenerHoraActual());
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las estadísticas desde la API.');
        this.cargando.set(false);
      }
    });
  }

  obtenerHoraActual(): string {
    return new Date().toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  porcentajeBarra(valor: number): number {
    const max = this.maxPersonas();
    return max > 0 ? (valor / max) * 100 : 0;
  }

  setPage(page: number): void {
    const total = this.totalPages();
    this.currentPage.set(Math.min(Math.max(1, page), total));
  }

  prevPage(): void {
    this.setPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.setPage(this.currentPage() + 1);
  }

  setTablePage(page: number): void {
    const total = this.totalTablePages();
    this.currentTablePage.set(Math.min(Math.max(1, page), total));
  }

  prevTablePage(): void {
    this.setTablePage(this.currentTablePage() - 1);
  }

  nextTablePage(): void {
    this.setTablePage(this.currentTablePage() + 1);
  }

  totalGenero(): number {
    const dashboard = this.data();
    if (!dashboard) return 0;

    return (dashboard.totales.hombres ?? 0) + (dashboard.totales.mujeres ?? 0);
  }

  porcentajeHombres(): number {
    const dashboard = this.data();
    if (!dashboard) return 0;

    const total = this.totalGenero();
    if (total === 0) return 0;

    return Math.round(((dashboard.totales.hombres ?? 0) / total) * 100);
  }

  porcentajeMujeres(): number {
    const dashboard = this.data();
    if (!dashboard) return 0;

    const total = this.totalGenero();
    if (total === 0) return 0;

    return Math.round(((dashboard.totales.mujeres ?? 0) / total) * 100);
  }

  promedioPorEvento(): string {
    const dashboard = this.data();
    if (!dashboard || dashboard.totales.eventos === 0) {
      return '0';
    }

    return (dashboard.totales.personas / dashboard.totales.eventos).toFixed(1);
  }

  obtenerNivelNormalizado(porcentaje: number): number {
    const valor = 1 - porcentaje / 100;
    return Math.max(0, Math.min(1, valor));
  }

  trackByFecha(_: number, item: ResumenPorDia): string {
    return item.fecha;
  }
}