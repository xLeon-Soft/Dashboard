import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { DistribucionGenero } from './pages/distribucion-genero/distribucion-genero';
import { LiveDetection } from './pages/vivo/vivo';
import { Comparaciones } from './pages/comparaciones/comparaciones';
import { Tendencias } from './pages/tendencias/tendencias';
import { Registro } from './pages/registro/registro';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'distribucion', component: DistribucionGenero, canActivate: [authGuard] },
  { path: 'vivo', component: LiveDetection, canActivate: [authGuard] },
  { path: 'comparaciones', component: Comparaciones, canActivate: [authGuard] },
  { path: 'tendencias', component: Tendencias, canActivate: [authGuard] },
  { path: 'registro', component: Registro, canActivate: [authGuard] },
  { path: '**', redirectTo: 'dashboard' }
];