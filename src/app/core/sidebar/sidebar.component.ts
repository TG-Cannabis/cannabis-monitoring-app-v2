import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router'; 

@Component({
  selector: 'app-sidebar',
  standalone: true, 
  imports: [
    RouterLink,
    RouterLinkActive 
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
}