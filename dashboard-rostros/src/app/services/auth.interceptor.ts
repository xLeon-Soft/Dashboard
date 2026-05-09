import { HttpInterceptorFn } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  // Skip token for auth endpoints (register, login, verify-2fa, google, facebook)
  const isAuthEndpoint = req.url.includes('/auth/register') ||
                          req.url.includes('/auth/login') ||
                          req.url.includes('/auth/verify-2fa') ||
                          req.url.includes('/auth/google') ||
                          req.url.includes('/auth/facebook') ||
                          req.url.includes('/auth/forgot-password') ||
                          req.url.includes('/auth/reset-password');

  if (isAuthEndpoint) {
    return next(req);
  }

  // Only access localStorage in the browser
  if (isPlatformBrowser(platformId)) {
    const token = localStorage.getItem('access_token');
    if (token) {
      const cloned = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      return next(cloned);
    }
  }

  return next(req);
};
