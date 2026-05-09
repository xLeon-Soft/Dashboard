import { Component, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Sidebar } from './components/sidebar/sidebar';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Sidebar, CommonModule],
  template: `
    <div class="app-container" [class.with-sidebar]="!isAuthPage()">
      <app-sidebar *ngIf="!isAuthPage()" />
      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      min-height: 100vh;
      background: #0c0c10;
    }
    .with-sidebar .main-content {
      margin-left: 260px;
      width: calc(100% - 260px);
    }
    .main-content {
      flex: 1;
      width: 100%;
      background: #0c0c10;
    }
  `]
})
export class App {
  private router = inject(Router);

  isAuthPage(): boolean {
    const url = this.router.url;
    return url === '/' || url === '/login' || url.startsWith('/forgot-password');
  }
}