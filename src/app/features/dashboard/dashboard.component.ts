import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Importar FormsModule
import { SensorDataService, ApiFilters } from '../../core/services/sensor-data.service';
import { SensorData } from '../../core/models/sensor-data.model';

// Para el gráfico (se añadirán más tarde)
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule, // Añadir FormsModule a los imports
    BaseChartDirective // Añadir BaseChartDirective para el gráfico
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private sensorService = inject(SensorDataService);

  sensorData: SensorData[] = [];
  isLoading = false;
  error: string | null = null;

  // Propiedades para los filtros
  filterSensorType: string = '';
  filterLocation: string = '';
  filterStartDate: string = ''; // Formato YYYY-MM-DD
  filterEndDate: string = '';   // Formato YYYY-MM-DD

  // --- Configuración del Gráfico ---
  public lineChartData: ChartConfiguration['data'] = {
    datasets: [{ data: [], label: 'Valor del Sensor', borderColor: '#3e95cd', fill: false }],
    labels: []
  };
  public lineChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { type: 'time', time: { unit: 'hour', tooltipFormat: 'MMM d, yyyy, HH:mm', displayFormats: { hour: 'HH:mm' } }, title: { display: true, text: 'Tiempo' } },
      y: { beginAtZero: true, title: { display: true, text: 'Valor' } }
    },
    plugins: { legend: { display: true }, tooltip: { mode: 'index', intersect: false } },
    interaction: { mode: 'nearest', axis: 'x', intersect: false }
  };
  public lineChartType: ChartType = 'line';
  // --- Fin Configuración del Gráfico ---

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    const filters: ApiFilters = {
      sensorType: this.filterSensorType || undefined,
      location: this.filterLocation || undefined,
      startDate: this.filterStartDate || undefined,
      endDate: this.filterEndDate || undefined
    };

    this.sensorService.getSensorData(filters).subscribe({
      next: (data) => {
        this.sensorData = data;
        this.processChartData(data); // Procesar datos para el gráfico
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.message;
        this.isLoading = false;
        this.sensorData = []; // Limpiar datos en caso de error
        this.processChartData([]); // Limpiar gráfico en caso de error
        console.error(err);
      }
    });
  }

  applyFilters(): void {
    this.loadData();
  }

  clearFilters(): void {
    this.filterSensorType = '';
    this.filterLocation = '';
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.loadData();
  }

  processChartData(data: SensorData[]): void {
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const labels = sortedData.map(point => new Date(point.timestamp));
    const values = sortedData.map(point => point.value);

    this.lineChartData.labels = labels;
    this.lineChartData.datasets[0].data = values;
    this.lineChartData = { ...this.lineChartData }; // Forzar actualización del gráfico
  }
}