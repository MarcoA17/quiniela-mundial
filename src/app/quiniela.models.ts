// src/app/quiniela.models.ts

export interface Partido {
  id: number;
  equipo_a: string;
  equipo_b: string;
  grupo: string;
  resultado_real: 'A' | 'B' | 'E' | null; // A = Equipo A, B = Equipo B, E = Empate, null = No se ha jugado
}

export interface Pronostico {
  partido_id: number;
  prediccion: 'A' | 'B' | 'E';
}

export interface Participante {
  id: number;
  nombre: string;
  pagado: boolean;
  pronosticos: Pronostico[];
  puntos?: number; // Lo calcularemos dinámicamente con un computed
  ya_edito_una_vez?: boolean;
}