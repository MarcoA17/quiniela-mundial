import { Injectable, computed, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config';

export interface Partido {
  id: number; equipo_a: string; equipo_b: string;
  goles_a: number | null; goles_b: number | null; grupo: string;
}

export interface Pronostico {
  partido_id: number; goles_a_pronostico: number; goles_b_pronostico: number;
}

export interface Participante {
  id: number;
  nombre: string;
  aprobado: boolean;
  ya_edito_una_vez: boolean; // 👈 Cambiado a tipo boolean limpio
  pronosticos: Pronostico[];
}

@Injectable({
  providedIn: 'root'
})
export class QuinielaService {
  private supabase: SupabaseClient;
  public partidos = signal<Partido[]>([]);
  public participantes = signal<Participante[]>([]);

  // Bolsa calculada con participantes aprobados
  public bolsaTotal = computed(() => {
    return this.participantes().filter(p => p.aprobado).length * 100;
  });

  // Tabla de posiciones mapeada con los aprobados
  public tablaPosiciones = computed(() => {
    const listaPartidos = this.partidos();
    const aprobados = this.participantes().filter(p => p.aprobado);

    const tabla = aprobados.map(usuario => {
      let puntos = 0;
      const apuestas = usuario.pronosticos || [];

      apuestas.forEach(apuesta => {
        const partidoReal = listaPartidos.find(p => p.id === apuesta.partido_id);
        if (partidoReal && partidoReal.goles_a !== null && partidoReal.goles_b !== null) {
          if (Number(apuesta.goles_a_pronostico) === partidoReal.goles_a && Number(apuesta.goles_b_pronostico) === partidoReal.goles_b) {
            puntos += 3;
          } else {
            const tP = Number(apuesta.goles_a_pronostico) > Number(apuesta.goles_b_pronostico) ? 'A' : (Number(apuesta.goles_a_pronostico) < Number(apuesta.goles_b_pronostico) ? 'B' : 'E');
            const tR = partidoReal.goles_a > partidoReal.goles_b ? 'A' : (partidoReal.goles_a < partidoReal.goles_b ? 'B' : 'E');
            if (tP === tR) puntos += 1;
          }
        }
      });
      return { id: usuario.id, nombre: usuario.nombre, puntos };
    });

    return tabla.sort((a, b) => b.puntos - a.puntos);
  });

  constructor() {
    this.supabase = createClient(SUPABASE_CONFIG.supabaseUrl, SUPABASE_CONFIG.supabaseKey);
    this.cargarDatosDeLaNube();
  }

  async cargarDatosDeLaNube() {
    // 1. Descargar partidos oficiales
    const { data: resPartidos } = await this.supabase.from('partidos').select('*').order('id');
    if (resPartidos) this.partidos.set(resPartidos as Partido[]);

    // 2. Descargar participantes incluyendo la nueva columna 'ya_edito_una_vez'
    const { data: resParticipantes } = await this.supabase
      .from('participantes')
      .select('id, nombre, aprobado, ya_edito_una_vez, pronosticos(partido_id, goles_a_pronostico, goles_b_pronostico)');

    if (resParticipantes) {
      // 🌟 MAPEO DEFENSIVO CORREGIDO: Ahora sí incluye 'ya_edito_una_vez'
      const formateados: Participante[] = (resParticipantes as any[]).map(p => {
        const listaPronosticos = p.pronosticos || p.pronostico || [];
        return {
          id: p.id,
          nombre: p.nombre,
          aprobado: p.aprobado,
          ya_edito_una_vez: !!p.ya_edito_una_vez, // 👈 Evita valores null transformándolo a boolean
          pronosticos: Array.isArray(listaPronosticos) ? listaPronosticos : [listaPronosticos]
        };
      });

      this.participantes.set(formateados);
    }
  }

  async registrarNuevaQuiniela(nombre: string, pronosticos: Pronostico[]) {
    const { data: participanteCreado, error: errPart } = await this.supabase
      .from('participantes')
      .insert([{ nombre, aprobado: false }])
      .select().single();

    if (errPart || !participanteCreado) throw new Error("Error al registrar");

    const pronosticosConId = pronosticos.map(p => ({
      participante_id: participanteCreado.id,
      partido_id: p.partido_id,
      goles_a_pronostico: p.goles_a_pronostico,
      goles_b_pronostico: p.goles_b_pronostico
    }));

    await this.supabase.from('pronosticos').insert(pronosticosConId);
    await this.cargarDatosDeLaNube();
  }

  async aprobarParticipante(id: number) {
    await this.supabase.from('participantes').update({ aprobado: true }).eq('id', id);
    await this.cargarDatosDeLaNube();
  }

  async actualizarResultadoOficial(partidoId: number, golesA: number, golesB: number) {
    await this.supabase.from('partidos').update({ goles_a: golesA, goles_b: golesB }).eq('id', partidoId);
    await this.cargarDatosDeLaNube();
  }

  async actualizarQuinielaExistente(idParticipante: number, nuevosPronosticos: any[]) {
    try {
      const { error: errorParticipante } = await this.supabase
        .from('participantes')
        .update({ ya_edito_una_vez: true })
        .eq('id', idParticipante);

      if (errorParticipante) throw errorParticipante;

      for (const pronostico of nuevosPronosticos) {
        const { error: errorPronostico } = await this.supabase
          .from('pronosticos')
          .update({
            goles_a_pronostico: pronostico.goles_a_pronostico,
            goles_b_pronostico: pronostico.goles_b_pronostico
          })
          .eq('participante_id', idParticipante)
          .eq('partido_id', pronostico.partido_id);

        if (errorPronostico) throw errorPronostico;
      }

      await this.cargarDatosDeLaNube();

    } catch (error) {
      console.error('Error crítico al editar la quiniela:', error);
      throw error;
    }
  }
}