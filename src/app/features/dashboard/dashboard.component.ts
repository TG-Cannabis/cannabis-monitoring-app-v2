import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SensorDataService, ApiFilters, AvailableTags } from '../../core/services/sensor-data.service';
import { SensorData } from '../../core/models/sensor-data.model';

import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType, ChartDataset } from 'chart.js';
import { finalize } from 'rxjs/operators';

interface LocationChart {
  locationName: string;
  chartDataConfig: ChartConfiguration<'line'>['data'];
  chartOptionsConfig: ChartOptions<'line'>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    BaseChartDirective
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private sensorService = inject(SensorDataService);

  sensorData: SensorData[] = [];
  isLoading = false;
  error: string | null = null;

  filterSensorType: string = '';
  filterLocation: string = '';
  filterStartDate: string = '';
  filterEndDate: string = '';

  availableSensorTypes: string[] = [];
  availableLocations: string[] = [];
  isLoadingTags = false;
  tagsError: string | null = null;

  singleLineChartData: ChartConfiguration<'line'>['data'] = { datasets: [], labels: [] };
  
  locationCharts: LocationChart[] = [];
  isMultiChartView = false;
  
  allLocationKeysForPaging: string[] = [];
  currentPage = 1;
  itemsPerPage = 1; 
  totalPages = 0;

  public commonLineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          tooltipFormat: 'MMM d, yyyy, HH:mm',
          displayFormats: { 
            minute: 'HH:mm', 
            hour: 'MMM d, HH:mm' 
          }
        },
        title: { display: true, text: 'Tiempo' }
      },
      y: {
        beginAtZero: false,
        title: { display: true, text: 'Valor' }
      }
    },
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: { mode: 'index', intersect: false }
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    animation: { duration: 0 }
  };

  public lineChartType: 'line' = 'line';

  private chartColors: string[] = [
    '#3e95cd', '#8e5ea2', '#3cba9f', '#e8c3b9', '#c45850',
    '#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0',
    '#007bff', '#6610f2', '#6f42c1', '#e83e8c', '#dc3545',
    '#fd7e14', '#ffc107', '#28a745', '#20c997', '#17a2b8'
  ];

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadData();
  }

  loadFilterOptions(): void {
    this.isLoadingTags = true;
    this.tagsError = null;
    this.sensorService.getAvailableTags()
      .pipe(finalize(() => this.isLoadingTags = false))
      .subscribe({
        next: (tags: AvailableTags) => {
          this.availableSensorTypes = tags.sensorTypes || [];
          this.availableLocations = tags.locations || [];
        },
        error: (err) => {
          this.tagsError = `Error al cargar opciones de filtro: ${err.message}`;
          console.error('Error fetching available tags:', err);
          this.availableSensorTypes = [];
          this.availableLocations = [];
        }
      });
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

    this.sensorService.getSensorData(filters)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (data) => {
          this.sensorData = data;
          this.processDataForView(filters);
        },
        error: (err) => {
          this.error = err.message;
          this.sensorData = [];
          this.processDataForView(filters);
          console.error(err);
        }
      });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadData();
  }

  clearFilters(): void {
    this.filterSensorType = '';
    this.filterLocation = '';
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.currentPage = 1;
    this.loadData();
  }

  private groupDataBy(data: SensorData[], key: keyof SensorData): { [key: string]: SensorData[] } {
    return data.reduce((acc, item) => {
      const groupKey = String(item[key]);
      (acc[groupKey] = acc[groupKey] || []).push(item);
      return acc;
    }, {} as { [key: string]: SensorData[] });
  }

   processDataForView(filters: ApiFilters): void {
    const isSpecificLocationFilterActive = !!filters.location;
    const isSpecificSensorTypeFilterActive = !!filters.sensorType;

    // Si no hay filtros específicos de ubicación O tipo de sensor, Y hay datos, usamos la vista multi-gráfico paginada.
    if (!isSpecificLocationFilterActive && !isSpecificSensorTypeFilterActive && this.sensorData.length > 0) {
      this.isMultiChartView = true;
      this.singleLineChartData = { datasets: [{ data: [], label: '' }], labels: [] }; // Limpiar/resetear

      const dataByLocation = this.groupDataBy(this.sensorData, 'location');
      this.allLocationKeysForPaging = Object.keys(dataByLocation);
      this.totalPages = Math.ceil(this.allLocationKeysForPaging.length / this.itemsPerPage);
      
      if (this.currentPage > this.totalPages && this.totalPages > 0) {
        this.currentPage = this.totalPages;
      } else if (this.totalPages === 0 && this.allLocationKeysForPaging.length > 0) {
         this.currentPage = 1;
      } else if (this.allLocationKeysForPaging.length === 0) {
        this.currentPage = 1;
        this.totalPages = 0;
      }
      this.displayChartsForCurrentPage();

    } else { // Uno o más filtros específicos (ubicación y/o tipo de sensor) están activos, o no hay datos.
      this.isMultiChartView = false;
      this.locationCharts = [];
      this.allLocationKeysForPaging = [];
      this.totalPages = 0;
      this.currentPage = 1;

      // this.sensorData ya está filtrado por el servicio según filters.location y filters.sensorType

      if (isSpecificLocationFilterActive && !isSpecificSensorTypeFilterActive) {
        // CASO: Ubicación específica, TODOS los tipos de sensor para esa ubicación.
        // this.sensorData contiene todos los tipos de sensor para la filters.location dada.
        const dataBySensorType = this.groupDataBy(this.sensorData, 'sensorType');
        const datasets: ChartDataset<'line', { x: number; y: number }[]>[] = [];
        let colorIndex = 0;

        Object.keys(dataBySensorType).forEach(sensorTypeKey => {
          const typeSpecificSortedData = dataBySensorType[sensorTypeKey].sort((a: SensorData, b: SensorData) => a.timestamp - b.timestamp);
          if (typeSpecificSortedData.length > 0) {
            datasets.push({
              data: typeSpecificSortedData.map((p: SensorData) => ({ x: p.timestamp, y: p.value })),
              label: `${sensorTypeKey}`, // Etiqueta es el tipo de sensor. La ubicación es el título del gráfico implícito.
              borderColor: this.chartColors[colorIndex % this.chartColors.length],
              backgroundColor: this.chartColors[colorIndex % this.chartColors.length] + '33',
              fill: false, tension: 0.1, pointRadius: 2, pointHoverRadius: 5
            });
            colorIndex++;
          }
        });
        this.singleLineChartData = { datasets };

      } else {
        // CASO: Tipo de sensor específico (con o sin ubicación específica),
        // O si this.sensorData está vacío después del filtrado del servicio.
        // Esto resultará en una sola línea (o ninguna si no hay datos).
        const sortedData = [...this.sensorData].sort((a: SensorData, b: SensorData) => a.timestamp - b.timestamp);
        const singleChartDataPoints = sortedData.map((p: SensorData) => ({ x: p.timestamp, y: p.value }));
        
        let label = 'Datos Filtrados';
        if (filters.sensorType && filters.location) {
            label = `${filters.sensorType} (${filters.location})`;
        } else if (filters.sensorType) {
            label = filters.sensorType;
        } else if (filters.location) { 
            // Si solo hay filtro de ubicación, pero también de tipo de sensor (aunque sea implícito que este caso ya no debería pintar aquí),
            // o si los datos están vacíos.
            label = filters.location; 
        }

        if (singleChartDataPoints.length === 0) {
            if (filters.sensorType || filters.location) {
                label = `No hay datos para ${label}`;
            } else {
                label = 'No hay datos para mostrar';
            }
        }
        
        this.singleLineChartData = {
          datasets: [{
            data: singleChartDataPoints,
            label: label,
            borderColor: this.chartColors[0],
            backgroundColor: this.chartColors[0] + '33',
            fill: false, tension: 0.1, pointRadius: 2, pointHoverRadius: 5
          }]
        };
      }
      
      // Asegurar una estructura mínima para singleLineChartData.datasets[0] si no hay datos
      // para evitar errores en la plantilla al acceder a .data
      if (!this.singleLineChartData.datasets || this.singleLineChartData.datasets.length === 0) {
        this.singleLineChartData.datasets = [{ data: [], label: 'No hay datos' }];
      } else if (this.singleLineChartData.datasets[0] && !this.singleLineChartData.datasets[0].data) {
        this.singleLineChartData.datasets[0].data = [];
      }
    }
  }



  displayChartsForCurrentPage(): void {
    if (!this.isMultiChartView || this.allLocationKeysForPaging.length === 0) {
      this.locationCharts = [];
      return;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const keysForCurrentPage = this.allLocationKeysForPaging.slice(startIndex, endIndex);

    this.locationCharts = [];

    keysForCurrentPage.forEach(locationKey => {
      const locationSpecificData = this.sensorData.filter(d => d.location === locationKey);
      const dataBySensorTypeInLocation = this.groupDataBy(locationSpecificData, 'sensorType');
      
      const datasetsForCurrentLocation: ChartDataset<'line', { x: number; y: number }[]>[] = [];
      let colorIndex = 0;

      Object.keys(dataBySensorTypeInLocation).forEach(sensorTypeKey => {
        const sensorTypeData = dataBySensorTypeInLocation[sensorTypeKey].sort((a: SensorData, b: SensorData) => a.timestamp - b.timestamp);
        datasetsForCurrentLocation.push({
          data: sensorTypeData.map((p: SensorData) => ({ x: p.timestamp, y: p.value })),
          label: `${sensorTypeKey}`,
          borderColor: this.chartColors[colorIndex % this.chartColors.length],
          backgroundColor: this.chartColors[colorIndex % this.chartColors.length] + '33',
          fill: false, tension: 0.1, pointRadius: 2, pointHoverRadius: 5
        });
        colorIndex++;
      });

      if (datasetsForCurrentLocation.length > 0) {
        this.locationCharts.push({
          locationName: locationKey,
          chartDataConfig: { datasets: datasetsForCurrentLocation },
          chartOptionsConfig: this.commonLineChartOptions
        });
      }
    });
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.displayChartsForCurrentPage();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.displayChartsForCurrentPage();
    }
  }

  goToPage(pageInput: Event | number): void {
    const pageNumber = typeof pageInput === 'number' ? pageInput : parseInt((pageInput.target as HTMLSelectElement).value, 10);
    if (pageNumber >= 1 && pageNumber <= this.totalPages) {
      this.currentPage = pageNumber;
      this.displayChartsForCurrentPage();
    }
  }

  getPages(): number[] {
    const pagesArray: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pagesArray.push(i);
    }
    return pagesArray;
  }
}