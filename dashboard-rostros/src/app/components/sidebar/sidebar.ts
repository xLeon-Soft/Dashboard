import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss']
})
export class Sidebar implements OnInit {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  activeItem: string = 'Resumen General';
  userName: string = 'Usuario';
  userEmail: string = '';
  userPicture: string = '';

  menuItems = [
    { icon: 'home', label: 'Resumen General', route: '/dashboard' },
    { icon: 'pie-chart', label: 'Distribución por Género', route: '/distribucion' },
    { icon: 'video', label: 'Detección en Vivo', route: '/vivo' },
    { icon: 'bar-chart', label: 'Comparaciones', route: '/comparaciones' },
    { icon: 'trending-up', label: 'Tendencias', route: '/tendencias' },
    { icon: 'database', label: 'Registro', route: '/registro' }
  ];

  constructor() {
    this.updateActiveItem(this.router.url);

    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.updateActiveItem(event.urlAfterRedirects);
    });
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.userName = localStorage.getItem('user_name') || 'Usuario';
      this.userEmail = localStorage.getItem('user_email') || '';
      const nameForAvatar = this.userName.replace(' ', '+');
      this.userPicture = localStorage.getItem('user_picture') || `https://ui-avatars.com/api/?name=${nameForAvatar}&background=1e1e2c&color=c9a96e`;
    }
  }

  setActive(item: any) {
    this.activeItem = item.label;
    if (this.router.url !== item.route) {
      this.router.navigate([item.route]);
    }
  }

  private updateActiveItem(url: string): void {
    const active = this.menuItems.find(item => item.route === url);
    if (active) {
      this.activeItem = active.label;
    }
  }

  get activeIndex(): number {
    return this.menuItems.findIndex(item => item.label === this.activeItem);
  }

  isActive(label: string): boolean {
    return this.activeItem === label;
  }

  obtenerHoraActual(): string {
    return new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  logout() {
    this.router.navigate(['/login']);
  }
}
