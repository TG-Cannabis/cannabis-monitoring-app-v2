import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BaseChartDirective } from 'ng2-charts';
import { SensorData } from '../models/sensor-data.model';

export interface ReportData {
  filters: {
    variableEntorno: string;
    invernadero: string;
    startDate: string;
    endDate: string;
  };
  isMultiChartView: boolean;
  isSingleVariableAllInvernaderosView: boolean;

  // Datos para gráficos múltiples
  locationChartsData?: { locationName: string }[]; // Metadatos de los gráficos
  multiChartImages?: { locationName: string, imageData: string | null }[]; // NUEVO: Imágenes pre-renderizadas

  // Datos para gráfico único
  singleChartImage?: { chartLabel: string, imageData: string | null }; // NUEVO: Imagen pre-renderizada
  singleChartLabel?: string; // Metadatos del gráfico

  // Información de paginación (si aplica)
  invernaderoLinesCurrentPage?: number;
  invernaderoLinesTotalPages?: number;

  // Datos de la tabla
  isTableVisible: boolean;
  sensorDataForTable: SensorData[];
}

// src/app/core/services/pdf-report.service.ts

@Injectable({
  providedIn: 'root'
})
export class PdfReportService {

  constructor() { }

  private addPageFooter(doc: jsPDF, reportTimestamp: string, pageNumber: number, leftMargin: number, pageHeight: number): void {
    // ... (sin cambios)
  }

  // La función attemptChartImage (o una similar) ahora viviría en DashboardComponent
  // o se llamaría desde allí para preparar los datos.
  // Ya no se usaría directamente dentro de generateReport de la misma manera.

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
    let currentPageNumber = 1;

    const checkAndAddPage = (spaceNeeded: number): number => {
      // ... (sin cambios)
      if (yPosition + spaceNeeded > pageHeight - 20) {
        doc.addPage();
        currentPageNumber++;
        yPosition = 15;
        this.addPageFooter(doc, reportTimestamp, currentPageNumber, leftMargin, pageHeight);
      }
      return yPosition;
    };
    
    doc.setFontSize(18);
    doc.text('Reporte de Sensores', doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // ... (Lógica para imprimir filtros - sin cambios) ...
    doc.setFontSize(10);
    yPosition += 7;
    doc.text('Filtros Aplicados:', leftMargin, yPosition);
    yPosition += 5;
    let filterText = `  Variable de Entorno: ${reportData.filters.variableEntorno || 'Todas'}\n`;
    filterText += `  Invernadero: ${reportData.filters.invernadero || 'Todos'}\n`;
    const startDateString = reportData.filters.startDate 
      ? new Date(reportData.filters.startDate).toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) 
      : 'N/A';
    const endDateString = reportData.filters.endDate 
      ? new Date(reportData.filters.endDate).toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) 
      : 'N/A';
    filterText += `  Fecha Inicio: ${startDateString}\n`;
    filterText += `  Fecha Fin: ${endDateString}`;
    
    const splitFilters = doc.splitTextToSize(filterText, usableWidth);
    doc.text(splitFilters, leftMargin, yPosition);
    yPosition += (splitFilters.length * 4) + 5; 

    yPosition = checkAndAddPage(10); // Espacio antes de la sección de gráficos
    doc.setFontSize(12);
    doc.text('Gráfico(s):', leftMargin, yPosition);
    yPosition += 7;

    let chartAddedToPdf = false;
    try {
      if (reportData.isMultiChartView && reportData.locationChartsData && reportData.multiChartImages) {
        doc.setFontSize(10);
        for (let i = 0; i < reportData.locationChartsData.length; i++) {
          const locChartMeta = reportData.locationChartsData[i];
          const chartImageObj = reportData.multiChartImages.find(img => img.locationName === locChartMeta.locationName);
          const chartImage = chartImageObj ? chartImageObj.imageData : null;
          
          yPosition = checkAndAddPage(5); // Espacio para el título del gráfico
          doc.text(`Invernadero: ${locChartMeta.locationName}`, leftMargin, yPosition);
          yPosition += 5;

          if (chartImage) {
            const imgProps = doc.getImageProperties(chartImage);
            const aspectRatio = imgProps.width / imgProps.height;
            const imgWidth = usableWidth * 0.8; 
            const imgHeight = imgWidth / aspectRatio;
            
            yPosition = checkAndAddPage(imgHeight + 10); // Espacio para la imagen y un margen inferior
            if (yPosition + imgHeight > pageHeight - 20 ) { // Comprobación redundante si checkAndAddPage funciona bien, pero segura
               doc.addPage(); currentPageNumber++; yPosition = 15;
               this.addPageFooter(doc, reportTimestamp, currentPageNumber, leftMargin, pageHeight);
               doc.setFontSize(10);
               doc.text(`Invernadero: ${locChartMeta.locationName} (continuación)`, leftMargin, yPosition); yPosition +=5;
            }
            doc.addImage(chartImage, 'PNG', leftMargin + (usableWidth * 0.1), yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10; 
            chartAddedToPdf = true;
          } else {
            yPosition = checkAndAddPage(10); // Espacio para el mensaje de error
            doc.text(`Gráfico para Invernadero: ${locChartMeta.locationName} no pudo ser generado o no se proporcionó.`, leftMargin, yPosition);
            yPosition += 10;
            console.warn(`[PdfReportService] Imagen para ${locChartMeta.locationName} no disponible.`);
          }
        }
      } else if (!reportData.isMultiChartView && reportData.singleChartImage) {
        const chartLabel = reportData.singleChartLabel || 'Gráfico Filtrado';
        const chartImage = reportData.singleChartImage.imageData;

        yPosition = checkAndAddPage(5); // Espacio para el título
        doc.setFontSize(10);
        doc.text(chartLabel, leftMargin, yPosition);
        yPosition += 5;
        
        if (chartImage) {
          const imgProps = doc.getImageProperties(chartImage);
          const aspectRatio = imgProps.width / imgProps.height;
          const imgWidth = usableWidth * 0.8; 
          const imgHeight = imgWidth / aspectRatio;

          yPosition = checkAndAddPage(imgHeight + 10); // Espacio para la imagen y margen
          if (yPosition + imgHeight > pageHeight - 20) { 
             doc.addPage(); currentPageNumber++; yPosition = 15;
             this.addPageFooter(doc, reportTimestamp, currentPageNumber, leftMargin, pageHeight);
             doc.setFontSize(10);
             doc.text(chartLabel + " (continuación)", leftMargin, yPosition); yPosition +=5;
          }
          doc.addImage(chartImage, 'PNG', leftMargin + (usableWidth * 0.1), yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
          chartAddedToPdf = true;
        } else {
           yPosition = checkAndAddPage(10); // Espacio para mensaje de error
           doc.text('Gráfico individual no pudo ser generado o no se proporcionó.', leftMargin, yPosition); yPosition +=5;
           console.warn(`[PdfReportService] Imagen para gráfico individual (${chartLabel}) no disponible.`);
        }
      } 
      
      if (!chartAddedToPdf && (!reportData.isMultiChartView || !reportData.multiChartImages || reportData.multiChartImages.every(img => !img.imageData))) {
        yPosition = checkAndAddPage(10);
        doc.setFontSize(10);
        doc.text('No hay gráficos para mostrar o no pudieron ser generados.', leftMargin, yPosition);
        yPosition += 10;
      }
    } catch (e) {
      console.error("[PDF Service] Error excepcional al procesar datos de gráficos para PDF:", e);
      yPosition = checkAndAddPage(10);
      doc.text('Error excepcional al añadir imágenes de los gráficos al PDF.', leftMargin, yPosition);
      yPosition +=10;
    }

    // ... (Lógica para la tabla de datos y pie de página - sin cambios significativos,
    // pero asegúrate de que yPosition se actualice correctamente después de autoTable) ...
    if (reportData.isTableVisible && reportData.sensorDataForTable.length > 0) {
        yPosition = checkAndAddPage(20); // Asegurar espacio para el título de la tabla
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
              this.addPageFooter(doc, reportTimestamp, data.pageNumber, leftMargin, pageHeight);
              currentPageNumber = data.pageNumber; 
          }
        });
        yPosition = (doc as any).lastAutoTable.finalY ? (doc as any).lastAutoTable.finalY + 10 : yPosition + 10; // Actualizar yPosition
      }
      
      // Asegurar que el pie de página final se añada correctamente
      const finalPageNumber = doc.getNumberOfPages();
      if (currentPageNumber < finalPageNumber || (!reportData.isTableVisible || reportData.sensorDataForTable.length === 0)) {
        // Si autoTable no añadió una nueva página que ya tiene footer, o no hay tabla
        for (let i = currentPageNumber; i <= finalPageNumber; i++) {
            doc.setPage(i);
            this.addPageFooter(doc, reportTimestamp, i, leftMargin, pageHeight);
        }
      }

    doc.save(`reporte_sensores_${new Date().toISOString().substring(0,10)}.pdf`);
  }
}