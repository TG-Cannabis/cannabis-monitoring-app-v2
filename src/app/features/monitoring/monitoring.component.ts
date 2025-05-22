import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { MonitoringService, SensorMessage, AlertMessage, ConnectionState } from '../../core/services/monitoring.service';
import { SensorDataService, AvailableTags } from '../../core/services/sensor-data.service';

import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType, ChartDataset } from 'chart.js';
import 'chartjs-adapter-date-fns'; 

interface ChartPoint { x: number; y: number; originalTimestamp?: string; }

@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [ CommonModule, DatePipe, FormsModule, BaseChartDirective ],
  templateUrl: './monitoring.component.html',
  styleUrls: ['./monitoring.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonitoringComponent implements OnInit, OnDestroy, AfterViewInit {
  private monitoringService = inject(MonitoringService);
  private sensorDataService = inject(SensorDataService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  private allSensorMessages: SensorMessage[] = [];
  textSensorMessages: SensorMessage[] = [];
  alertMessages: AlertMessage[] = [];

  connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  ConnectionStateEnum = ConnectionState; 

  private subscriptions = new Subscription();
  private readonly MAX_TEXT_MESSAGES_DISPLAY = 20;
  private readonly MAX_CHART_POINTS_PER_SERIES = 120; 
  filterVariableEntorno: string = '';
  filterInvernadero: string = '';
  filterStartDate: string = ''; 
  filterEndDate: string = '';   

  availableVariablesEntorno: string[] = [];
  availableInvernaderos: string[] = [];
  isLoadingTags = false;
  tagsError: string | null = null;

  public sensorLineChartData: ChartConfiguration<'line'>['data'] = {
    datasets: [],
    labels: []
  };

  public sensorLineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, 
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          tooltipFormat: 'HH:mm:ss dd/MM/yyyy',
          displayFormats: { second: 'HH:mm:ss', minute: 'HH:mm', hour: 'HH:mm dd/MM' }
        },
        title: { display: true, text: 'Tiempo' }
      },
      y: {
        beginAtZero: false, 
        title: { display: true, text: 'Valor del Sensor' }
      }
    },
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: { mode: 'index', intersect: false }
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
  };
  public sensorLineChartType: 'line' = 'line'; // Tipo de gráfico explícito

  private initialConnectionAttemptMade = false;
  private colorMap: { [key: string]: string } = {};
  private colorIndex = 0;
  private baseChartColors: string[] = [
    '#3e95cd', '#8e5ea2', '#3cba9f', '#e8c3b9', '#c45850',
    '#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0',
    '#007bff', '#6610f2', '#6f42c1', '#e83e8c', '#dc3545'
  ];

  constructor() {
  }

  ngOnInit(): void {
    this.loadFilterOptions();

    this.subscriptions.add(
      this.monitoringService.getConnectionState().subscribe(state => {
        this.connectionState = state;
        if (!this.initialConnectionAttemptMade &&
            (state === ConnectionState.DISCONNECTED || state === ConnectionState.ERROR)) {
          this.monitoringService.activate();
          this.initialConnectionAttemptMade = true;
        }
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.monitoringService.sensorData$.subscribe(message => {
        this.allSensorMessages.push(message);
        
        this.processAndDisplayData();
      })
    );

    this.subscriptions.add(
      this.monitoringService.alerts$.subscribe(message => {
        this.alertMessages = [message, ...this.alertMessages].slice(0, this.MAX_TEXT_MESSAGES_DISPLAY);
        this.cdr.markForCheck();
      })
    );

    if (!this.initialConnectionAttemptMade) {
        const currentServiceState = this.monitoringService.getCurrentConnectionState();
        if (currentServiceState === ConnectionState.DISCONNECTED || currentServiceState === ConnectionState.ERROR) {
            this.monitoringService.activate();
            this.initialConnectionAttemptMade = true;
        } else if (currentServiceState === ConnectionState.CONNECTED) {
            this.initialConnectionAttemptMade = true;
        }
    }
  }

  ngAfterViewInit(): void {
    if (this.chart) {
      console.log('[MonitoringComponent] Chart directive disponible en ngAfterViewInit.');
      this.processAndDisplayData();
    } else {
      console.warn('[MonitoringComponent] Chart directive NO disponible en ngAfterViewInit.');
    }
  }

  loadFilterOptions(): void {
    this.isLoadingTags = true;
    this.tagsError = null;
    this.sensorDataService.getAvailableTags()
      .pipe(finalize(() => {
        this.isLoadingTags = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (tags: AvailableTags) => {
          this.availableVariablesEntorno = tags.sensorTypes || [];
          this.availableInvernaderos = tags.locations || [];
        },
        error: (err) => {
          this.tagsError = `Error al cargar opciones de filtro: ${err.message || err}`;
        }
      });
  }

  applyFilters(): void {
    console.log('Filtros aplicados en monitoreo:', {
      variable: this.filterVariableEntorno,
      invernadero: this.filterInvernadero,
      startDate: this.filterStartDate,
      endDate: this.filterEndDate,
    });
    this.processAndDisplayData();
  }

  clearFilters(): void {
    this.filterVariableEntorno = '';
    this.filterInvernadero = '';
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.colorMap = {}; // Resetear colores si se limpian filtros para reasignarlos
    this.colorIndex = 0;
    this.processAndDisplayData();
  }



  private matchesFilters(message: SensorMessage): boolean {
    if (this.filterVariableEntorno && message.sensorType !== this.filterVariableEntorno) {
      return false;
    }
    if (this.filterInvernadero && message.location !== this.filterInvernadero) {
      return false;
    }
    const messageTime = new Date(message.timestamp).getTime();
    if (this.filterStartDate && messageTime < new Date(this.filterStartDate).getTime()) {
      return false;
    }
    if (this.filterEndDate && messageTime > new Date(this.filterEndDate).getTime()) {
      return false;
    }
    return true;
  }

  private processAndDisplayData(): void {
    const filteredMessages = this.allSensorMessages.filter(msg => this.matchesFilters(msg));

    this.textSensorMessages = [...filteredMessages]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, this.MAX_TEXT_MESSAGES_DISPLAY);

    const datasetsMap: { [key: string]: ChartPoint[] } = {};
    filteredMessages.forEach(msg => {
      const seriesKey = `${msg.location || 'N/A'}-${msg.sensorType || 'N/A'}-${msg.sensorId || 'N/A'}`;
      if (!datasetsMap[seriesKey]) {
        datasetsMap[seriesKey] = [];
      }
      datasetsMap[seriesKey].push({
        x: new Date(msg.timestamp).getTime(),
        y: msg.value,
        originalTimestamp: msg.timestamp
      });
    });

    const newChartDatasets: ChartDataset<'line', ChartPoint[]>[] = [];
    Object.keys(datasetsMap).sort().forEach(seriesKey => {
      const sortedPoints = datasetsMap[seriesKey].sort((a, b) => a.x - b.x);
      const pointsForChart = sortedPoints.slice(-this.MAX_CHART_POINTS_PER_SERIES);

      if (pointsForChart.length > 0) { // Solo añadir series con datos
        const color = this.getSeriesColor(seriesKey);
        newChartDatasets.push({
          data: pointsForChart,
          label: seriesKey,
          borderColor: color,
          backgroundColor: color + '33',
          fill: false,
          tension: 0.2,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 1.5
        });
      }
    });

    this.sensorLineChartData.datasets = newChartDatasets; // Cambio de referencia

    if (this.chart && this.chart.chart) {
      this.chart.update('none');
    }
    this.cdr.markForCheck();
  }

  private getSeriesColor(seriesKey: string): string {
    if (!this.colorMap[seriesKey]) {
      this.colorMap[seriesKey] = this.baseChartColors[this.colorIndex % this.baseChartColors.length];
      this.colorIndex++;
    }
    return this.colorMap[seriesKey];
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    // El servicio MonitoringService se encarga de su propia limpieza si es un singleton.
  }

  attemptReconnect(): void {
    this.monitoringService.activate();
  }
}