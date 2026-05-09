import { Component, OnInit, OnDestroy, computed, signal, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard';
import { ResumenPorDia, RegistroDetalle } from '../../models/dashboard';
import { Subscription } from 'rxjs';

interface Notificacion {
  id: number;
  tipo: 'hombre' | 'mujer' | 'alerta';
  mensaje: string;
  tiempo: string;
  leida: boolean;
}

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.scss']
})
export class Registro implements OnInit, OnDestroy {
  Math = Math;

  cargando = signal(true);
  error    = signal('');
  dias     = signal<ResumenPorDia[]>([]);

  // Notifications
  notificaciones = signal<Notificacion[]>([]);
  mostrarNotifs  = signal(false);
  private notifId = 0;

  // Table state
  filtroGenero   = signal<'todos' | 'Hombre' | 'Mujer'>('todos');
  filtroBusqueda = signal('');
  paginaActual   = signal(0);
  readonly POR_PAGINA = 10;

  private sub?: Subscription;

  // ── computed ────────────────────────────────────────────────

  // Build "registros" from por_dia (one row per day)
  todosLosRegistros = computed(() => this.dias());

  registrosFiltrados = computed(() => {
    let rows = this.todosLosRegistros();
    if (this.filtroBusqueda()) {
      const q = this.filtroBusqueda().toLowerCase();
      rows = rows.filter(r => r.fecha.toLowerCase().includes(q));
    }
    return rows;
  });

  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.registrosFiltrados().length / this.POR_PAGINA))
  );

  registrosPagina = computed(() => {
    const start = this.paginaActual() * this.POR_PAGINA;
    return this.registrosFiltrados().slice(start, start + this.POR_PAGINA);
  });

  // Stats
  totalPersonas = computed(() =>
    this.dias().reduce((s, d) => s + d.personas, 0)
  );
  totalHombres = computed(() =>
    this.dias().reduce((s, d) => s + d.hombres, 0)
  );
  totalMujeres = computed(() =>
    this.dias().reduce((s, d) => s + d.mujeres, 0)
  );
  totalEventos = computed(() =>
    this.dias().reduce((s, d) => s + d.eventos, 0)
  );
  pctHombres = computed(() =>
    this.totalPersonas() ? Math.round((this.totalHombres() / this.totalPersonas()) * 100) : 0
  );
  pctMujeres = computed(() => 100 - this.pctHombres());

  notificacionesPendientes = computed(() =>
    this.notificaciones().filter(n => !n.leida).length
  );

  paginasRange = computed(() => {
    const total = this.totalPaginas();
    const actual = this.paginaActual();
    const pages: number[] = [];
    for (let i = Math.max(0, actual - 2); i <= Math.min(total - 1, actual + 2); i++) {
      pages.push(i);
    }
    return pages;
  });

  constructor(
    private dashboardService: DashboardService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.sub = this.dashboardService.getEstadisticasLive(10).subscribe({
        next: (resp) => {
          const prevLength = this.dias().length;
          this.dias.set(resp.por_dia ?? []);
          this.cargando.set(false);

          // Notification: new data detected
          if (prevLength > 0 && resp.por_dia && resp.por_dia.length > prevLength) {
            const nuevos = resp.por_dia.slice(prevLength);
            nuevos.forEach(d => this.agregarNotificacion('alerta', `Nuevo registro detectado: ${d.fecha}`));
          }

          // Notification: high hombre ratio
          if (resp.por_dia && resp.por_dia.length > 0) {
            const ultimo = resp.por_dia[resp.por_dia.length - 1];
            if (ultimo.hombres > ultimo.mujeres * 2) {
              this.agregarNotificacion('hombre', `Alta actividad masculina el ${ultimo.fecha}`);
            } else if (ultimo.mujeres > ultimo.hombres * 2) {
              this.agregarNotificacion('mujer', `Alta actividad femenina el ${ultimo.fecha}`);
            }
          }
        },
        error: () => {
          this.error.set('No se pudieron cargar los registros.');
          this.cargando.set(false);
        }
      });
    } else {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ── actions ──────────────────────────────────────────────────

  onBusqueda(e: Event): void {
    this.filtroBusqueda.set((e.target as HTMLInputElement).value);
    this.paginaActual.set(0);
  }

  irPagina(p: number): void {
    if (p >= 0 && p < this.totalPaginas()) {
      this.paginaActual.set(p);
    }
  }

  paginaAnterior(): void { this.irPagina(this.paginaActual() - 1); }
  paginaSiguiente(): void { this.irPagina(this.paginaActual() + 1); }

  toggleNotifs(): void { this.mostrarNotifs.update(v => !v); }

  marcarLeidas(): void {
    this.notificaciones.update(list => list.map(n => ({ ...n, leida: true })));
  }

  private agregarNotificacion(tipo: 'hombre' | 'mujer' | 'alerta', mensaje: string): void {
    const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const nueva: Notificacion = {
      id: ++this.notifId,
      tipo,
      mensaje,
      tiempo: now,
      leida: false
    };
    this.notificaciones.update(list => [nueva, ...list].slice(0, 20));
  }

  // ── download ─────────────────────────────────────────────────
  descargarCSV(): void {
    const rows = this.registrosFiltrados();
    const header = 'Fecha,Personas,Hombres,Mujeres,Eventos,% Hombres,% Mujeres\n';
    const body = rows.map(r => {
      const ph = r.personas ? Math.round((r.hombres / r.personas) * 100) : 0;
      const pm = 100 - ph;
      return `${r.fecha},${r.personas},${r.hombres},${r.mujeres},${r.eventos},${ph}%,${pm}%`;
    }).join('\n');

    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `registros_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.notif-wrapper')) {
      this.mostrarNotifs.set(false);
    }
  }
}
