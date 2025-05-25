import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AlertPopupData {
  
  level: "Info" | "Warning" | "Error" | "Critical"; 
  message: string;
  timestamp: string;
  source?: string;

  
  sensorId?: string;
  sensorType?: string;
  currentValue?: number;
  alertType?: string;
  durationSeconds?: number;

  autoCloseDelay?: number;
}

interface AlertPopupState {
  isVisible: boolean;
  data: AlertPopupData | null;
}

@Injectable({
  providedIn: 'root'
})
export class AlertPopupService {
  private alertStateSubject = new BehaviorSubject<AlertPopupState>({ isVisible: false, data: null });
  alertState$ = this.alertStateSubject.asObservable();

  constructor() { }

  show(alertData: AlertPopupData): void {
    
    const validLevels: Array<AlertPopupData['level']> = ["Info", "Warning", "Error", "Critical"];
    if (!validLevels.includes(alertData.level as any)) {
        console.warn(`Invalid level: ${alertData.level}. Defaulting to Info.`);
        alertData.level = "Info";
    }
    this.alertStateSubject.next({ isVisible: true, data: alertData });
  }

  hide(): void {
    this.alertStateSubject.next({ isVisible: false, data: null });
  }
}