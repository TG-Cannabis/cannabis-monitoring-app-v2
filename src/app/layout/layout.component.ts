// src/app/layout/layout.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../core/header/header.component'; // Ajusta la ruta si es necesario
import { SidebarComponent } from '../core/sidebar/sidebar.component'; // Ajusta la ruta si es necesario

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, SidebarComponent], // Importa los componentes aquí
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent { }