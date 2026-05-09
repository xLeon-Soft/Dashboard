import { Component, OnInit, OnDestroy, signal, computed, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subscription, interval } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { DashboardService, DeteccionActiva } from '../../services/dashboard';

interface DeteccionReciente {
  id: number;
  genero: 'Hombre' | 'Mujer';
  hora: string;
  confianza: number;   // confianza de género (0-100)
}

// Key prefix for localStorage
const STORAGE_KEY = 'live_detections';

@Component({
  selector: 'app-live-detection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vivo.html',
  styleUrls: ['./vivo.scss']
})
export class LiveDetection implements OnInit, OnDestroy {

  // URL sanitizada para que Angular permita el stream MJPEG
  readonly videoUrl: SafeUrl;

  // ── state signals ─────────────────────────────────────
  camaraActiva = signal(true);
  recientes    = signal<DeteccionReciente[]>([]);
  paginaActual = signal(0);
  fechaHoy     = signal(this.getTodayString());

  private uid = 0;
  private isBrowser: boolean;

  // Cooldown por cara: no registrar la misma persona más de una vez cada N ms.
  // La API ya usa 5s de cooldown para Excel; aquí usamos 4s para que el log
  // se vea fluido sin duplicar entradas de la misma cara quieta.
  private readonly COOLDOWN_MS = 4000;

  // timestamp del último registro añadido por género (para evitar spam)
  private lastAdded: Record<string, number> = {};

  // Timer to check for day change
  private dayCheckInterval?: ReturnType<typeof setInterval>;

  // ── derived ───────────────────────────────────────────
  readonly POR_PAGINA = 5;

  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.recientes().length / this.POR_PAGINA))
  );

  recientesPagina = computed(() => {
    const start = this.paginaActual() * this.POR_PAGINA;
    return this.recientes().slice(start, start + this.POR_PAGINA);
  });

  totalHombres = computed(() =>
    this.recientes().filter(r => r.genero === 'Hombre').length
  );

  totalMujeres = computed(() =>
    this.recientes().filter(r => r.genero === 'Mujer').length
  );

  pctHombres = computed(() => {
    const t = this.recientes().length;
    return t ? Math.round((this.totalHombres() / t) * 100) : 0;
  });

  pctMujeres = computed(() => {
    const t = this.recientes().length;
    return t ? Math.round((this.totalMujeres() / t) * 100) : 0;
  });

  private pollSub?: Subscription;

  constructor(
    private dashboardService: DashboardService,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.videoUrl = this.sanitizer.bypassSecurityTrustUrl(
      'http://127.0.0.1:8000/video_feed'
    );
  }

  // ── lifecycle ─────────────────────────────────────────
  ngOnInit() {
    // Load persisted detections for today
    this.loadTodayDetections();

    // Check every 30 seconds if the day has changed
    this.dayCheckInterval = setInterval(() => {
      const today = this.getTodayString();
      if (today !== this.fechaHoy()) {
        // Day changed — reset everything and start fresh
        this.fechaHoy.set(today);
        this.recientes.set([]);
        this.uid = 0;
        this.lastAdded = {};
        this.paginaActual.set(0);
        this.clearOldStorage();
        this.persistDetections();
      }
    }, 30000);

    // Pollear /detecciones/activas cada 1.5s
    this.pollSub = interval(1500).pipe(
      startWith(0),
      switchMap(() => this.dashboardService.getDeteccionesActivas())
    ).subscribe({
      next: (resp) => {
        // Si la cámara está apagada en el frontend, ignorar
        if (!this.camaraActiva()) return;

        const now = Date.now();

        resp.detecciones.forEach((det: DeteccionActiva) => {
          const key = det.genero;
          const lastTime = this.lastAdded[key] ?? 0;

          // Solo registrar si pasó el cooldown desde la última entrada del mismo género
          if (now - lastTime < this.COOLDOWN_MS) return;

          this.lastAdded[key] = now;

          const hora = new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });

          const nueva: DeteccionReciente = {
            id: ++this.uid,
            genero: det.genero,
            hora,
            confianza: Math.round(det.confianza_genero * 100),
          };

          this.recientes.update(list => [nueva, ...list].slice(0, 200));

          // Persist to localStorage after each new detection
          this.persistDetections();
        });
      },
      error: (err) => {
        // La API puede estar reiniciando — ignorar el error silenciosamente
        console.warn('[LiveDetection] Error al pollear detecciones:', err.status ?? err.message);
      }
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    if (this.dayCheckInterval) {
      clearInterval(this.dayCheckInterval);
    }
  }

  // ── actions ───────────────────────────────────────────
  toggleCamara(): void {
    this.camaraActiva.update(v => !v);
  }

  limpiarActividad(): void {
    this.recientes.set([]);
    this.paginaActual.set(0);
    this.uid = 0;
    this.lastAdded = {};
    this.persistDetections();
  }

  // Pagination
  paginaAnterior(): void {
    if (this.paginaActual() > 0) {
      this.paginaActual.update(p => p - 1);
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual() < this.totalPaginas() - 1) {
      this.paginaActual.update(p => p + 1);
    }
  }

  // ── persistence helpers ───────────────────────────────

  private getTodayString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getStorageKey(): string {
    return `${STORAGE_KEY}_${this.fechaHoy()}`;
  }

  private persistDetections(): void {
    if (!this.isBrowser) return;
    try {
      const data = {
        fecha: this.fechaHoy(),
        uid: this.uid,
        detecciones: this.recientes(),
      };
      localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
    } catch (e) {
      console.warn('[LiveDetection] Error saving to localStorage:', e);
    }
  }

  private loadTodayDetections(): void {
    if (!this.isBrowser) return;
    try {
      const today = this.getTodayString();
      this.fechaHoy.set(today);
      const key = `${STORAGE_KEY}_${today}`;
      const raw = localStorage.getItem(key);

      if (raw) {
        const data = JSON.parse(raw);
        if (data.fecha === today && Array.isArray(data.detecciones)) {
          this.recientes.set(data.detecciones);
          this.uid = data.uid ?? data.detecciones.length;
        }
      }

      // Clean up old days' data
      this.clearOldStorage();
    } catch (e) {
      console.warn('[LiveDetection] Error loading from localStorage:', e);
    }
  }

  private clearOldStorage(): void {
    if (!this.isBrowser) return;
    try {
      const today = this.getTodayString();
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY) && key !== `${STORAGE_KEY}_${today}`) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      // Ignore
    }
  }
}
