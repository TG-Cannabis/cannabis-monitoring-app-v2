import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { SensorDataService, ApiFilters } from './sensor-data.service';
import { SensorData } from '../models/sensor-data.model';
import { environment } from '../../../environment/environment';

describe('SensorDataService', () => {
  let service: SensorDataService;
  let httpMock: HttpTestingController;
  const mockApiUrl = environment.apiUrl + '/sensorData';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SensorDataService]
    });
    service = TestBed.inject(SensorDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch sensor data without filters', (done: DoneFn) => {
    const mockSensorData: SensorData[] = [
      { id: '1', sensorType: 'temp', location: 'room1', value: 25, timestamp: Date.now(), savedAt: Date.now() },
      { id: '2', sensorType: 'humidity', location: 'room1', value: 60, timestamp: Date.now(), savedAt: Date.now() }
    ];

    service.getSensorData().subscribe(data => {
      expect(data.length).toBe(2);
      expect(data).toEqual(mockSensorData);
      done();
    });

    const req = httpMock.expectOne(mockApiUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush(mockSensorData);
  });

  it('should fetch sensor data with filters', (done: DoneFn) => {
    const mockSensorData: SensorData[] = [
      { id: '1', sensorType: 'temp', location: 'room1', value: 25, timestamp: Date.now(), savedAt: Date.now() }
    ];
    const filters: ApiFilters = { sensorType: 'temp', location: 'room1' };

    service.getSensorData(filters).subscribe(data => {
      expect(data.length).toBe(1);
      expect(data).toEqual(mockSensorData);
      done();
    });

    const req = httpMock.expectOne(request =>
        request.url === mockApiUrl &&
        request.params.has('sensorType') && request.params.get('sensorType') === filters.sensorType &&
        request.params.has('location') && request.params.get('location') === filters.location
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockSensorData);
  });

  it('should handle API errors', (done: DoneFn) => {
    const filters: ApiFilters = {};

    service.getSensorData(filters).subscribe({
      next: () => fail('should have failed with an error'),
      error: (error: Error) => {
        expect(error.message).toContain('Error 500');
        done();
      }
    });

    const req = httpMock.expectOne(mockApiUrl);
    req.flush({ message: 'Internal Server Error' }, { status: 500, statusText: 'Internal Server Error' });
  });
});