import { Component, signal, inject, PLATFORM_ID, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

// Declarar API global de Google
declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login implements AfterViewInit {
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);

  // ===== TU FACEBOOK APP ID =====
  // Reemplaza esto con tu App ID de Facebook Developers
  private readonly FACEBOOK_APP_ID = '2163399284518310';

  modoRegistro = signal(false);
  paso = signal(1); // 1: Login, 2: 2FA

  usuarioLogin   = signal('');
  passwordLogin  = signal('');
  codigo2fa      = signal('');
  // username real resuelto por la API (puede diferir si se entró con email)
  private resolvedUsername = '';

  nombreRegistro = signal('');
  correoRegistro = signal('');
  passwordRegistro = signal('');

  mostrarPasswordLogin = signal(false);
  mostrarPasswordRegistro = signal(false);

  cargando = signal(false);
  googleCargando = signal(false);
  facebookCargando = signal(false);

  constructor(private router: Router, private authService: AuthService) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadGoogleScript();
      this.loadFacebookScript();
    }
  }

  // =========================
  // GOOGLE SIGN-IN
  // =========================
  private loadGoogleScript(): void {
    if (typeof google !== 'undefined' && google.accounts) {
      this.initializeGoogleSignIn();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.initializeGoogleSignIn();
    };
    script.onerror = () => {
      console.error('Error al cargar el script de Google Sign-In');
    };
    document.head.appendChild(script);
  }

  private initializeGoogleSignIn(): void {
    if (typeof google === 'undefined' || !google.accounts) {
      return;
    }

    google.accounts.id.initialize({
      client_id: '158844941712-ur7qfnon9j69tg1vkobfdbip5a4ujm0e.apps.googleusercontent.com',
      callback: (response: any) => {
        this.ngZone.run(() => {
          this.handleGoogleResponse(response);
        });
      },
      auto_select: false,
      cancel_on_tap_outside: true
    });
  }

  loginConGoogle(): void {
    if (typeof google === 'undefined' || !google.accounts) {
      alert('Google Sign-In aún no está listo. Intenta de nuevo.');
      return;
    }

    this.googleCargando.set(true);

    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        this.showGooglePopup();
      }
    });
  }

  private showGooglePopup(): void {
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.top = '-9999px';
    tempDiv.id = 'google-temp-btn';
    document.body.appendChild(tempDiv);

    google.accounts.id.renderButton(tempDiv, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      click_listener: () => {}
    });

    setTimeout(() => {
      const btn = tempDiv.querySelector('div[role="button"]') as HTMLElement;
      if (btn) {
        btn.click();
      }
      setTimeout(() => {
        document.body.removeChild(tempDiv);
        this.ngZone.run(() => {
          this.googleCargando.set(false);
        });
      }, 1000);
    }, 300);
  }

  private handleGoogleResponse(response: any): void {
    if (!response.credential) {
      this.googleCargando.set(false);
      alert('No se recibió la credencial de Google.');
      return;
    }

    this.googleCargando.set(true);
    this.cargando.set(true);

    this.authService.loginWithGoogle(response.credential).subscribe({
      next: () => {
        this.cargando.set(false);
        this.googleCargando.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.cargando.set(false);
        this.googleCargando.set(false);
        alert(err.error?.detail || 'Error al autenticar con Google');
      }
    });
  }

  // =========================
  // FACEBOOK LOGIN
  // =========================
  private loadFacebookScript(): void {
    const win = window as any;
    if (win.FB) {
      return;
    }

    // Configurar el callback antes de cargar el SDK
    win.fbAsyncInit = () => {
      win.FB.init({
        appId: this.FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v19.0'
      });
      console.log('Facebook SDK inicializado correctamente');
    };

    // Cargar el SDK de Facebook
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    script.defer = true;
    script.id = 'facebook-jssdk';
    script.onerror = () => {
      console.error('Error al cargar el SDK de Facebook');
    };
    document.head.appendChild(script);
  }

  loginConFacebook(): void {
    const win = window as any;
    if (!win.FB) {
      alert('Facebook SDK aún no está listo. Intenta de nuevo.');
      return;
    }

    this.facebookCargando.set(true);

    win.FB.login((response: any) => {
      this.ngZone.run(() => {
        if (response.authResponse) {
          const accessToken = response.authResponse.accessToken;
          this.handleFacebookLogin(accessToken);
        } else {
          this.facebookCargando.set(false);
          console.log('El usuario canceló el login de Facebook');
        }
      });
    }, { scope: 'email' });
  }

  private handleFacebookLogin(accessToken: string): void {
    this.cargando.set(true);

    this.authService.loginWithFacebook(accessToken).subscribe({
      next: () => {
        this.cargando.set(false);
        this.facebookCargando.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.cargando.set(false);
        this.facebookCargando.set(false);
        alert(err.error?.detail || 'Error al autenticar con Facebook');
      }
    });
  }

  // =========================
  // FORMULARIO TRADICIONAL
  // =========================
  activarRegistro(): void {
    this.modoRegistro.set(true);
    this.paso.set(1);
  }

  activarLogin(): void {
    this.modoRegistro.set(false);
    this.paso.set(1);
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

    this.authService.login({
      identifier: this.usuarioLogin(),
      password:   this.passwordLogin()
    }).subscribe({
      next: (res) => {
        this.cargando.set(false);
        if (res.step === '2fa') {
          this.resolvedUsername = res.username;
          this.paso.set(2);
        }
      },
      error: (err) => {
        this.cargando.set(false);
        alert(err.error?.detail || 'Error al iniciar sesión');
      }
    });
  }

  verificar2fa(): void {
    if (!this.codigo2fa().trim()) {
      alert('Ingresa el código de 6 dígitos.');
      return;
    }

    this.cargando.set(true);

    this.authService.verify2fa({
      username: this.resolvedUsername || this.usuarioLogin(),
      code: this.codigo2fa()
    }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.cargando.set(false);
        alert(err.error?.detail || 'Código incorrecto');
      }
    });
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

    this.authService.register({
      username: this.nombreRegistro(),
      email: this.correoRegistro(),
      password: this.passwordRegistro()
    }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.modoRegistro.set(false);
        alert('Cuenta creada correctamente. Ya puedes iniciar sesión.');
      },
      error: (err) => {
        this.cargando.set(false);
        alert(err.error?.detail || 'Error en el registro');
      }
    });
  }
}