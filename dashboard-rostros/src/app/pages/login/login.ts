import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  modoRegistro = signal(false);

  usuarioLogin = signal('');
  passwordLogin = signal('');

  nombreRegistro = signal('');
  correoRegistro = signal('');
  passwordRegistro = signal('');

  mostrarPasswordLogin = signal(false);
  mostrarPasswordRegistro = signal(false);

  cargando = signal(false);

  constructor(private router: Router) {}

  activarRegistro(): void {
    this.modoRegistro.set(true);
  }

  activarLogin(): void {
    this.modoRegistro.set(false);
  }

  togglePasswordLogin(): void {
    this.mostrarPasswordLogin.set(!this.mostrarPasswordLogin());
  }

  togglePasswordRegistro(): void {
    this.mostrarPasswordRegistro.set(!this.mostrarPasswordRegistro());
  }

  iniciarSesion(): void {
    if (!this.usuarioLogin().trim() || !this.passwordLogin().trim()) {
      alert('Completa usuario y contraseña.');
      return;
    }

    this.cargando.set(true);

    setTimeout(() => {
      this.cargando.set(false);
      this.router.navigate(['/dashboard']);
    }, 900);
  }

  registrar(): void {
    if (
      !this.nombreRegistro().trim() ||
      !this.correoRegistro().trim() ||
      !this.passwordRegistro().trim()
    ) {
      alert('Completa todos los campos del registro.');
      return;
    }

    this.cargando.set(true);

    setTimeout(() => {
      this.cargando.set(false);
      this.modoRegistro.set(false);
      alert('Cuenta creada correctamente.');
    }, 900);
  }
}