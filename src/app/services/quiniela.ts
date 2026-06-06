// src/app/services/quiniela.ts
import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config';
import { Partido, Participante, Pronostico } from '../quiniela.models';

@Injectable({
  providedIn: 'root'
})
export class QuinielaService {
  private supabase: SupabaseClient;

  public partidos = signal<Partido[]>([]);
  public participantes = signal<Participante[]>([]);
  public costoBoleto = signal<number>(100);

  constructor() {
    this.supabase = createClient(SUPABASE_CONFIG.supabaseUrl, SUPABASE_CONFIG.supabaseKey);
    this.cargarDatosDeLaNube();
  }

  async cargarDatosDeLaNube() {
    const { data: resPartidos } = await this.supabase.from('partidos').select('*').order('id');
    if (resPartidos) this.partidos.set(resPartidos as Partido[]);

    const { data: resParticipantes } = await this.supabase
      .from('participantes')
      .select('id, nombre, pagado, pronosticos(partido_id, prediccion)');
    
    if (resParticipantes) {
      this.participantes.set(resParticipantes as unknown as Participante[]);
    }
  }

  public bolsaTotal = computed(() => this.participantes().length * this.costoBoleto());

  public tablaPosiciones = computed(() => {
    const listaPartidos = this.partidos();
    const procesados = this.participantes().map(usuario => {
      let puntos = 0;
      usuario.pronosticos.forEach(apuesta => {
        const partidoReal = listaPartidos.find(p => p.id === apuesta.partido_id);
        if (partidoReal?.resultado_real && partidoReal.resultado_real === apuesta.prediccion) {
          puntos++;
        }
      });
      return { ...usuario, puntos };
    });
    return procesados.sort((a, b) => (b.puntos ?? 0) - (a.puntos ?? 0));
  });

  async guardarNuevaQuiniela(nombreAmigo: string, apuestas: Pronostico[]): Promise<boolean> {
    try {
      const { data: nuevoUsuario, error: errUser } = await this.supabase
        .from('participantes')
        .insert([{ nombre: nombreAmigo }])
        .select().single();

      if (errUser) throw errUser;

      const loteApuestas = apuestas.map(a => ({
        participante_id: nuevoUsuario.id,
        partido_id: a.partido_id,
        prediccion: a.prediccion
      }));

      const { error: errPronos } = await this.supabase.from('pronosticos').insert(loteApuestas);
      if (errPronos) throw errPronos;

      await this.cargarDatosDeLaNube();
      return true;
    } catch (error) {
      console.error(error);
      alert('Hubo un error, probablemente ese nombre ya está ocupado.');
      return false;
    }
  }

  async actualizarResultadoOficial(partidoId: number, resultado: 'A' | 'B' | 'E') {
    const { error } = await this.supabase
      .from('partidos')
      .update({ resultado_real: resultado })
      .eq('id', partidoId);

    if (!error) {
      await this.cargarDatosDeLaNube();
    }
  }
}