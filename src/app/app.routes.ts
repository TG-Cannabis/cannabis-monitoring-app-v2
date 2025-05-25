
import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component'; 

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent, 
    children: [
      
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }, 
      {
        path: 'dashboard',
        
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'monitoring',
        
        loadComponent: () => import('./features/monitoring/monitoring.component').then(m => m.MonitoringComponent)
      }
    ]
  },
  
  
  
];