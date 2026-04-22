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

export interface DashboardResponse {
  totales: Totales;
  por_dia: ResumenPorDia[];
}