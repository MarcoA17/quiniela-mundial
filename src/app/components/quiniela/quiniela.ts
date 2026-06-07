import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { QuinielaService, Pronostico, Participante } from '../../services/quiniela';

@Component({
  selector: 'app-quiniela',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiniela.html'
})
export class QuinielaComponent implements OnInit {
  public nombreParticipante: string = '';
  public apuestasForm = signal<{ [key: string]: number | null }>({});

  public listaGrupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  public grupoSeleccionado = signal<string>('A');
  public esAdministrador = signal<boolean>(false);

  // 🔍 NUEVO: Estado para la consulta de pronósticos individuales
  public usuarioConsultado = signal<Participante | null>(null);
  public grupoConsulta = signal<string>('A');

  constructor(public srv: QuinielaService, private route: ActivatedRoute) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['admin'] === 'true') {
        this.esAdministrador.set(true);
      }
    });

    setInterval(() => {
      this.srv.cargarDatosDeLaNube();
    }, 10800000);
  }

  public cambiarGrupo(letra: string) {
    this.grupoSeleccionado.set(letra);
  }

  // Cambiar pestaña en el área de consulta
  public cambiarGrupoConsulta(letra: string) {
    this.grupoConsulta.set(letra);
  }

  // Actualiza la selección del buscador usando la referencia directa del servicio
  public seleccionarUsuarioConsulta(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    if (!id) {
      this.usuarioConsultado.set(null);
      return;
    }

    // Buscamos dinámicamente en el listado del servicio
    const user = this.srv.participantes().find(p => p.id === Number(id));
    this.usuarioConsultado.set(user || null);
  }

  /// 🎨 OPTIMIZADO: Calcula el color exacto basándose en el buscador robusto
  public obtenerEstiloAcierto(partidoId: number): { bg: string, texto: string, label: string } {
    const user = this.usuarioConsultado();
    const partido = this.srv.partidos().find(p => p.id === partidoId);

    if (!user || !partido || partido.goles_a === null || partido.goles_b === null) {
      return { bg: '#ffffff', texto: '#1e293b', label: '' }; // Sin jugar aún
    }

    const miApuesta = this.obtenerGolesApostados(partidoId);
    if (!miApuesta) return { bg: '#ffffff', texto: '#1e293b', label: '' };

    const pA = miApuesta.a;
    const pB = miApuesta.b;
    const rA = partido.goles_a;
    const rB = partido.goles_b;

    // Marcador Exacto
    if (pA === rA && pB === rB) {
      return { bg: '#dcfce7', texto: '#14532d', label: '🎯 ¡Marcador Exacto! (+3 pts)' };
    }

    // Tendencia (Ganador/Empate)
    const tP = pA > pB ? 'A' : (pA < pB ? 'B' : 'E');
    const tR = rA > rB ? 'A' : (rA < rB ? 'B' : 'E');

    if (tP === tR) {
      return { bg: '#fef9c3', texto: '#713f12', label: '⚽ Tendencia Acertada (+1 pt)' };
    }

    // Fallado
    return { bg: '#f1f5f9', texto: '#475569', label: '❌ Fallado (0 pts)' };
  }

  // Buscador robusto que lee la propiedad ya unificada en el servicio
  public obtenerGolesApostados(partidoId: number): { a: number, b: number } | null {
    const selectorId = this.usuarioConsultado()?.id;
    if (!selectorId) return null;

    // Buscamos siempre la versión fresca del usuario directo desde el servicio
    const usuarioFresco = this.srv.participantes().find(p => p.id === selectorId);
    if (!usuarioFresco || !usuarioFresco.pronosticos) return null;

    const apuesta = usuarioFresco.pronosticos.find(p => {
      const pId = (p as any).partido_id !== undefined ? (p as any).partido_id : (p as any).partidoId;
      return Number(pId) === Number(partidoId);
    });

    if (!apuesta) return null;

    const golesA = (apuesta as any).goles_a_pronostico !== undefined ? (apuesta as any).goles_a_pronostico : (apuesta as any).golesAPronostico;
    const golesB = (apuesta as any).goles_b_pronostico !== undefined ? (apuesta as any).goles_b_pronostico : (apuesta as any).golesBPronostico;

    return {
      a: golesA !== null && golesA !== undefined ? Number(golesA) : 0,
      b: golesB !== null && golesB !== undefined ? Number(golesB) : 0
    };
  }

  async enviarQuiniela() {
    if (!this.nombreParticipante.trim()) {
      alert("Por favor, introduce tu nombre.");
      return;
    }

    const listaPartidos = this.srv.partidos();
    const pronosticosAEnviar: Pronostico[] = [];
    const formulario = this.apuestasForm();

    for (const partido of listaPartidos) {
      const golesA = formulario[`${partido.id}_a`];
      const golesB = formulario[`${partido.id}_b`];
      if (golesA === null || golesA === undefined || golesB === null || golesB === undefined) {
        alert(`Te falta el Partido #${partido.id} en el Grupo ${partido.grupo}.`);
        return;
      }
      pronosticosAEnviar.push({
        partido_id: partido.id,
        goles_a_pronostico: Number(golesA),
        goles_b_pronostico: Number(golesB)
      });
    }

    try {
      await this.srv.registrarNuevaQuiniela(this.nombreParticipante, pronosticosAEnviar);
      alert("¡Tus pronósticos han sido guardados con éxito! 🏆\n\nTu petición ha sido enviada al administrador. En cuanto sea aprobada tu participación, aparecerás automáticamente en la lista de posiciones.");
      this.nombreParticipante = '';
      this.apuestasForm.set({});
    } catch (err) {
      alert("Ocurrió un error al guardar.");
    }
  }

  async guardarResultadoOficial(partidoId: number, gA: string, gB: string) {
    if (gA === '' || gB === '') return;
    await this.srv.actualizarResultadoOficial(partidoId, Number(gA), Number(gB));
  }

  async aprobarPago(id: number) {
    await this.srv.aprobarParticipante(id);
    alert("¡Participante aprobado y sumado a la bolsa!");
  }

  public autoRellenarCeros() {
    // 1. Obtenemos una copia del estado actual del formulario mapeado en la señal
    const formularioActual = { ...this.apuestasForm() };

    // 2. Recorremos absolutamente todos los partidos del servicio y les clavamos un 0
    this.srv.partidos().forEach(partido => {
      formularioActual[`${partido.id}_a`] = 0;
      formularioActual[`${partido.id}_b`] = 0;
    });

    // 3. Actualizamos la señal con el nuevo objeto lleno de ceros
    this.apuestasForm.set(formularioActual);

    // 4. (Opcional) Un aviso rápido para que sepas que funcionó
    console.log("¡Ceros inyectados en el formulario reactivo!");
  }

}