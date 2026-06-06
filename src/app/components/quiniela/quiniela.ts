// src/app/components/quiniela/quiniela.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { QuinielaService } from '../../services/quiniela';
import { Pronostico } from '../../quiniela.models';

@Component({
  selector: 'app-quiniela',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiniela.html',
  styleUrls: ['./quiniela.css']
})
export class QuinielaComponent implements OnInit {
  public srv = inject(QuinielaService);
  private route = inject(ActivatedRoute);

  public nombreParticipante = '';
  public apuestasForm = signal<{ [partidoId: number]: 'A' | 'B' | 'E' }>({});
  public esAdministrador = signal<boolean>(false);
  // 1. Lista fija de tus 12 grupos mundiales
  public listaGrupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  // 2. Signal para controlar qué grupo se muestra en pantalla (por defecto arranca en el A)
  public grupoSeleccionado = signal<string>('A');

  ngOnInit() {
    // 1. Validar si es administrador mediante la URL
    this.route.queryParams.subscribe(params => {
      if (params['admin'] === 'true') {
        this.esAdministrador.set(true);
      }
    });

    // 2. AUTO-REFRESCO: Consultar datos nuevos de Supabase cada 30 segundos de manera automática
    setInterval(() => {
      console.log('🔄 Sincronizando tabla automáticamente con la nube...');
      this.srv.cargarDatosDeLaNube();
    }, 30000); // 30000 milisegundos = 30 segundos
  }

  seleccionarPronostico(partidoId: number, opcion: 'A' | 'B' | 'E') {
    this.apuestasForm.update(prev => ({ ...prev, [partidoId]: opcion }));
  }

  async enviarQuiniela() {
    if (!this.nombreParticipante.trim()) {
      alert('Por favor ingresa tu nombre.');
      return;
    }
    const partidosActuales = this.srv.partidos();
    if (Object.keys(this.apuestasForm()).length < partidosActuales.length) {
      alert('Debes completar los pronósticos de todos los partidos.');
      return;
    }
    const listaApuestas: Pronostico[] = partidosActuales.map(p => ({
      partido_id: p.id,
      prediccion: this.apuestasForm()[p.id]
    }));

    const exito = await this.srv.guardarNuevaQuiniela(this.nombreParticipante, listaApuestas);
    if (exito) {
      alert('¡Tu quiniela se ha registrado con éxito en la nube!');
      this.nombreParticipante = '';
      this.apuestasForm.set({});
    }
  }

  simularResultadoReal(partidoId: number, resultado: 'A' | 'B' | 'E') {
    this.srv.actualizarResultadoOficial(partidoId, resultado);
  }

  // Cambiar de pestaña al dar clic
  public cambiarGrupo(letra: string) {
    this.grupoSeleccionado.set(letra);
  }

}
