import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class EnvService {
  public apiUrl = window['env']['apiUrl'] || 'http://localhost:8080/api';
  public wsUrl = window['env']['wsUrl'] || 'http://localhost:8085/ws';
}
