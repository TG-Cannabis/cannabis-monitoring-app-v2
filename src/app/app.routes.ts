// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component'; // Importa tu LayoutComponent

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent, // LayoutComponent ahora maneja el marco principal
    children: [
      // Rutas hijas que se mostrarán dentro del <router-outlet> de LayoutComponent
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }, // Redirige la ruta vacía a dashboard
      {
        path: 'dashboard',
        // Crea un DashboardComponent o el que sea tu vista principal
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'monitoring',
        // Ejemplo de otra sección, como el gráfico de sensores que creaste
        loadComponent: () => import('./features/monitoring/monitoring.component').then(m => m.MonitoringComponent)
      },/*
      {
        path: 'settings',
        // Crea un SettingsComponent
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
      }
      // ... más rutas que usarán este layout*/
    ]
  },
  // Puedes tener otras rutas de nivel superior que NO usen LayoutComponent (ej. login, error)
  // { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  // { path: '**', redirectTo: '' } // Wildcard route (opcional)
];