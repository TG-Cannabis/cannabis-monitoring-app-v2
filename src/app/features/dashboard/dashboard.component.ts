import { Component, OnInit, inject, ViewChild, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SensorDataService, ApiFilters, AvailableTags } from '../../core/services/sensor-data.service';
import { SensorData } from '../../core/models/sensor-data.model';
import { PdfReportService, ReportData } from '../../core/services/pdf-report.service'; // Asumiendo esta ruta

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
  private pdfReportService = inject(PdfReportService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('singleChartCanvas', { static: false }) singleChartCanvas?: BaseChartDirective;
  @ViewChildren('multiChartCanvas') multiChartCanvases?: QueryList<BaseChartDirective>;

  sensorData: SensorData[] = [];
  isLoading = false;
  error: string | null = null;

  filterVariableEntorno: string = '';
  filterInvernadero: string = '';
  filterStartDate: string = '';
  filterEndDate: string = '';

  availableVariablesEntorno: string[] = [];
  availableInvernaderos: string[] = [];
  isLoadingTags = false;
  tagsError: string | null = null;

  isTableVisible = false;
  singleLineChartData: ChartConfiguration<'line'>['data'] = { datasets: [{ data: [], label: 'Cargando...'}] };
  
  locationCharts: LocationChart[] = [];
  isMultiChartView = false; 
  isSingleVariableAllInvernaderosView = false;

  allLocationKeysForPaging: string[] = [];
  currentPage = 1;
  itemsPerPage = 3; 
  totalPages = 0;

  allInvernaderoKeysForSelectedVariable: string[] = [];
  invernaderoLinesCurrentPage = 1;
  invernaderoLinesItemsPerPage = 5;
  invernaderoLinesTotalPages = 0;

  private variableColorMap: { [key: string]: string } = {};
  private locationColorMap: { [key: string]: string } = {};
  private colorIndexForVariables = 0;
  private colorIndexForLocations = 0;

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

  private baseChartColors: string[] = [
    '#3e95cd', '#8e5ea2', '#3cba9f', '#e8c3b9', '#c45850',
    '#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0',
    '#007bff', '#6610f2', '#6f42c1', '#e83e8c', '#dc3545',
    '#fd7e14', '#ffc107', '#28a745', '#20c997', '#17a2b8'
  ];

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadData();
  }

  private assignColor(itemKey: string, map: { [key: string]: string }, colorIndexTracker: 'variables' | 'locations'): string {
    if (!map[itemKey]) {
      const indexToUse = colorIndexTracker === 'variables' ? this.colorIndexForVariables++ : this.colorIndexForLocations++;
      map[itemKey] = this.baseChartColors[indexToUse % this.baseChartColors.length];
    }
    return map[itemKey];
  }

  loadFilterOptions(): void {
    this.isLoadingTags = true;
    this.tagsError = null;
    this.sensorService.getAvailableTags()
      .pipe(finalize(() => this.isLoadingTags = false))
      .subscribe({
        next: (tags: AvailableTags) => {
          this.availableVariablesEntorno = tags.sensorTypes || [];
          this.availableInvernaderos = tags.locations || [];
          this.colorIndexForVariables = 0;
          this.availableVariablesEntorno.forEach(variable => this.assignColor(variable, this.variableColorMap, 'variables'));
          this.colorIndexForLocations = 0; 
          this.availableInvernaderos.forEach(loc => this.assignColor(loc, this.locationColorMap, 'locations'));
        },
        error: (err) => {
          this.tagsError = `Error al cargar opciones de filtro: ${err.message}`;
          this.availableVariablesEntorno = [];
          this.availableInvernaderos = [];
        }
      });
  }

  loadData(): void {
    this.isLoading = true;
    this.error = null;
    const filters: ApiFilters = {
      sensorType: this.filterVariableEntorno || undefined,
      location: this.filterInvernadero || undefined,
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
        }
      });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.invernaderoLinesCurrentPage = 1;
    this.loadData();
  }

  clearFilters(): void {
    this.filterVariableEntorno = '';
    this.filterInvernadero = '';
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.currentPage = 1;
    this.invernaderoLinesCurrentPage = 1;
    this.loadData();
  }

  toggleTableVisibility(): void {
    this.isTableVisible = !this.isTableVisible;
  }

  private groupDataBy(data: SensorData[], key: keyof SensorData): { [key: string]: SensorData[] } {
    return data.reduce((acc, item) => {
      const groupKey = String(item[key]);
      (acc[groupKey] = acc[groupKey] || []).push(item);
      return acc;
    }, {} as { [key: string]: SensorData[] });
  }

  processDataForView(filters: ApiFilters): void {
    const isSpecificVariableFilter = !!filters.sensorType;
    const isSpecificInvernaderoFilter = !!filters.location;

    this.isMultiChartView = false;
    this.isSingleVariableAllInvernaderosView = false;
    this.singleLineChartData = { datasets: [{ data: [], label: 'No hay datos'}] };
    this.locationCharts = [];
    this.totalPages = 0;
    this.invernaderoLinesTotalPages = 0;

    if (!isSpecificVariableFilter && !isSpecificInvernaderoFilter && this.sensorData.length > 0) {
      this.isMultiChartView = true;
      const dataByLocation = this.groupDataBy(this.sensorData, 'location');
      this.allLocationKeysForPaging = Object.keys(dataByLocation);
      this.totalPages = Math.ceil(this.allLocationKeysForPaging.length / this.itemsPerPage);
      if (this.currentPage > this.totalPages && this.totalPages > 0) this.currentPage = this.totalPages;
      else if (this.totalPages === 0 && this.allLocationKeysForPaging.length > 0) this.currentPage = 1;
      else if (this.allLocationKeysForPaging.length === 0) { this.currentPage = 1; this.totalPages = 0;}
      this.displayChartsForCurrentPage();
    } else if (isSpecificVariableFilter && !isSpecificInvernaderoFilter && this.sensorData.length > 0) {
      this.isSingleVariableAllInvernaderosView = true;
      const dataByInvernadero = this.groupDataBy(this.sensorData, 'location');
      this.allInvernaderoKeysForSelectedVariable = Object.keys(dataByInvernadero);
      this.invernaderoLinesTotalPages = Math.ceil(this.allInvernaderoKeysForSelectedVariable.length / this.invernaderoLinesItemsPerPage);
      if (this.invernaderoLinesCurrentPage > this.invernaderoLinesTotalPages && this.invernaderoLinesTotalPages > 0) this.invernaderoLinesCurrentPage = this.invernaderoLinesTotalPages;
      else if (this.invernaderoLinesTotalPages === 0 && this.allInvernaderoKeysForSelectedVariable.length > 0) this.invernaderoLinesCurrentPage = 1;
      else if (this.allInvernaderoKeysForSelectedVariable.length === 0) {this.invernaderoLinesCurrentPage = 1; this.invernaderoLinesTotalPages = 0;}
      this.displayLinesForCurrentPageOfInvernaderos();
    } else if (!isSpecificVariableFilter && isSpecificInvernaderoFilter && this.sensorData.length > 0) {
      const dataByVariable = this.groupDataBy(this.sensorData, 'sensorType');
      const datasets: ChartDataset<'line', { x: number; y: number }[]>[] = [];
      Object.keys(dataByVariable).forEach(variableKey => {
        const varData = dataByVariable[variableKey].sort((a,b) => a.timestamp - b.timestamp);
        if (varData.length > 0) {
          datasets.push({
            data: varData.map(p => ({x: p.timestamp, y: p.value})),
            label: variableKey,
            borderColor: this.assignColor(variableKey, this.variableColorMap, 'variables'),
            backgroundColor: this.assignColor(variableKey, this.variableColorMap, 'variables') + '33',
            fill: false, tension: 0.1, pointRadius: 2, pointHoverRadius: 5
          });
        }
      });
      this.singleLineChartData = datasets.length > 0 ? { datasets } : { datasets: [{ data: [], label: `No hay datos para ${filters.location}`}] };
    } else if (isSpecificVariableFilter && isSpecificInvernaderoFilter && this.sensorData.length > 0) {
      const sortedData = [...this.sensorData].sort((a,b) => a.timestamp - b.timestamp);
      const dataPoints = sortedData.map(p => ({x: p.timestamp, y: p.value}));
      this.singleLineChartData = {
        datasets: [{
          data: dataPoints,
          label: `${filters.sensorType} (${filters.location})`,
          borderColor: this.assignColor(filters.sensorType!, this.variableColorMap, 'variables'),
          backgroundColor: this.assignColor(filters.sensorType!, this.variableColorMap, 'variables') + '33',
          fill: false, tension: 0.1, pointRadius: 2, pointHoverRadius: 5
        }]
      };
    } else { 
      this.singleLineChartData = { datasets: [{ data: [], label: 'No hay datos para mostrar con los filtros actuales'}] };
    }
  }

  displayChartsForCurrentPage(): void {
    if (!this.isMultiChartView || this.allLocationKeysForPaging.length === 0) {
      this.locationCharts = []; return;
    }
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const keysForCurrentPage = this.allLocationKeysForPaging.slice(startIndex, endIndex);
    this.locationCharts = [];

    keysForCurrentPage.forEach(locationKey => {
      const locSpecificData = this.sensorData.filter(d => d.location === locationKey);
      const dataBySensorType = this.groupDataBy(locSpecificData, 'sensorType');
      const datasetsForLoc: ChartDataset<'line', { x: number; y: number }[]>[] = [];
      Object.keys(dataBySensorType).forEach(sensorTypeKey => {
        const typeData = dataBySensorType[sensorTypeKey].sort((a,b) => a.timestamp - b.timestamp);
        if (typeData.length > 0) {
          datasetsForLoc.push({
            data: typeData.map(p => ({x: p.timestamp, y: p.value})),
            label: sensorTypeKey,
            borderColor: this.assignColor(sensorTypeKey, this.variableColorMap, 'variables'),
            backgroundColor: this.assignColor(sensorTypeKey, this.variableColorMap, 'variables') + '33',
            fill: false, tension: 0.1, pointRadius: 2, pointHoverRadius: 5
          });
        }
      });
      if (datasetsForLoc.length > 0) {
        this.locationCharts.push({
          locationName: locationKey,
          chartDataConfig: { datasets: datasetsForLoc },
          chartOptionsConfig: this.commonLineChartOptions
        });
      } else {
         this.locationCharts.push({
          locationName: locationKey,
          chartDataConfig: { datasets: [{data: [], label: 'No hay datos para este invernadero'}] },
          chartOptionsConfig: this.commonLineChartOptions
        });
      }
    });
  }

  displayLinesForCurrentPageOfInvernaderos(): void {
    if (!this.isSingleVariableAllInvernaderosView || this.allInvernaderoKeysForSelectedVariable.length === 0) {
      this.singleLineChartData = { datasets: [{ data: [], label: `No hay datos para ${this.filterVariableEntorno || 'la variable seleccionada'}` }] };
      return;
    }
    const startIndex = (this.invernaderoLinesCurrentPage - 1) * this.invernaderoLinesItemsPerPage;
    const endIndex = startIndex + this.invernaderoLinesItemsPerPage;
    const invernaderosForPage = this.allInvernaderoKeysForSelectedVariable.slice(startIndex, endIndex);
    const datasets: ChartDataset<'line', { x: number; y: number }[]>[] = [];
    
    invernaderosForPage.forEach(invernaderoKey => {
      const invernaderoData = this.sensorData.filter(d => d.location === invernaderoKey && d.sensorType === this.filterVariableEntorno)
                                         .sort((a,b) => a.timestamp - b.timestamp);
      if (invernaderoData.length > 0) {
        datasets.push({
          data: invernaderoData.map(p => ({x: p.timestamp, y: p.value})),
          label: invernaderoKey,
          borderColor: this.assignColor(invernaderoKey, this.locationColorMap, 'locations'),
          backgroundColor: this.assignColor(invernaderoKey, this.locationColorMap, 'locations') + '33',
          fill: false, tension: 0.1, pointRadius: 2, pointHoverRadius: 5
        });
      }
    });

    if (datasets.length === 0 && invernaderosForPage.length > 0) {
        this.singleLineChartData = { datasets: [{ data: [], label: `No hay datos de invernaderos para ${this.filterVariableEntorno} en esta página` }] };
    } else if (datasets.length === 0 && invernaderosForPage.length === 0 && this.allInvernaderoKeysForSelectedVariable.length > 0) {
        this.singleLineChartData = { datasets: [{ data: [], label: `No hay más invernaderos para mostrar para ${this.filterVariableEntorno}` }] };
    } else if (datasets.length > 0) {
        this.singleLineChartData = { datasets };
    } else { // Fallback, ningún dataset y ningún invernadero en la página (debería ser cubierto arriba)
        this.singleLineChartData = { datasets: [{ data: [], label: `No hay datos para ${this.filterVariableEntorno || 'la variable'}` }] };
    }
  }

  nextPage(): void { if (this.currentPage < this.totalPages) { this.currentPage++; this.displayChartsForCurrentPage(); } }
  previousPage(): void { if (this.currentPage > 1) { this.currentPage--; this.displayChartsForCurrentPage(); } }
  goToPage(pageInput: Event | number): void {
    const pageNum = typeof pageInput === 'number' ? pageInput : parseInt((pageInput.target as HTMLSelectElement).value, 10);
    if (pageNum >= 1 && pageNum <= this.totalPages) { this.currentPage = pageNum; this.displayChartsForCurrentPage(); }
  }
  getPages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    return pages;
  }

  nextInvernaderoLinesPage(): void { if (this.invernaderoLinesCurrentPage < this.invernaderoLinesTotalPages) { this.invernaderoLinesCurrentPage++; this.displayLinesForCurrentPageOfInvernaderos(); } }
  previousInvernaderoLinesPage(): void { if (this.invernaderoLinesCurrentPage > 1) { this.invernaderoLinesCurrentPage--; this.displayLinesForCurrentPageOfInvernaderos(); } }
  goToInvernaderoLinesPage(pageInput: Event | number): void {
    const pageNum = typeof pageInput === 'number' ? pageInput : parseInt((pageInput.target as HTMLSelectElement).value, 10);
    if (pageNum >= 1 && pageNum <= this.invernaderoLinesTotalPages) { this.invernaderoLinesCurrentPage = pageNum; this.displayLinesForCurrentPageOfInvernaderos(); }
  }
  getInvernaderoLinesPages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.invernaderoLinesTotalPages; i++) pages.push(i);
    return pages;
  }

  async generatePdfReport(): Promise<void> {
    console.log('[Dashboard] Preparando datos para el reporte PDF...');
    this.cdr.detectChanges();
    await Promise.resolve(); 

    const reportData: ReportData = {
      filters: {
        variableEntorno: this.filterVariableEntorno,
        invernadero: this.filterInvernadero,
        startDate: this.filterStartDate,
        endDate: this.filterEndDate
      },
      isMultiChartView: this.isMultiChartView,
      isSingleVariableAllInvernaderosView: this.isSingleVariableAllInvernaderosView,
      locationChartsData: this.isMultiChartView ? this.locationCharts.map(lc => ({ locationName: lc.locationName })) : undefined,
      multiChartDirectives: this.isMultiChartView && this.multiChartCanvases ? this.multiChartCanvases.toArray() : undefined,
      singleChartDirective: !this.isMultiChartView && this.singleChartCanvas ? this.singleChartCanvas : undefined,
      singleChartLabel: !this.isMultiChartView && this.singleLineChartData.datasets[0] ? this.singleLineChartData.datasets[0].label : undefined,
      invernaderoLinesCurrentPage: this.isSingleVariableAllInvernaderosView ? this.invernaderoLinesCurrentPage : undefined,
      invernaderoLinesTotalPages: this.isSingleVariableAllInvernaderosView ? this.invernaderoLinesTotalPages : undefined,
      isTableVisible: this.isTableVisible,
      sensorDataForTable: this.sensorData
    };

    try {
      await this.pdfReportService.generateReport(reportData);
    } catch (error) {
      console.error('[Dashboard] Error al llamar a generateReport del servicio:', error);
      alert('Ocurrió un error al intentar generar el reporte PDF.');
    }
  }
}