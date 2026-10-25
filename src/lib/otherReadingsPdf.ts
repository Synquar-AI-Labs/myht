import type { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { otherReadings } from './otherReadings';

export function appendOtherReadings(doc: jsPDF, readings: ReturnType<typeof otherReadings>) {
  if (!readings.rows.length) return;
  const finalY = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 14;
  let startY = finalY()+8;
  if (startY > doc.internal.pageSize.getHeight()-25) { doc.addPage(); startY=14; }
  autoTable(doc, { startY, head:[['Other readings']], body:readings.summaries.map(line=>[line]), theme:'plain',
    margin:14, headStyles:{fontSize:13,textColor:20}, styles:{fontSize:9,cellPadding:2,overflow:'linebreak'} });
  autoTable(doc, { startY:finalY()+4, head:[['Date','Time','Reading','Value + unit','Recorded by']], body:readings.rows,
    margin:14, theme:'grid', headStyles:{fillColor:[80,80,80],fontSize:9}, styles:{fontSize:8,cellPadding:2,overflow:'linebreak'} });
}
