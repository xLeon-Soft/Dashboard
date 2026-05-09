import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, switchMap, startWith } from 'rxjs';
import { DashboardResponse, RegistroDetalle } from '../models/dashboard';

export interface DeteccionActiva {
  genero: 'Hombre' | 'Mujer';
  confianza_rostro: number;
  confianza_genero: number;
}

export interface DeteccionesActivasResponse {
  timestamp: string;
  detecciones: DeteccionActiva[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  readonly apiUrl = 'http://localhost:8000';

  getEstadisticas(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.apiUrl}/estadisticas`);
  }

  /** Poll estadísticas each N seconds (default 5s) */
  getEstadisticasLive(segundos = 5): Observable<DashboardResponse> {
    return interval(segundos * 1000).pipe(
      startWith(0),
      switchMap(() => this.getEstadisticas())
    );
  }

  /** Try to get registros from backend; falls back to building from por_dia */
  getRegistros(): Observable<{total: number, registros: any[]}> {
    return this.http.get<{total: number, registros: any[]}>(`${this.apiUrl}/registros`);
  }

  /** Devuelve las detecciones estables actuales desde la API */
  getDeteccionesActivas(): Observable<DeteccionesActivasResponse> {
    return this.http.get<DeteccionesActivasResponse>(`${this.apiUrl}/detecciones/activas`);
  }

  /** Poll detecciones activas cada N ms (default 1500ms) */
  getDeteccionesLive(ms = 1500): Observable<DeteccionesActivasResponse> {
    return interval(ms).pipe(
      startWith(0),
      switchMap(() => this.getDeteccionesActivas())
    );
  }
}