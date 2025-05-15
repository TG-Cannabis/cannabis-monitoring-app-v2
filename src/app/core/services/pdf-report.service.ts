import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BaseChartDirective } from 'ng2-charts'; // Para tipar los gráficos
import { SensorData } from '../models/sensor-data.model'; // Asumiendo que el modelo está aquí
import { ApiFilters } from './sensor-data.service'; // Para los filtros

// Interfaz para los datos que el servicio necesita del componente
export interface ReportData {
  filters: {
    variableEntorno: string;
    invernadero: string;
    startDate: string;
    endDate: string;
  };
  isMultiChartView: boolean;
  isSingleVariableAllInvernaderosView: boolean;
  // Para gráficos múltiples
  locationChartsData?: { // Usamos el nombre del tipo que ya tenías en el componente
    locationName: string;
    // No necesitamos chartDataConfig ni chartOptionsConfig, solo la directiva para la imagen
  }[]; 
  multiChartDirectives?: BaseChartDirective[]; // Array de directivas BaseChart
  // Para gráfico único
  singleChartDirective?: BaseChartDirective;
  singleChartLabel?: string; // Para el título del gráfico único si es relevante
  // Paginación de líneas de invernadero (si aplica al gráfico único)
  invernaderoLinesCurrentPage?: number;
  invernaderoLinesTotalPages?: number;
  // Datos de la tabla
  isTableVisible: boolean;
  sensorDataForTable: SensorData[];
}


@Injectable({
  providedIn: 'root'
})
export class PdfReportService {

  constructor() { }

  public async generateReport(reportData: ReportData): Promise<void> {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const reportTimestamp = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    let yPosition = 15;
    const pageHeight = doc.internal.pageSize.height;
    const leftMargin = 15;
    const usableWidth = doc.internal.pageSize.width - (2 * leftMargin);

    const checkAndAddPage = (spaceNeeded: number) => {
      if (yPosition + spaceNeeded > pageHeight - 20) {
        doc.addPage();
        yPosition = 15;
        this.addFooter(doc, reportTimestamp, leftMargin, pageHeight);
      }
    };

    this.addHeader(doc, yPosition, reportTimestamp);
    yPosition += 10;

    this.addFiltersInfo(doc, reportData.filters, yPosition, leftMargin, usableWidth);
    const filterTextLines = doc.splitTextToSize('', usableWidth).length; // Estimar líneas usadas
    yPosition += (filterTextLines * 4) + 12; // Ajuste un poco mayor para el texto de filtros

    checkAndAddPage(10); // Espacio antes de la sección de gráficos
    doc.setFontSize(12);
    doc.text('Gráfico(s):', leftMargin, yPosition);
    yPosition += 7;

    let chartAddedToPdf = false;
    try {
      if (reportData.isMultiChartView && reportData.locationChartsData && reportData.multiChartDirectives && reportData.locationChartsData.length > 0) {
        chartAddedToPdf = await this.addMultiChartsToPdf(doc, reportData.locationChartsData, reportData.multiChartDirectives, yPosition, checkAndAddPage, leftMargin, usableWidth, pageHeight, reportTimestamp);
        // yPosition se actualizará dentro de addMultiChartsToPdf si es necesario pasar su estado final
      } else if (!reportData.isMultiChartView && reportData.singleChartDirective?.chart?.ctx) {
        chartAddedToPdf = await this.addSingleChartToPdf(doc, reportData, yPosition, checkAndAddPage, leftMargin, usableWidth, pageHeight, reportTimestamp);
      }

      if (!chartAddedToPdf) {
        doc.setFontSize(10);
        checkAndAddPage(10);
        doc.text('No hay gráficos para mostrar o no pudieron ser generados.', leftMargin, yPosition);
        yPosition += 10;
      }
    } catch (e) {
      console.error("[PDF Service] Error al procesar gráficos para PDF:", e);
      checkAndAddPage(10);
      doc.text('Error al generar imágenes de los gráficos.', leftMargin, yPosition);
      yPosition += 10;
    }
    
    // La yPosition final después de los gráficos la manejan las funciones addCharts...
    // Necesitamos una forma de obtener la yPosition actualizada si las funciones de gráficos la modifican y la retornan.
    // Por ahora, asumimos que autoTable comenzará después del último gráfico o mensaje.
    // Este es un punto a refinar: cómo fluye yPosition entre funciones asíncronas.
    // Solución simple: las funciones de añadir gráficos devuelven la nueva yPosition.

    // Este yPosition necesita ser el yPosition después de que los gráficos se hayan añadido.
    // Haremos que las funciones de añadir gráficos devuelvan la nueva yPosition.
    // Este es un ejemplo, necesitarías implementar el retorno de yPosition en las funciones de gráficos.
    // yPosition = newYPositionAfterCharts; 


    if (reportData.isTableVisible && reportData.sensorDataForTable.length > 0) {
      // Se necesita recalcular yPosition si los gráficos ocuparon mucho espacio o múltiples páginas
      // Por simplicidad, si hay gráficos, la tabla irá en una nueva página o después de un espacio.
      if (chartAddedToPdf) { // Si se añadió algún gráfico, asegurar espacio o nueva página
          if (yPosition > 60) { // Si los gráficos dejaron poco espacio
             checkAndAddPage(pageHeight); // Forzar nueva página si es necesario
          } else {
             yPosition += 10; // Espacio después de los gráficos
          }
      }


      checkAndAddPage(20); 
      doc.setFontSize(12);
      doc.text('Tabla de Datos:', leftMargin, yPosition);
      
      const head = [['Invernadero', 'Variable Entorno', 'ID Sensor', 'Valor', 'Timestamp (UTC)']];
      const body = reportData.sensorDataForTable.map(d => [
        d.location,
        d.sensorType,
        d.sensorId || '-',
        d.value.toString(),
        new Date(d.timestamp).toISOString().substring(0,19).replace('T', ' ') + 'Z'
      ]);

      autoTable(doc, {
        head: head,
        body: body,
        startY: yPosition + 7, 
        margin: { left: leftMargin, right: leftMargin },
        theme: 'striped', 
        didDrawPage: (data) => { 
            this.addFooter(doc, reportTimestamp, leftMargin, pageHeight, data.pageNumber);
        }
      });
      yPosition = (doc as any).lastAutoTable.finalY ? (doc as any).lastAutoTable.finalY + 10 : yPosition + 10;
    }

    // Asegurar pie de página en la última página si no fue añadido por autoTable
    const finalPageNum = doc.getNumberOfPages();
    const autoTableLastPg = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.pageNumber : 0;
    if (!((doc as any).lastAutoTable && autoTableLastPg === finalPageNum) || (!reportData.isTableVisible || reportData.sensorDataForTable.length === 0) ) {
        doc.setPage(finalPageNum); 
        this.addFooter(doc, reportTimestamp, leftMargin, pageHeight, finalPageNum);
    }

    doc.save(`reporte_sensores_${new Date().toISOString().substring(0,10)}.pdf`);
  }

  private addHeader(doc: jsPDF, yPosition: number, reportTimestamp: string): void {
    doc.setFontSize(18);
    doc.text('Reporte de Sensores', doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
  }

  private addFooter(doc: jsPDF, reportTimestamp: string, leftMargin: number, pageHeight: number, pageNum?: number): void {
    const pageNumber = pageNum || doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.text(`Reporte generado: ${reportTimestamp} - Página ${pageNumber}`, leftMargin, pageHeight - 10);
  }
  
  private addFiltersInfo(doc: jsPDF, filters: ReportData['filters'], yPosition: number, leftMargin: number, usableWidth: number): number {
    doc.setFontSize(10);
    doc.text('Filtros Aplicados:', leftMargin, yPosition);
    yPosition += 5;
    let filterText = `  Variable de Entorno: ${filters.variableEntorno || 'Todas'}\n`;
    filterText += `  Invernadero: ${filters.invernadero || 'Todos'}\n`;
    const startDateString = filters.startDate 
      ? new Date(filters.startDate).toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) 
      : 'N/A';
    const endDateString = filters.endDate 
      ? new Date(filters.endDate).toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) 
      : 'N/A';
    filterText += `  Fecha Inicio: ${startDateString}\n`;
    filterText += `  Fecha Fin: ${endDateString}`;
    
    const splitFilters = doc.splitTextToSize(filterText, usableWidth);
    doc.text(splitFilters, leftMargin, yPosition);
    return yPosition + (splitFilters.length * 4); // Retorna la nueva yPosition
  }

  private async addSingleChartToPdf(
    doc: jsPDF, 
    reportData: ReportData,
    yPos: number, 
    checkAndAddPage: (spaceNeeded: number) => void,
    leftMargin: number, 
    usableWidth: number,
    pageHeight: number,
    reportTimestamp: string
  ): Promise<boolean> {
    let currentY = yPos;
    if (reportData.singleChartDirective?.chart?.ctx) {
      console.log('[PDF Service] Single Chart View - Canvas and chart object (with ctx) found.');
      checkAndAddPage(80); // Espacio para título + gráfico
      if (reportData.isSingleVariableAllInvernaderosView) {
          doc.setFontSize(10);
          doc.text(`Variable: ${reportData.filters.variableEntorno} (Invernaderos pág. ${reportData.invernaderoLinesCurrentPage}/${reportData.invernaderoLinesTotalPages})`, leftMargin, currentY);
          currentY += 5;
      } else if (reportData.singleChartLabel) {
          doc.setFontSize(10);
          doc.text(reportData.singleChartLabel, leftMargin, currentY);
          currentY +=5;
      }

      // Intentar forzar actualización del gráfico
      try {
        reportData.singleChartDirective.chart.update('none');
        await new Promise(resolve => setTimeout(resolve, 50)); // Pequeña pausa
      } catch(e) { console.error("Error updating single chart for PDF:", e); }


      if (!reportData.singleChartDirective.chart.ctx) { // Re-check ctx
          console.warn('[PDF Service] Single chart ctx became undefined after update attempt.');
          doc.text('Contexto del gráfico individual no disponible tras actualización.', leftMargin, currentY);
          return false;
      }

      const chartImage = reportData.singleChartDirective.chart.toBase64Image();
      if (chartImage) {
        const imgProps = doc.getImageProperties(chartImage);
        const aspectRatio = imgProps.width / imgProps.height;
        const imgWidth = usableWidth * 0.8; 
        const imgHeight = imgWidth / aspectRatio;

        if (currentY + imgHeight > pageHeight - 20) { 
           doc.addPage(); currentY = 15;
           this.addFooter(doc, reportTimestamp, leftMargin, pageHeight); // Añadir pie de página a la nueva página
           // Podrías re-añadir título del gráfico si se corta
        }
        doc.addImage(chartImage, 'PNG', leftMargin + (usableWidth * 0.1), currentY, imgWidth, imgHeight);
        // yPosition = currentY + imgHeight + 10; // Actualizar yPosition global si es necesario
        return true;
      } else {
         console.error('[PDF Service] Failed to get base64 image for single chart.');
         doc.text('Error al generar imagen para el gráfico individual.', leftMargin, currentY);
         return false;
      }
    }
    return false;
  }

  private async addMultiChartsToPdf(
    doc: jsPDF, 
    locationChartsData: ReportData['locationChartsData'],
    multiChartDirectives: BaseChartDirective[],
    yPos: number,
    checkAndAddPage: (spaceNeeded: number) => void,
    leftMargin: number, 
    usableWidth: number,
    pageHeight: number,
    reportTimestamp: string
  ): Promise<boolean> {
    let currentY = yPos;
    let chartsAdded = false;
    if (!locationChartsData || !multiChartDirectives) return false;

    for (let i = 0; i < locationChartsData.length; i++) {
      const locChartMeta = locationChartsData[i];
      const chartDirective = multiChartDirectives[i]; 

      console.log(`[PDF Service] Processing Invernadero for PDF: ${locChartMeta.locationName} (index ${i})`);
      
      if (chartDirective && chartDirective.chart) {
        try {
          chartDirective.chart.update('none');
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) { console.error(`Error updating chart ${locChartMeta.locationName}`, e); }

        if (chartDirective.chart.ctx) {
          console.log(`  [PDF Service] Chart ctx IS defined for ${locChartMeta.locationName}.`);
          checkAndAddPage(80); // Espacio para título + gráfico
          doc.setFontSize(10);
          doc.text(`Invernadero: ${locChartMeta.locationName}`, leftMargin, currentY);
          currentY += 5;
          const chartImage = chartDirective.chart.toBase64Image();
          if (chartImage) {
            const imgProps = doc.getImageProperties(chartImage);
            const aspectRatio = imgProps.width / imgProps.height;
            const imgWidth = usableWidth * 0.8; 
            const imgHeight = imgWidth / aspectRatio;

            if (currentY + imgHeight > pageHeight - 20) { 
               doc.addPage(); currentY = 15;
               this.addFooter(doc, reportTimestamp, leftMargin, pageHeight);
               doc.setFontSize(10);
               doc.text(`Invernadero: ${locChartMeta.locationName} (continuación)`, leftMargin, currentY); currentY +=5;
            }
            doc.addImage(chartImage, 'PNG', leftMargin + (usableWidth * 0.1), currentY, imgWidth, imgHeight);
            currentY += imgHeight + 10; 
            chartsAdded = true;
          } else {
            console.error(`  [PDF Service] Failed to get base64 image for chart: ${locChartMeta.locationName}`);
            checkAndAddPage(10);
            doc.text(`Error al generar imagen para ${locChartMeta.locationName}`, leftMargin, currentY); currentY +=5;
          }
        } else {
          console.warn(`  [PDF Service] Chart.ctx is UNDEFINED for ${locChartMeta.locationName} after update/pause.`);
          checkAndAddPage(10);
          doc.text(`Gráfico para Invernadero: ${locChartMeta.locationName} no pudo ser inicializado (sin ctx).`, leftMargin, currentY);
          currentY += 10;
        }
      } else {
        console.warn(`  [PDF Service] Directive or chart object not found for ${locChartMeta.locationName} at index ${i}.`);
        checkAndAddPage(10);
        doc.text(`Directiva de gráfico no encontrada para ${locChartMeta.locationName}.`, leftMargin, currentY);
        currentY += 10;
      }
    }
    return chartsAdded;
  }
}