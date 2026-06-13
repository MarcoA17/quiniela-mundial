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

  // 🔍 Estado para la consulta de pronósticos individuales
  public usuarioConsultado = signal<Participante | null>(null);
  public grupoConsulta = signal<string>('A');

  public modoEdicion = signal<boolean>(false);
  public idParticipanteAEditar = signal<number | null>(null);

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
    const formularioActual = { ...this.apuestasForm() };

    this.srv.partidos().forEach(partido => {
      formularioActual[`${partido.id}_a`] = 0;
      formularioActual[`${partido.id}_b`] = 0;
    });

    this.apuestasForm.set(formularioActual);
    console.log("¡Ceros inyectados en el formulario reactivo!");
  }

  // 🛠️ FUNCIÓN AJUSTADA CON EL BUSCADOR ROBUSTO E INTELIGENTE
  async cargarQuinielaParaEditar(nombre: string) {
    if (!nombre || nombre.trim() === '') {
      alert('Por favor, escribe tu nombre completo primero.');
      return;
    }

    // Limpiamos la cadena de entrada para evitar fallos por mayúsculas o espacios extra
    const nombreBuscado = nombre.trim().toLowerCase();

    // Buscador tolerante que recorre los participantes actuales del servicio
    const usuario = this.srv.participantes().find(p =>
      p.nombre.trim().toLowerCase() === nombreBuscado
    );

    if (!usuario) {
      alert("No se encontró ningún participante con ese nombre.");
      return;
    }

    if (usuario.ya_edito_una_vez) {
      alert("Lo siento, ya utilizaste tu única oportunidad de edición.");
      return;
    }

    // Activamos el modo edición asignando los datos maestros
    this.idParticipanteAEditar.set(usuario.id);
    this.nombreParticipante = usuario.nombre; // Setea el nombre exacto de la DB

    const nuevoFormulario: { [key: string]: number | null } = {};

    // Mapeamos los pronósticos previos que vienen de la base de datos hacia el formulario
    if (usuario.pronosticos) {
      usuario.pronosticos.forEach((p: any) => {
        // Soporte dinámico por si cambian las propiedades de snake_case a camelCase en la interfaz
        const pId = p.partido_id !== undefined ? p.partido_id : p.partidoId;
        const golesA = p.goles_a_pronostico !== undefined ? p.goles_a_pronostico : p.golesAPronostico;
        const golesB = p.goles_b_pronostico !== undefined ? p.goles_b_pronostico : p.golesBPronostico;

        nuevoFormulario[`${pId}_a`] = golesA !== null && golesA !== undefined ? Number(golesA) : 0;
        nuevoFormulario[`${pId}_b`] = golesB !== null && golesB !== undefined ? Number(golesB) : 0;
      });
    }

    this.apuestasForm.set(nuevoFormulario);
    this.modoEdicion.set(true);
    alert("¡Modo edición activado! Modifica tus pronósticos libres en el panel inferior.");
  }

  async guardarEdicion() {
    const idUser = this.idParticipanteAEditar();
    if (!idUser) return;

    const listaPartidos = this.srv.partidos();
    const pronosticosActualizados = [];
    const formulario = this.apuestasForm();

    for (const partido of listaPartidos) {
      const golesA = formulario[`${partido.id}_a`];
      const golesB = formulario[`${partido.id}_b`];

      // Si el partido YA TIENE resultado oficial bloqueado, preservamos el valor original guardado
      if (partido.goles_a !== null && partido.goles_b !== null) {
        // Forzamos la lectura como 'any' para evitar que TypeScript chille por las variantes de nombres de propiedades
        const original = this.srv.participantes().find(p => p.id === idUser)
          ?.pronosticos.find((pr: any) => {
            const prId = pr.partido_id !== undefined ? pr.partido_id : pr.partidoId;
            return Number(prId) === partido.id;
          }) as any;

        const gAOrig = original?.goles_a_pronostico !== undefined ? original.goles_a_pronostico : original?.golesAPronostico;
        const gBOrig = original?.goles_b_pronostico !== undefined ? original.goles_b_pronostico : original?.golesBPronostico;

        pronosticosActualizados.push({
          partido_id: partido.id,
          goles_a_pronostico: gAOrig !== null && gAOrig !== undefined ? Number(gAOrig) : 0,
          goles_b_pronostico: gBOrig !== null && gBOrig !== undefined ? Number(gBOrig) : 0
        });
      } else {
        // Si el partido está libre para jugar, guardamos lo que el usuario alteró en el input
        pronosticosActualizados.push({
          partido_id: partido.id,
          goles_a_pronostico: Number(golesA ?? 0),
          goles_b_pronostico: Number(golesB ?? 0)
        });
      }
    }

    try {
      await this.srv.actualizarQuinielaExistente(idUser, pronosticosActualizados);
      alert("¡Quiniela actualizada con éxito! Has agotado tu única edición.");

      // Reseteamos el estado del formulario de forma limpia
      this.modoEdicion.set(false);
      this.idParticipanteAEditar.set(null);
      this.nombreParticipante = '';
      this.apuestasForm.set({});
    } catch (err) {
      alert("Error al actualizar la quiniela.");
    }
  }
}