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

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['admin'] === 'true') {
        this.esAdministrador.set(true);
      }
    });
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
}