import { Component } from '@angular/core';
import { QuinielaComponent } from './components/quiniela/quiniela'; // ← ¡Esta línea es la que nos faltaba!

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [QuinielaComponent], // Importamos tu componente aquí
  template: '<app-quiniela></app-quiniela>' // Renderizamos directamente tu quiniela
})
export class AppComponent {
  title = 'quiniela-mundial';
}