import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPasswordComponent implements OnDestroy {

  // Pasos: 1 = Email, 2 = Código, 3 = Nueva contraseña, 4 = Éxito
  paso = signal(1);
  email = signal('');
  codigo = signal('');
  nuevaPassword = signal('');
  confirmarPassword = signal('');
  mostrarPassword = signal(false);
  cargando = signal(false);

  // Countdown
  countdown = signal(60);
  codigoExpirado = signal(false);
  private countdownInterval: any = null;

  // Mensajes
  mensajeError = signal('');
  emailPreview = signal('');

  constructor(private authService: AuthService, private router: Router) {}

  ngOnDestroy(): void {
    this.limpiarCountdown();
  }

  // =========================================
  // PASO 1: Solicitar código
  // =========================================
  solicitarCodigo(): void {
    const emailVal = this.email().trim();
    if (!emailVal) {
      this.mensajeError.set('Ingresa tu correo electrónico');
      return;
    }
    if (!emailVal.includes('@')) {
      this.mensajeError.set('Ingresa un correo válido');
      return;
    }

    this.mensajeError.set('');
    this.cargando.set(true);

    this.authService.forgotPassword(emailVal).subscribe({
      next: () => {
        this.cargando.set(false);
        // Preview del email: ale***@gmail.com
        const [local, domain] = emailVal.split('@');
        this.emailPreview.set(local.slice(0, 3) + '***@' + domain);
        this.paso.set(2);
        this.iniciarCountdown();
      },
      error: (err) => {
        this.cargando.set(false);
        this.mensajeError.set(err.error?.detail || 'No se encontró una cuenta con ese correo');
      }
    });
  }

  // =========================================
  // PASO 2: Verificar código
  // =========================================
  verificarCodigo(): void {
    const codigoVal = this.codigo().trim();
    if (!codigoVal || codigoVal.length < 5) {
      this.mensajeError.set('Ingresa el código de 5 dígitos');
      return;
    }

    if (this.codigoExpirado()) {
      this.mensajeError.set('El código ha expirado. Solicita uno nuevo.');
      return;
    }

    this.mensajeError.set('');
    this.paso.set(3);
    this.limpiarCountdown();
  }

  // =========================================
  // PASO 3: Restablecer contraseña
  // =========================================
  restablecerPassword(): void {
    const pass = this.nuevaPassword().trim();
    const confirm = this.confirmarPassword().trim();

    if (!pass) {
      this.mensajeError.set('Ingresa tu nueva contraseña');
      return;
    }
    if (pass.length < 6) {
      this.mensajeError.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (pass !== confirm) {
      this.mensajeError.set('Las contraseñas no coinciden');
      return;
    }

    this.mensajeError.set('');
    this.cargando.set(true);

    this.authService.resetPassword({
      email: this.email(),
      code: this.codigo(),
      password: pass
    }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.paso.set(4); // Éxito
      },
      error: (err) => {
        this.cargando.set(false);
        const msg = err.error?.detail || 'Error al restablecer contraseña';
        // Si el código expiró en el servidor
        if (msg.toLowerCase().includes('expir')) {
          this.paso.set(2);
          this.codigoExpirado.set(true);
          this.countdown.set(0);
          this.limpiarCountdown();
        }
        this.mensajeError.set(msg);
      }
    });
  }

  // =========================================
  // REENVIAR CÓDIGO
  // =========================================
  reenviarCodigo(): void {
    this.mensajeError.set('');
    this.codigo.set('');
    this.codigoExpirado.set(false);
    this.cargando.set(true);

    this.authService.forgotPassword(this.email()).subscribe({
      next: () => {
        this.cargando.set(false);
        this.countdown.set(60);
        this.codigoExpirado.set(false);
        this.iniciarCountdown();
      },
      error: (err) => {
        this.cargando.set(false);
        this.mensajeError.set(err.error?.detail || 'Error al reenviar código');
      }
    });
  }

  // =========================================
  // COUNTDOWN TIMER
  // =========================================
  private iniciarCountdown(): void {
    this.limpiarCountdown();
    this.countdown.set(60);
    this.codigoExpirado.set(false);

    this.countdownInterval = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        this.countdown.set(0);
        this.codigoExpirado.set(true);
        this.limpiarCountdown();
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  private limpiarCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  // =========================================
  // HELPERS
  // =========================================
  togglePassword(): void {
    this.mostrarPassword.set(!this.mostrarPassword());
  }

  formatCountdown(): string {
    const secs = this.countdown();
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  getCountdownProgress(): number {
    return (this.countdown() / 60) * 100;
  }

  irAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
