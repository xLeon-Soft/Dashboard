export interface Totales {
  eventos: number;
  personas: number;
  hombres: number;
  mujeres: number;
}

export interface ResumenPorDia {
  fecha: string;
  eventos: number;
  personas: number;
  hombres: number;
  mujeres: number;
}

export interface RegistroDetalle {
  id?: number;
  fecha: string;
  hora?: string;
  genero: string;
  confianza?: number;
  camara?: string;
}

export interface DashboardResponse {
  totales: Totales;
  por_dia: ResumenPorDia[];
  registros?: RegistroDetalle[];
}