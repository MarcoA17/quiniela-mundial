import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuinielaService } from '../../services/quiniela';
import { Pronostico } from '../../quiniela.models';

@Component({
  selector: 'app-quiniela',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiniela.html',
  styleUrls: ['./quiniela.css']
})
export class QuinielaComponent {
  // Inyectamos nuestro servicio de Signals
  public srv = inject(QuinielaService);

  // Estados locales del formulario utilizando signals simples
  public nombreParticipante = '';
  public apuestasForm = signal<{ [partidoId: number]: 'A' | 'B' | 'E' }>({});

  // Guarda la opción elegida por el usuario en el formulario
  seleccionarPronostico(partidoId: number, opcion: 'A' | 'B' | 'E') {
    this.apuestasForm.update(prev => ({
      ...prev,
      [partidoId]: opcion
    }));
  }

  // Evento para enviar la quiniela al hacer clic en guardar
  enviarQuiniela() {
    if (!this.nombreParticipante.trim()) {
      alert('Por favor ingresa tu nombre.');
      return;
    }

    const partidosActuales = this.srv.partidos();
    
    // Validamos que se hayan contestado todos los partidos
    if (Object.keys(this.apuestasForm()).length < partidosActuales.length) {
      alert('Debes completar los pronósticos de todos los partidos.');
      return;
    }

    // Mapeamos los datos al formato correcto
    const listaApuestas: Pronostico[] = partidosActuales.map(p => ({
      partido_id: p.id,
      prediccion: this.apuestasForm()[p.id]
    }));

    // Guardamos en el servicio de Signals
    this.srv.guardarNuevaQuiniela(this.nombreParticipante, listaApuestas);
    
    // Limpiamos el formulario para el siguiente amigo
    alert('¡Tu quiniela se ha registrado con éxito localmente!');
    this.nombreParticipante = '';
    this.apuestasForm.set({});
  }

  // Función simuladora para que tú actúes como administrador y metas resultados reales
  simularResultadoReal(partidoId: number, resultado: 'A' | 'B' | 'E') {
    this.srv.actualizarResultadoOficial(partidoId, resultado);
  }
}