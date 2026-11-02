/**
 * PDF-отчёт по техническому расчёту мезонина.
 * Генерирует отчёт в формате PDF на клиенте через jsPDF.
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { t } from '../../i18n';

interface MezzanineReportData {
  region: string;
  city: string;
  loadCapacity: number;        // т/м²
  fireResistance: string;      // R15..R240
  ceilingHeight: number;       // м
  tiers: number;               // ярусов
  aupPerTier: boolean;         // АУП каждого яруса
  nonCombustible: boolean;     // негорючие материалы
  compliant: boolean;          // соответствует нормативам
  issues: string[];            // нарушения
  recommendations: string[];   // рекомендации
  stuRequired: boolean;        // СТУ требуется
  generatedAt: string;
}

function formatFireClass(value: string): string {
  const labels: Record<string, string> = {
    R15: 'R15 (15 мин)',
    R30: 'R30 (30 мин)',
    R60: 'R60 (1 час)',
    R90: 'R90 (1,5 ч)',
    R120: 'R120 (2 ч)',
    R150: 'R150 (2,5 ч)',
    R180: 'R180 (3 ч)',
    R240: 'R240 (4 ч)'
  };
  return labels[value] || value;
}

export function generateMezzanineReport(data: MezzanineReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  // Header
  doc.setFillColor(2, 6, 23);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(t('report.title'), margin, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 200, 210);
  doc.text('Эмпориум — автоматизированное управление складом', margin, 22);
  doc.text(`Дата генерации: ${data.generatedAt}`, pageWidth - margin - 60, 22);

  y = 45;

  // Project info
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(t('report.object'), margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 70, 80);
  doc.text(`Регион: ${data.region}`, margin, y);
  doc.text(`Город: ${data.city}`, margin + 55, y);
  y += 6;
  doc.text(`Дата расчёта: ${new Date().toLocaleDateString('ru-RU')}`, margin, y);
  y += 10;

  // Calculation parameters table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(t('report.params'), margin, y);
  y += 7;

  (doc as any).autoTable({
    startY: y,
    head: [['Параметр', 'Значение', 'Норма']],
    body: [
      [t('report.load'), `${data.loadCapacity} т/м²`, '3–8 т/м²'],
      [t('report.fire'), formatFireClass(data.fireResistance), 'не ниже R30'],
      [t('report.height'), `${data.ceilingHeight} м`, '4–14 м'],
      [t('report.tiers'), String(data.tiers), '1–10'],
      [t('report.aup'), data.aupPerTier ? 'Да' : 'Нет', 'Требуется при >1 яруса'],
      [t('report.materials'), data.nonCombustible ? 'Да' : 'Нет', 'Обязательно']
    ],
    theme: 'grid',
    headStyles: { fillColor: [2, 6, 23], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [60, 70, 80] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: margin, right: margin }
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Compliance result
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(
    data.compliant ? 16 : 251,
    data.compliant ? 185 : 191,
    data.compliant ? 129 : 36
  );
  doc.text(
    data.compliant ? t('report.compliant') : t('report.noncompliant'),
    margin,
    y
  );
  y += 8;

  if (data.stuRequired) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(t('report.stu'), margin, y);
    y += 6;
  }

  // Issues
  if (data.issues.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text(t('report.issues'), margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 70, 80);
    data.issues.forEach(issue => {
      doc.text(`• ${issue}`, margin + 2, y);
      y += 5;
    });
    y += 4;
  }

  // Recommendations
  if (data.recommendations.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text(t('report.recommendations'), margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 70, 80);
    data.recommendations.forEach(rec => {
      doc.text(`• ${rec}`, margin + 2, y);
      y += 5;
    });
    y += 8;
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    t('report.footer'),
    margin,
    pageWidth > 0 ? doc.internal.pageSize.getHeight() - 10 : 287
  );

  const fileName = `мезонин_отчёт_${data.region}_${data.city}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
