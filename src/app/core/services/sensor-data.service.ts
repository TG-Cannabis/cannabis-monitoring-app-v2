import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SensorData, ApiFilters } from '../models/sensor-data.model';
import { environment } from '../../../environment/environment';

export interface AvailableTags {
  sensorTypes: string[];
  locations: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SensorDataService {
  private apiUrlBase = environment.apiUrl;
  private http = inject(HttpClient);

  getSensorData(filters: ApiFilters = {}): Observable<SensorData[]> {
    const sensorDataUrl = `${this.apiUrlBase}/sensorData`;
    let params = new HttpParams();
    if (filters.sensorType) {
      params = params.set('sensorType', filters.sensorType);
    }
    if (filters.location) {
      params = params.set('location', filters.location);
    }
    if (filters.startDate) {
      params = params.set('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params = params.set('endDate', filters.endDate);
    }

    return this.http.get<SensorData[]>(sensorDataUrl, { params }).pipe(
      map(data => {
        return data.map(point => ({
          ...point,
          timestamp: point.timestamp
        }));
      }),
      catchError(this.handleError)
    );
  }

  getAvailableTags(): Observable<AvailableTags> {
    const tagsUrl = `${this.apiUrlBase}/availableTags`;
    return this.http.get<AvailableTags>(tagsUrl).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Error en el servicio de datos:', error);
    let errorMessage = 'Ocurrió un error desconocido al contactar la API.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else if (error.status) {
      errorMessage = `Error ${error.status}: ${error.message || error.statusText}`;
      if (error.error && typeof error.error === 'string') {
        errorMessage += ` - ${error.error}`;
      } else if (error.error && error.error.message) {
        errorMessage += ` - ${error.error.message}`;
      }
    }
    return throwError(() => new Error(errorMessage));
  }
}

export type{ ApiFilters };