import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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


  locationChartsData?: { locationName: string }[];
  multiChartImages?: { locationName: string, imageData: string | null }[];


  singleChartImage?: { chartLabel: string, imageData: string | null };
  singleChartLabel?: string;


  invernaderoLinesCurrentPage?: number;
  invernaderoLinesTotalPages?: number;


  isTableVisible: boolean;
  sensorDataForTable: SensorData[];
}

@Injectable({
  providedIn: 'root'
})
export class PdfReportService {

  constructor() { }

  private addPageFooter(doc: jsPDF, reportTimestamp: string, pageNumber: number, leftMargin: number, pageHeight: number): void {

  }


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

    yPosition = checkAndAddPage(10);
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

          yPosition = checkAndAddPage(5);
          doc.text(`Invernadero: ${locChartMeta.locationName}`, leftMargin, yPosition);
          yPosition += 5;

          if (chartImage) {
            const imgProps = doc.getImageProperties(chartImage);
            const aspectRatio = imgProps.width / imgProps.height;
            const imgWidth = usableWidth * 0.8;
            const imgHeight = imgWidth / aspectRatio;

            yPosition = checkAndAddPage(imgHeight + 10);
            if (yPosition + imgHeight > pageHeight - 20) {
              doc.addPage(); currentPageNumber++; yPosition = 15;
              this.addPageFooter(doc, reportTimestamp, currentPageNumber, leftMargin, pageHeight);
              doc.setFontSize(10);
              doc.text(`Invernadero: ${locChartMeta.locationName} (continuación)`, leftMargin, yPosition); yPosition += 5;
            }
            doc.addImage(chartImage, 'PNG', leftMargin + (usableWidth * 0.1), yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10;
            chartAddedToPdf = true;
          } else {
            yPosition = checkAndAddPage(10);
            doc.text(`Gráfico para Invernadero: ${locChartMeta.locationName} no pudo ser generado o no se proporcionó.`, leftMargin, yPosition);
            yPosition += 10;
            console.warn(`[PdfReportService] Imagen para ${locChartMeta.locationName} no disponible.`);
          }
        }
      } else if (!reportData.isMultiChartView && reportData.singleChartImage) {
        const chartLabel = reportData.singleChartLabel || 'Gráfico Filtrado';
        const chartImage = reportData.singleChartImage.imageData;

        yPosition = checkAndAddPage(5);
        doc.setFontSize(10);
        doc.text(chartLabel, leftMargin, yPosition);
        yPosition += 5;

        if (chartImage) {
          const imgProps = doc.getImageProperties(chartImage);
          const aspectRatio = imgProps.width / imgProps.height;
          const imgWidth = usableWidth * 0.8;
          const imgHeight = imgWidth / aspectRatio;

          yPosition = checkAndAddPage(imgHeight + 10);
          if (yPosition + imgHeight > pageHeight - 20) {
            doc.addPage(); currentPageNumber++; yPosition = 15;
            this.addPageFooter(doc, reportTimestamp, currentPageNumber, leftMargin, pageHeight);
            doc.setFontSize(10);
            doc.text(chartLabel + " (continuación)", leftMargin, yPosition); yPosition += 5;
          }
          doc.addImage(chartImage, 'PNG', leftMargin + (usableWidth * 0.1), yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
          chartAddedToPdf = true;
        } else {
          yPosition = checkAndAddPage(10);
          doc.text('Gráfico individual no pudo ser generado o no se proporcionó.', leftMargin, yPosition); yPosition += 5;
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
      yPosition += 10;
    }
    
    if (reportData.isTableVisible && reportData.sensorDataForTable.length > 0) {
      yPosition = checkAndAddPage(20);
      doc.setFontSize(12);
      doc.text('Tabla de Datos:', leftMargin, yPosition);

      const head = [['Invernadero', 'Variable Entorno', 'ID Sensor', 'Valor', 'Timestamp (UTC)']];
      const body = reportData.sensorDataForTable.map(d => [
        d.location,
        d.sensorType,
        d.sensorId || '-',
        d.value.toString(),
        new Date(d.timestamp).toISOString().substring(0, 19).replace('T', ' ') + 'Z'
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
      yPosition = (doc as any).lastAutoTable.finalY ? (doc as any).lastAutoTable.finalY + 10 : yPosition + 10;
    }


    const finalPageNumber = doc.getNumberOfPages();
    if (currentPageNumber < finalPageNumber || (!reportData.isTableVisible || reportData.sensorDataForTable.length === 0)) {

      for (let i = currentPageNumber; i <= finalPageNumber; i++) {
        doc.setPage(i);
        this.addPageFooter(doc, reportTimestamp, i, leftMargin, pageHeight);
      }
    }

    doc.save(`reporte_sensores_${new Date().toISOString().substring(0, 10)}.pdf`);
  }
}