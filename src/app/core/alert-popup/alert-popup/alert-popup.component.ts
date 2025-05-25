import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AlertPopupService, AlertPopupData } from './alert-popup.service'

@Component({
  selector: 'app-alert-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-popup.component.html',
  styleUrls: ['./alert-popup.component.scss']
})
export class AlertPopupComponent implements OnInit, OnDestroy {
  isVisible = false;
  alertData: AlertPopupData | null = null;
  private subscription!: Subscription;

  constructor(private alertPopupService: AlertPopupService) {}

  ngOnInit(): void {
    this.subscription = this.alertPopupService.alertState$.subscribe(state => {
      this.alertData = state.data;
      this.isVisible = state.isVisible;
      if (state.isVisible && state.data?.autoCloseDelay) {
        setTimeout(() => this.close(), state.data.autoCloseDelay);
      }
    });
  }

  close(): void {
    this.alertPopupService.hide();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}