
import { Injectable, OnDestroy, inject } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environment/environment';
import { AlertPopupService, AlertPopupData } from '../alert-popup/alert-popup/alert-popup.service';
import { ToastNotificationService, Toast } from '../toast-notification/toast-notification/toast-notification.service';

export interface SensorMessage { 
  sensorId: string;
  sensorType: string;
  location: string;
  value: number;
  timestamp: string;
}


export interface AlertMessage {
  sensorType: string;
  currentValue: number;
  alertType: string; 
  durationSeconds?: number; 
  message: string; 

  
  timestamp?: string; 
  sensorId?: string;  
}

export enum ConnectionState {
  ATTEMPTING,
  CONNECTED,
  DISCONNECTED,
  ERROR
}

@Injectable({
  providedIn: 'root'
})
export class MonitoringService implements OnDestroy {
  private client: Client;
  private state = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);

  private sensorDataSubject = new Subject<SensorMessage>();
  public sensorData$: Observable<SensorMessage> = this.sensorDataSubject.asObservable();

  private alertsSubject = new Subject<AlertMessage>();
  public alerts$: Observable<AlertMessage> = this.alertsSubject.asObservable();

  private readonly WS_ENDPOINT = environment.wsUrl; //
  private activeSubscriptions: { [topic: string]: StompSubscription } = {};
  private alertPopupService = inject(AlertPopupService);
  private toastNotificationService = inject(ToastNotificationService);

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS(this.WS_ENDPOINT), //
      debug: (str) => { //
        console.log('[MonitoringService STOMP Debug]:', str);
      },
      reconnectDelay: 5000, //
      heartbeatIncoming: 4000, //
      heartbeatOutgoing: 4000, //
      onConnect: (frame) => { //
        console.log('[MonitoringService] Conectado a STOMP:', frame);
        this.state.next(ConnectionState.CONNECTED); //
        this.subscribeToTopics();
      },
      onStompError: (frame) => { //
        console.error('[MonitoringService] Error de STOMP Broker:', frame.headers['message'], frame.body);
        this.state.next(ConnectionState.ERROR); //
      },
      onDisconnect: (frame) => { //
        console.log('[MonitoringService] Desconectado de STOMP (onDisconnect):', frame);
        this.state.next(ConnectionState.DISCONNECTED); //
      },
      onWebSocketError: (event) => { //
        console.error('[MonitoringService] Error de WebSocket subyacente:', event);
        this.state.next(ConnectionState.ERROR); //
      },
      onWebSocketClose: (event) => { //
        console.log('[MonitoringService] Conexión WebSocket cerrada:', event);
        this.state.next(ConnectionState.DISCONNECTED); //
      }
    });
  }

  public activate(): void {
    const currentState = this.state.getValue(); //
    if (currentState === ConnectionState.DISCONNECTED || currentState === ConnectionState.ERROR) { //
        console.log('[MonitoringService] Activando cliente STOMP...');
        this.state.next(ConnectionState.ATTEMPTING); //
        this.client.activate(); //
    } else if (currentState === ConnectionState.ATTEMPTING){ //
        console.log('[MonitoringService] Ya se está intentando conectar.');
    } else {
        console.log('[MonitoringService] Cliente STOMP ya está activo y conectado.');
    }
  }

  private subscribeToTopics(): void {
    if (this.state.getValue() === ConnectionState.CONNECTED) { //
      this.subscribeToSensorData();
      this.subscribeToAlerts();
    } else {
      console.warn('[MonitoringService] No se puede suscribir a tópicos, no conectado.'); //
    }
  }

  private subscribeToSensorData(): void {
    const topic = '/topic/sensors/data'; //
    if (this.activeSubscriptions[topic] && this.client.active) { //
      return;
    }
    if (this.client.connected) { //
      this.activeSubscriptions[topic] = this.client.subscribe(topic, (message: IMessage) => { //
        try {
          const parsedMessage: SensorMessage = JSON.parse(message.body); //
          this.sensorDataSubject.next(parsedMessage); //
        } catch (e) {
          console.error(`[MonitoringService] Error parseando mensaje de ${topic}:`, e, message.body); //
        }
      });
      console.log(`[MonitoringService] Suscrito a ${topic}`); //
    } else {
      console.warn(`[MonitoringService] Intento de suscribir a ${topic} pero el cliente STOMP no está conectado.`); //
    }
  }

  private mapAlertTypeToLevel(alertType: string): { popupLevel: AlertPopupData['level'], toastLevel: Toast['level'] } {
    const upperAlertType = alertType.toUpperCase();
    if (upperAlertType.includes("CRITICAL")) {
      return { popupLevel: "Critical", toastLevel: "Critical" };
    }
    if (upperAlertType.includes("TOO_HIGH") || upperAlertType.includes("HIGH") || upperAlertType.includes("ERROR") || upperAlertType.includes("OFFLINE") || upperAlertType.includes("FAILURE") ) {
      return { popupLevel: "Error", toastLevel: "Error" };
    }
    if (upperAlertType.includes("WARNING") || upperAlertType.includes("TOO_LOW")) { 
      return { popupLevel: "Warning", toastLevel: "Warning" };
    }
    return { popupLevel: "Info", toastLevel: "Info" }; 
  }

  private subscribeToAlerts(): void {
    const topic = '/topic/alerts'; //
    if (this.activeSubscriptions[topic] && this.client.active) { //
      return;
    }
    if (this.client.connected) { //
      this.activeSubscriptions[topic] = this.client.subscribe(topic, (stompMessage: IMessage) => { //
        console.log(`[MonitoringService] Mensaje (Alerta) recibido de ${topic}:`, stompMessage.body);
        try {
          const parsedAlert: AlertMessage = JSON.parse(stompMessage.body);

          
          if (!parsedAlert.timestamp) {
            parsedAlert.timestamp = new Date().toISOString();
          }

          this.alertsSubject.next(parsedAlert);

          const { popupLevel, toastLevel } = this.mapAlertTypeToLevel(parsedAlert.alertType);

          
          const popupData: AlertPopupData = {
            level: popupLevel,
            message: parsedAlert.message, 
            timestamp: parsedAlert.timestamp,
            source: parsedAlert.sensorId || parsedAlert.sensorType, 
            sensorId: parsedAlert.sensorId,
            sensorType: parsedAlert.sensorType,
            currentValue: parsedAlert.currentValue,
            alertType: parsedAlert.alertType,
            durationSeconds: parsedAlert.durationSeconds,
            autoCloseDelay: (popupLevel === 'Critical' || popupLevel === 'Error') ? undefined : 7000
          };
          this.alertPopupService.show(popupData);

          
          
          const toastMessage = `${parsedAlert.sensorType} (${parsedAlert.alertType}): ${parsedAlert.currentValue}. ${parsedAlert.message}`;
          const toastDuration = (toastLevel === 'Critical' || toastLevel === 'Error') ? 8000 : 5000;

          this.toastNotificationService.show(toastMessage, toastLevel, toastDuration);

        } catch (e) {
          console.error(`[MonitoringService] Error parseando mensaje de ${topic}:`, e, stompMessage.body); //
        }
      });
      console.log(`[MonitoringService] Suscrito a ${topic}`); //
    } else {
       console.warn(`[MonitoringService] Intento de suscribir a ${topic} pero el cliente STOMP no está conectado.`); //
    }
  }

  public getConnectionState(): Observable<ConnectionState> {
    return this.state.asObservable(); //
  }

  public getCurrentConnectionState(): ConnectionState {
    return this.state.getValue(); //
  }

  ngOnDestroy(): void {
    console.log('[MonitoringService] Destruyendo servicio y desconectando cliente STOMP.'); //
    Object.values(this.activeSubscriptions).forEach(sub => sub.unsubscribe()); //
    this.activeSubscriptions = {}; //

    if (this.client && this.client.active) { //
      this.client.deactivate().then(() => { //
        console.log('[MonitoringService] Cliente STOMP desactivado.'); //
        this.state.next(ConnectionState.DISCONNECTED); //
      }).catch(error => {
        console.error('[MonitoringService] Error al desactivar el cliente STOMP:', error); //
        this.state.next(ConnectionState.ERROR); //
      });
    } else {
      this.state.next(ConnectionState.DISCONNECTED); //
    }

    this.sensorDataSubject.complete(); //
    this.alertsSubject.complete(); //
    this.state.complete(); //
  }
}