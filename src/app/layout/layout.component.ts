
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../core/header/header.component';
import { SidebarComponent } from '../core/sidebar/sidebar.component';
import { AlertPopupComponent } from '../core/alert-popup/alert-popup/alert-popup.component';
import { ToastNotificationComponent } from '../core/toast-notification/toast-notification/toast-notification.component'; 

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    AlertPopupComponent,
    ToastNotificationComponent 
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent { }