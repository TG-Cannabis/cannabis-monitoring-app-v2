export interface SensorData {
  id: string;
  sensorType: string;
  location: string;
  sensorId?: string;
  value: number;
  timestamp: number;
  savedAt: number;
}

export interface ApiFilters {
  sensorType?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
}