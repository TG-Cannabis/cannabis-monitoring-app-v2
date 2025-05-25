

import { Component, OnInit, inject, ViewChild, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SensorDataService, ApiFilters, AvailableTags } from '../../core/services/sensor-data.service';
import { SensorData } from '../../core/models/sensor-data.model';

import { PdfReportService, ReportData } from '../../core/services/pdf-report.service';

import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType, ChartDataset } from 'chart.js';
import { finalize } from 'rxjs/operators';

interface LocationChart {
  locationName: string;
  chartDataConfig: ChartConfiguration<'line'>['data'];
  chartOptionsConfig: ChartOptions<'line'>;
}


async function captureChartImage(
  chartDirective: BaseChartDirective | undefined,
  chartNameForLog: string,
  cdr: ChangeDetectorRef, 
  maxRetries = 5,
  delayBetweenRetries = 300 
): Promise<string | null> {
  if (!chartDirective) {
    console.warn(`[Dashboard] Directiva de gráfico para '${chartNameForLog}' es indefinida.`);
    return null;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    
    cdr.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 100)); 

    if (chartDirective.chart && chartDirective.chart.ctx) {
      try {
        
        chartDirective.chart.update('none');
        
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

        const image = chartDirective.chart.toBase64Image();
        if (image && image.startsWith('data:image/png')) {
          console.log(`[Dashboard] Imagen para '${chartNameForLog}' capturada en intento ${attempt}.`);
          return image;
        } else {
          console.warn(`[Dashboard] toBase64Image para '${chartNameForLog}' devolvió datos inválidos en intento ${attempt}.`);
        }
      } catch (error) {
        console.error(`[Dashboard] Error capturando imagen para '${chartNameForLog}' en intento ${attempt}:`, error);
      }
    } else {
      console.warn(`[Dashboard] Instancia de Chart.js (.chart) o su contexto (.ctx) no encontrados para '${chartNameForLog}' en intento ${attempt}. ` +
                   `chart: ${!!chartDirective.chart}, ctx: ${!!chartDirective.chart?.ctx}`);
    }

    if (attempt < maxRetries) {
      console.log(`[Dashboard] Reintentando captura de imagen para '${chartNameForLog}' (${attempt}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenRetries));
    }
  }

  console.error(`[Dashboard] No se pudo capturar la imagen para '${chartNameForLog}' después de ${maxRetries} intentos.`);
  return null;
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
          tooltipFormat: 'MMM d, HH:mm', 
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
          console.error(this.tagsError);
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
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges(); 
      }))
      .subscribe({
        next: (data) => {
          this.sensorData = data;
          this.processDataForView(filters);
        },
        error: (err) => {
          this.error = err.message;
          console.error('Error al cargar datos de sensores:', err);
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

    if (this.sensorData.length === 0) {
      this.singleLineChartData = { datasets: [{ data: [], label: 'No hay datos para mostrar con los filtros actuales'}] };
      this.cdr.detectChanges();
      return;
    }

    
    if (!isSpecificVariableFilter && !isSpecificInvernaderoFilter) {
      this.isMultiChartView = true;
      const dataByLocation = this.groupDataBy(this.sensorData, 'location');
      this.allLocationKeysForPaging = Object.keys(dataByLocation).sort(); 
      this.totalPages = Math.ceil(this.allLocationKeysForPaging.length / this.itemsPerPage);
      
      if (this.currentPage > this.totalPages && this.totalPages > 0) this.currentPage = this.totalPages;
      else if (this.totalPages === 0 && this.allLocationKeysForPaging.length > 0) this.currentPage = 1; 
      else if (this.allLocationKeysForPaging.length === 0) { this.currentPage = 1; this.totalPages = 0;}
      
      this.displayChartsForCurrentPage();
    }
    
    else if (isSpecificVariableFilter && !isSpecificInvernaderoFilter) {
      this.isSingleVariableAllInvernaderosView = true;
      
      const filteredDataForVariable = this.sensorData.filter(d => d.sensorType === filters.sensorType);
      const dataByInvernadero = this.groupDataBy(filteredDataForVariable, 'location');
      this.allInvernaderoKeysForSelectedVariable = Object.keys(dataByInvernadero).sort();

      this.invernaderoLinesTotalPages = Math.ceil(this.allInvernaderoKeysForSelectedVariable.length / this.invernaderoLinesItemsPerPage);
      if (this.invernaderoLinesCurrentPage > this.invernaderoLinesTotalPages && this.invernaderoLinesTotalPages > 0) this.invernaderoLinesCurrentPage = this.invernaderoLinesTotalPages;
      else if (this.invernaderoLinesTotalPages === 0 && this.allInvernaderoKeysForSelectedVariable.length > 0) this.invernaderoLinesCurrentPage = 1;
      else if (this.allInvernaderoKeysForSelectedVariable.length === 0) {this.invernaderoLinesCurrentPage = 1; this.invernaderoLinesTotalPages = 0;}

      this.displayLinesForCurrentPageOfInvernaderos();
    }
    
    else if (!isSpecificVariableFilter && isSpecificInvernaderoFilter) {
      
      const filteredDataForLocation = this.sensorData.filter(d => d.location === filters.location);
      const dataByVariable = this.groupDataBy(filteredDataForLocation, 'sensorType');
      const datasets: ChartDataset<'line', { x: number; y: number }[]>[] = [];

      Object.keys(dataByVariable).sort().forEach(variableKey => {
        const varData = dataByVariable[variableKey].sort((a, b) => a.timestamp - b.timestamp);
        if (varData.length > 0) {
          datasets.push({
            data: varData.map(p => ({ x: p.timestamp, y: p.value })),
            label: variableKey,
            borderColor: this.assignColor(variableKey, this.variableColorMap, 'variables'),
            backgroundColor: this.assignColor(variableKey, this.variableColorMap, 'variables') + '33', 
            fill: false,
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 5
          });
        }
      });
      this.singleLineChartData = datasets.length > 0 ? { datasets } : { datasets: [{ data: [], label: `No hay datos para ${filters.location}`}] };
    }
    
    else if (isSpecificVariableFilter && isSpecificInvernaderoFilter) {
      
      const specificData = this.sensorData.filter(d => d.sensorType === filters.sensorType && d.location === filters.location)
                                      .sort((a,b) => a.timestamp - b.timestamp);
      const dataPoints = specificData.map(p => ({ x: p.timestamp, y: p.value }));
      this.singleLineChartData = {
        datasets: [{
          data: dataPoints,
          label: `${filters.sensorType} (${filters.location})`,
          borderColor: this.assignColor(filters.sensorType!, this.variableColorMap, 'variables'),
          backgroundColor: this.assignColor(filters.sensorType!, this.variableColorMap, 'variables') + '33',
          fill: false,
          tension: 0.1,
          pointRadius: 2,
          pointHoverRadius: 5
        }]
      };
    }
    this.cdr.detectChanges();
  }

  displayChartsForCurrentPage(): void {
    if (!this.isMultiChartView || this.allLocationKeysForPaging.length === 0) {
      this.locationCharts = []; 
      this.cdr.detectChanges();
      return;
    }
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const keysForCurrentPage = this.allLocationKeysForPaging.slice(startIndex, endIndex);
    
    this.locationCharts = keysForCurrentPage.map(locationKey => {
      const locSpecificData = this.sensorData.filter(d => d.location === locationKey);
      const dataBySensorType = this.groupDataBy(locSpecificData, 'sensorType');
      const datasetsForLoc: ChartDataset<'line', { x: number; y: number }[]>[] = [];

      Object.keys(dataBySensorType).sort().forEach(sensorTypeKey => {
        const typeData = dataBySensorType[sensorTypeKey].sort((a,b) => a.timestamp - b.timestamp);
        if (typeData.length > 0) {
          datasetsForLoc.push({
            data: typeData.map(p => ({ x: p.timestamp, y: p.value })),
            label: sensorTypeKey,
            borderColor: this.assignColor(sensorTypeKey, this.variableColorMap, 'variables'),
            backgroundColor: this.assignColor(sensorTypeKey, this.variableColorMap, 'variables') + '33',
            fill: false, tension: 0.1, pointRadius: 2, pointHoverRadius: 5
          });
        }
      });
      
      return {
        locationName: locationKey,
        chartDataConfig: datasetsForLoc.length > 0 ? { datasets: datasetsForLoc } : { datasets: [{data:[], label:'No hay datos'}] },
        chartOptionsConfig: { ...this.commonLineChartOptions } 
      };
    });
    this.cdr.detectChanges();
  }

  displayLinesForCurrentPageOfInvernaderos(): void {
    if (!this.isSingleVariableAllInvernaderosView || this.allInvernaderoKeysForSelectedVariable.length === 0) {
      this.singleLineChartData = { datasets: [{ data: [], label: `No hay datos para ${this.filterVariableEntorno || 'la variable seleccionada'}` }] };
      this.cdr.detectChanges();
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
          data: invernaderoData.map(p => ({ x: p.timestamp, y: p.value })),
          label: `${invernaderoKey} (${this.filterVariableEntorno})`, 
          borderColor: this.assignColor(invernaderoKey, this.locationColorMap, 'locations'),
          backgroundColor: this.assignColor(invernaderoKey, this.locationColorMap, 'locations') + '33',
          fill: false, tension: 0.1, pointRadius: 2, pointHoverRadius: 5
        });
      }
    });

    if (datasets.length > 0) {
        this.singleLineChartData = { datasets };
    } else if (invernaderosForPage.length > 0) {
        this.singleLineChartData = { datasets: [{ data: [], label: `No hay datos para ${this.filterVariableEntorno} en los invernaderos de esta página.` }] };
    } else {
        this.singleLineChartData = { datasets: [{ data: [], label: `No hay más invernaderos para mostrar para ${this.filterVariableEntorno}` }] };
    }
    this.cdr.detectChanges();
  }

  
  nextPage(): void { if (this.currentPage < this.totalPages) { this.currentPage++; this.displayChartsForCurrentPage(); } }
  previousPage(): void { if (this.currentPage > 1) { this.currentPage--; this.displayChartsForCurrentPage(); } }
  goToPage(pageInput: Event | number): void {
    const pageNum = typeof pageInput === 'number' ? pageInput : parseInt((pageInput.target as HTMLSelectElement).value, 10);
    if (pageNum >= 1 && pageNum <= this.totalPages) { this.currentPage = pageNum; this.displayChartsForCurrentPage(); }
  }
  getPages(): number[] {
    const pagesArray: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) pagesArray.push(i);
    return pagesArray;
  }

  
  nextInvernaderoLinesPage(): void { if (this.invernaderoLinesCurrentPage < this.invernaderoLinesTotalPages) { this.invernaderoLinesCurrentPage++; this.displayLinesForCurrentPageOfInvernaderos(); } }
  previousInvernaderoLinesPage(): void { if (this.invernaderoLinesCurrentPage > 1) { this.invernaderoLinesCurrentPage--; this.displayLinesForCurrentPageOfInvernaderos(); } }
  goToInvernaderoLinesPage(pageInput: Event | number): void {
    const pageNum = typeof pageInput === 'number' ? pageInput : parseInt((pageInput.target as HTMLSelectElement).value, 10);
    if (pageNum >= 1 && pageNum <= this.invernaderoLinesTotalPages) { this.invernaderoLinesCurrentPage = pageNum; this.displayLinesForCurrentPageOfInvernaderos(); }
  }
  getInvernaderoLinesPages(): number[] {
    const pagesArray: number[] = [];
    for (let i = 1; i <= this.invernaderoLinesTotalPages; i++) pagesArray.push(i);
    return pagesArray;
  }

  async generatePdfReport(): Promise<void> {
    console.log('[Dashboard] Iniciando preparación de datos para el reporte PDF...');
    this.isLoading = true; 

    
    this.cdr.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 200)); 

    const capturedMultiChartImages: { locationName: string, imageData: string | null }[] = [];
    let capturedSingleChartImage: { chartLabel: string, imageData: string | null } | undefined = undefined;

    if (this.isMultiChartView && this.multiChartCanvases && this.locationCharts.length > 0) {
      const directivesArray = this.multiChartCanvases.toArray();
      console.log(`[Dashboard] Procesando ${directivesArray.length} directivas para gráficos múltiples.`);
      
      
      
      
      for (let i = 0; i < this.locationCharts.length; i++) {
        
        
        const locChartMeta = this.locationCharts[i];
        const directive = directivesArray.find((d, index) => {
          
          
          
          
          return i < directivesArray.length ? directivesArray[i] : undefined;
        });


        if (directive) {
          const imageData = await captureChartImage(directive, `Multi-Chart: ${locChartMeta.locationName}`, this.cdr);
          capturedMultiChartImages.push({ locationName: locChartMeta.locationName, imageData });
        } else {
          console.warn(`[Dashboard] No se encontró directiva para el gráfico múltiple: ${locChartMeta.locationName} (esperado en índice ${i} de directivas visibles)`);
          capturedMultiChartImages.push({ locationName: locChartMeta.locationName, imageData: null });
        }
      }
    } else if (!this.isMultiChartView && this.singleChartCanvas) {
      let chartLabel = 'Gráfico Filtrado'; 
      
      if (this.singleLineChartData.datasets && this.singleLineChartData.datasets.length > 0 && this.singleLineChartData.datasets[0].label) {
        chartLabel = this.singleLineChartData.datasets[0].label;
      } else if (this.isSingleVariableAllInvernaderosView && this.filterVariableEntorno) {
        chartLabel = `Variable: ${this.filterVariableEntorno}`;
      }
      
      const imageData = await captureChartImage(this.singleChartCanvas, `Single-Chart: ${chartLabel}`, this.cdr);
      capturedSingleChartImage = { chartLabel, imageData };
    }

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
      multiChartImages: this.isMultiChartView ? capturedMultiChartImages : undefined,
      
      singleChartImage: !this.isMultiChartView ? capturedSingleChartImage : undefined,
      singleChartLabel: (!this.isMultiChartView && capturedSingleChartImage) ? capturedSingleChartImage.chartLabel : 
                        (this.isSingleVariableAllInvernaderosView ? `Variable: ${this.filterVariableEntorno} (pág. ${this.invernaderoLinesCurrentPage}/${this.invernaderoLinesTotalPages})` : 'Gráfico Filtrado'),
      
      invernaderoLinesCurrentPage: this.isSingleVariableAllInvernaderosView ? this.invernaderoLinesCurrentPage : undefined,
      invernaderoLinesTotalPages: this.isSingleVariableAllInvernaderosView ? this.invernaderoLinesTotalPages : undefined,
      
      isTableVisible: this.isTableVisible,
      sensorDataForTable: this.sensorData
    };

    console.log('[Dashboard] ReportData construido con imágenes pre-capturadas. Llamando al servicio PDF...');
    
    const reportDataForLog = {
      ...reportData,
      multiChartImages: reportData.multiChartImages?.map(img => ({...img, imageData: img.imageData ? 'Presente' : 'Ausente'})),
      singleChartImage: reportData.singleChartImage ? {...reportData.singleChartImage, imageData: reportData.singleChartImage.imageData ? 'Presente' : 'Ausente'} : undefined
    }
    console.log('[Dashboard] ReportData (sin datos de imagen completos):', JSON.parse(JSON.stringify(reportDataForLog)));


    try {
      await this.pdfReportService.generateReport(reportData);
      console.log('[Dashboard] Solicitud de generación de PDF enviada al servicio y completada.');
    } catch (error) {
      console.error('[Dashboard] Error al llamar a generateReport del servicio PDF:', error);
      alert('Ocurrió un error al intentar generar el reporte PDF.');
    } finally {
      this.isLoading = false; 
    }
  }
}