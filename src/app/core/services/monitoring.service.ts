// src/app/core/services/monitoring.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client'; // Importación por defecto corregida
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environment/environment'; // Ajusta la ruta si es diferente

// Modelo de datos CORREGIDO
export interface SensorMessage {
  sensorId: string;
  sensorType: string; // Corregido de 'type'
  location: string;
  value: number;
  timestamp: string; // String ISO, se parseará a Date donde se necesite
}

export interface AlertMessage {
  level: string;
  message: string;
  timestamp: string;
  source: string;
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

  // URL del WebSocket. SockJS usa http/https.
  // Si tu backend STOMP está en localhost:8085/ws
  private readonly WS_ENDPOINT = environment.wsUrl


  private activeSubscriptions: { [topic: string]: StompSubscription } = {};

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS(this.WS_ENDPOINT), // Uso de SockJSfrom (importación por defecto)
      debug: (str) => {
        console.log('[MonitoringService STOMP Debug]:', str);
      },
      reconnectDelay: 5000, // Reintentar conexión cada 5 segundos
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: (frame) => {
        console.log('[MonitoringService] Conectado a STOMP:', frame);
        this.state.next(ConnectionState.CONNECTED);
        this.subscribeToTopics(); // (Re)suscribirse después de conectar/reconectar
      },
      onStompError: (frame) => {
        console.error('[MonitoringService] Error de STOMP Broker:', frame.headers['message'], frame.body);
        this.state.next(ConnectionState.ERROR);
      },
      onDisconnect: (frame) => { // Callback de STOMP para desconexión limpia
        console.log('[MonitoringService] Desconectado de STOMP (onDisconnect):', frame);
        this.state.next(ConnectionState.DISCONNECTED);
      },
      onWebSocketError: (event) => {
        console.error('[MonitoringService] Error de WebSocket subyacente:', event);
        this.state.next(ConnectionState.ERROR);
      },
      onWebSocketClose: (event) => { // Cuando la conexión WebSocket física se cierra
        console.log('[MonitoringService] Conexión WebSocket cerrada:', event);
        this.state.next(ConnectionState.DISCONNECTED); // STOMP client intentará reconectar
      }
    });
  }

  public activate(): void {
    const currentState = this.state.getValue();
    if (currentState === ConnectionState.DISCONNECTED || currentState === ConnectionState.ERROR) {
        console.log('[MonitoringService] Activando cliente STOMP...');
        this.state.next(ConnectionState.ATTEMPTING);
        this.client.activate();
    } else if (currentState === ConnectionState.ATTEMPTING){
        console.log('[MonitoringService] Ya se está intentando conectar.');
    } else {
        console.log('[MonitoringService] Cliente STOMP ya está activo y conectado.');
    }
  }

  private subscribeToTopics(): void {
    if (this.state.getValue() === ConnectionState.CONNECTED) {
      this.subscribeToSensorData();
      this.subscribeToAlerts();
    } else {
      console.warn('[MonitoringService] No se puede suscribir a tópicos, no conectado.');
    }
  }

  private subscribeToSensorData(): void {
    const topic = '/topic/sensors/data'; // CORREGIDO: Tópico según tu log
    if (this.activeSubscriptions[topic] && this.client.active) {
      console.log(`[MonitoringService] Ya suscrito a ${topic}`);
      return;
    }
    if (this.client.connected) { // Solo suscribir si STOMP client está conectado
      this.activeSubscriptions[topic] = this.client.subscribe(topic, (message: IMessage) => {
        console.log(`[MonitoringService] Mensaje recibido de ${topic}:`, message.body);
        try {
          const parsedMessage: SensorMessage = JSON.parse(message.body);
          this.sensorDataSubject.next(parsedMessage);
        } catch (e) {
          console.error(`[MonitoringService] Error parseando mensaje de ${topic}:`, e, message.body);
        }
      });
      console.log(`[MonitoringService] Suscrito a ${topic}`);
    } else {
      console.warn(`[MonitoringService] Intento de suscribir a ${topic} pero el cliente STOMP no está conectado.`);
    }
  }

  private subscribeToAlerts(): void {
    const topic = '/topic/alerts'; // Asumiendo que este es el tópico correcto para alertas
    if (this.activeSubscriptions[topic] && this.client.active) {
      console.log(`[MonitoringService] Ya suscrito a ${topic}`);
      return;
    }
    if (this.client.connected) {
      this.activeSubscriptions[topic] = this.client.subscribe(topic, (message: IMessage) => {
        console.log(`[MonitoringService] Mensaje recibido de ${topic}:`, message.body);
        try {
          const parsedMessage: AlertMessage = JSON.parse(message.body);
          this.alertsSubject.next(parsedMessage);
        } catch (e) {
          console.error(`[MonitoringService] Error parseando mensaje de ${topic}:`, e, message.body);
        }
      });
      console.log(`[MonitoringService] Suscrito a ${topic}`);
    } else {
       console.warn(`[MonitoringService] Intento de suscribir a ${topic} pero el cliente STOMP no está conectado.`);
    }
  }

  public getConnectionState(): Observable<ConnectionState> {
    return this.state.asObservable();
  }

  public getCurrentConnectionState(): ConnectionState {
    return this.state.getValue();
  }

  ngOnDestroy(): void {
    console.log('[MonitoringService] Destruyendo servicio y desconectando cliente STOMP.');
    Object.values(this.activeSubscriptions).forEach(sub => sub.unsubscribe());
    this.activeSubscriptions = {};

    if (this.client && this.client.active) {
      this.client.deactivate().then(() => {
        console.log('[MonitoringService] Cliente STOMP desactivado.');
        this.state.next(ConnectionState.DISCONNECTED);
      }).catch(error => {
        console.error('[MonitoringService] Error al desactivar el cliente STOMP:', error);
        this.state.next(ConnectionState.ERROR);
      });
    } else {
      this.state.next(ConnectionState.DISCONNECTED);
    }

    this.sensorDataSubject.complete();
    this.alertsSubject.complete();
    this.state.complete();
  }
}