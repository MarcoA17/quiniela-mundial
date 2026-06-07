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
      // Validamos que existan pronósticos antes de recorrerlos
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

    // 2. Descargar participantes y sus pronósticos relacionados
    const { data: resParticipantes } = await this.supabase
      .from('participantes')
      .select('id, nombre, aprobado, pronosticos(partido_id, goles_a_pronostico, goles_b_pronostico)');
    
    if (resParticipantes) {
      // 🌟 MAPEO DEFENSIVO: Asegura que la propiedad 'pronosticos' exista de forma uniforme
      const formateados: Participante[] = (resParticipantes as any[]).map(p => {
        // Supabase puede devolver la relación como 'pronosticos' o nombres variantes según claves foráneas
        const listaPronosticos = p.pronosticos || p.pronostico || [];
        return {
          id: p.id,
          nombre: p.nombre,
          aprobado: p.aprobado,
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
}