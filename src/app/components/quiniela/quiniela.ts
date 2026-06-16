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

  // 🔄 NUEVO: Control de pantallas mediante menú de navegación
  public pantallaActual = signal<string>('inicio');

  // Estado para la consulta de pronósticos individuales
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

  // Método para cambiar de sección de forma fluida
  public navegarA(pantalla: string) {
    this.pantallaActual.set(pantalla);
    // Truco: Si navega a registrar, limpiamos estados de edición viejos para evitar bugs
    if (pantalla === 'registrar' && !this.modoEdicion()) {
      this.nombreParticipante = '';
      this.apuestasForm.set({});
    }
  }

  public cambiarGrupo(letra: string) {
    this.grupoSeleccionado.set(letra);
  }

  public cambiarGrupoConsulta(letra: string) {
    this.grupoConsulta.set(letra);
  }

  public seleccionarUsuarioConsulta(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    if (!id) {
      this.usuarioConsultado.set(null);
      return;
    }
    const user = this.srv.participantes().find(p => p.id === Number(id));
    this.usuarioConsultado.set(user || null);
  }

  public obtenerEstiloAcierto(partidoId: number): { bg: string, texto: string, label: string } {
    const user = this.usuarioConsultado();
    const partido = this.srv.partidos().find(p => p.id === partidoId);

    if (!user || !partido || partido.goles_a === null || partido.goles_b === null) {
      return { bg: '#ffffff', texto: '#1e293b', label: '' };
    }

    const miApuesta = this.obtenerGolesApostados(partidoId);
    if (!miApuesta) return { bg: '#ffffff', texto: '#1e293b', label: '' };

    const pA = miApuesta.a;
    const pB = miApuesta.b;
    const rA = partido.goles_a;
    const rB = partido.goles_b;

    if (pA === rA && pB === rB) {
      return { bg: '#dcfce7', texto: '#14532d', label: '🎯 ¡Marcador Exacto! (+3 pts)' };
    }

    const tP = pA > pB ? 'A' : (pA < pB ? 'B' : 'E');
    const tR = rA > rB ? 'A' : (rA < rB ? 'B' : 'E');

    if (tP === tR) {
      return { bg: '#fef9c3', texto: '#713f12', label: '⚽ Tendencia Acertada (+1 pt)' };
    }

    return { bg: '#f1f5f9', texto: '#475569', label: '❌ Fallado (0 pts)' };
  }

  public obtenerGolesApostados(partidoId: number): { a: number, b: number } | null {
    const selectorId = this.usuarioConsultado()?.id;
    if (!selectorId) return null;

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
      alert("¡Tus pronósticos han sido guardados con éxito! 🏆\n\nTu petición ha sido enviada al administrador.");
      this.nombreParticipante = '';
      this.apuestasForm.set({});
      this.navegarA('inicio'); // Te regresa al inicio tras guardar
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
    console.log("¡Ceros inyectados!");
  }

  async cargarQuinielaParaEditar(nombre: string) {
    if (!nombre || nombre.trim() === '') {
      alert('Por favor, escribe tu nombre completo primero.');
      return;
    }

    const nombreBuscado = nombre.trim().toLowerCase();
    const usuario = this.srv.participantes().find(p => p.nombre.trim().toLowerCase() === nombreBuscado);

    if (!usuario) {
      alert("No se encontró ningún participante con ese nombre.");
      return;
    }

    if (usuario.ya_edito_una_vez && !this.esAdministrador()) {
      alert("Lo siento, ya utilizaste tu única oportunidad de edición.");
      return;
    }

    this.idParticipanteAEditar.set(usuario.id);
    this.nombreParticipante = usuario.nombre;

    const nuevoFormulario: { [key: string]: number | null } = {};
    
    this.srv.partidos().forEach(partido => {
      nuevoFormulario[`${partido.id}_a`] = 0;
      nuevoFormulario[`${partido.id}_b`] = 0;
    });

    if (usuario.pronosticos) {
      usuario.pronosticos.forEach((p: any) => {
        const pId = p.partido_id !== undefined ? p.partido_id : p.partidoId;
        const golesA = p.goles_a_pronostico !== undefined ? p.goles_a_pronostico : p.golesAPronostico;
        const golesB = p.goles_b_pronostico !== undefined ? p.goles_b_pronostico : p.golesBPronostico;

        if (pId) {
          nuevoFormulario[`${pId}_a`] = golesA !== null && golesA !== undefined ? Number(golesA) : 0;
          nuevoFormulario[`${pId}_b`] = golesB !== null && golesB !== undefined ? Number(golesB) : 0;
        }
      });
    }

    this.apuestasForm.set(nuevoFormulario);
    this.modoEdicion.set(true);
    alert("¡Modo edición activado!");
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

      if (partido.goles_a !== null && partido.goles_b !== null && !this.esAdministrador()) {
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
        pronosticosActualizados.push({
          partido_id: partido.id,
          goles_a_pronostico: Number(golesA ?? 0),
          goles_b_pronostico: Number(golesB ?? 0)
        });
      }
    }

    try {
      await this.srv.actualizarQuinielaExistente(idUser, pronosticosActualizados);
      if (this.esAdministrador()) {
        alert("¡Quiniela actualizada por el Administrador!");
      } else {
        alert("¡Quiniela actualizada con éxito!");
      }
      this.modoEdicion.set(false);
      this.idParticipanteAEditar.set(null);
      this.nombreParticipante = '';
      this.apuestasForm.set({});
      this.navegarA('inicio');
    } catch (err) {
      alert("Error al actualizar la quiniela.");
    }
  }
}