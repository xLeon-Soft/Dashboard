import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8000';
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, data);
  }

  login(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, data);
  }

  verify2fa(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/verify-2fa`, data).pipe(
      tap((res: any) => {
        if (this.isBrowser && res.access_token) {
          localStorage.setItem('access_token', res.access_token);
          localStorage.setItem('refresh_token', res.refresh_token);
          if (res.email) localStorage.setItem('user_email', res.email);
          if (res.name) localStorage.setItem('user_name', res.name);
          if (res.picture) localStorage.setItem('user_picture', res.picture);
        }
      })
    );
  }

  loginWithGoogle(credential: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/google`, { credential }).pipe(
      tap((res: any) => {
        if (this.isBrowser && res.access_token) {
          localStorage.setItem('access_token', res.access_token);
          localStorage.setItem('refresh_token', res.refresh_token);
          if (res.email) localStorage.setItem('user_email', res.email);
          if (res.name) localStorage.setItem('user_name', res.name);
          if (res.picture) localStorage.setItem('user_picture', res.picture);
        }
      })
    );
  }

  loginWithFacebook(accessToken: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/facebook`, { accessToken }).pipe(
      tap((res: any) => {
        if (this.isBrowser && res.access_token) {
          localStorage.setItem('access_token', res.access_token);
          localStorage.setItem('refresh_token', res.refresh_token);
          if (res.email) localStorage.setItem('user_email', res.email);
          if (res.name) localStorage.setItem('user_name', res.name);
          if (res.picture) localStorage.setItem('user_picture', res.picture);
        }
      })
    );
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('access_token');
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_picture');
    }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, data);
  }
}
