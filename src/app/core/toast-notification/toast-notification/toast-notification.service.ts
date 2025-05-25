import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  level: 'Info' | 'Warning' | 'Error' | 'Critical' | 'Success'; 
  duration?: number; 
  timerId?: any; 
}

@Injectable({
  providedIn: 'root'
})
export class ToastNotificationService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();
  private nextId = 0;

  constructor() { }

  show(message: string, level: Toast['level'], duration: number = 5000): void {
    const newToast: Toast = {
      id: this.nextId++,
      message,
      level,
      duration
    };

    const currentToasts = this.toastsSubject.getValue();
    this.toastsSubject.next([...currentToasts, newToast]);

    if (duration) {
      newToast.timerId = setTimeout(() => {
        this.remove(newToast.id);
      }, duration);
    }
  }

  remove(toastId: number): void {
    const currentToasts = this.toastsSubject.getValue();
    const toastToRemove = currentToasts.find(t => t.id === toastId);

    if (toastToRemove && toastToRemove.timerId) {
      clearTimeout(toastToRemove.timerId); 
    }

    this.toastsSubject.next(currentToasts.filter(toast => toast.id !== toastId));
  }

  
  info(message: string, duration?: number): void {
    this.show(message, 'Info', duration);
  }

  warning(message: string, duration?: number): void {
    this.show(message, 'Warning', duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, 'Error', duration); 
  }

  critical(message: string, duration?: number): void {
    this.show(message, 'Critical', duration);
  }

  success(message: string, duration?: number): void {
    this.show(message, 'Success', duration);
  }
}