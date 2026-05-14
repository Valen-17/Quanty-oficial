import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Quote } from "@/stores/quotesStore";
import { fmtCOP, fmtDate } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export function downloadQuotePdf(quote: Quote) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;

  // Brand strip
  doc.setFillColor(94, 53, 177); // primary-ish purple
  doc.rect(0, 0, pageWidth, 6, "F");

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(94, 53, 177);
  doc.text("COTIZACION", margin, 48);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text(quote.folio, margin, 72);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Fecha: ${fmtDate.format(quote.createdAt)}`, margin, 88);
  doc.text(`Estado: ${STATUS_LABEL[quote.status] ?? quote.status}`, margin, 100);

  // Brand block (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("Quanty", pageWidth - margin, 60, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("Insumos & Cotizaciones", pageWidth - margin, 74, { align: "right" });

  // Client
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, 118, pageWidth - margin, 118);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("CLIENTE", margin, 138);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(quote.clientName, margin, 156);

  // Items table
  autoTable(doc, {
    startY: 180,
    head: [["Insumo", "Cant.", "P. Unit.", "Total"]],
    body: quote.items.map((it) => [
      it.name,
      String(it.quantity),
      fmtCOP.format(it.unitPrice),
      fmtCOP.format(it.unitPrice * it.quantity),
    ]),
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [245, 243, 250],
      textColor: [94, 53, 177],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 10, textColor: [40, 40, 40] },
    columnStyles: {
      1: { halign: "center", cellWidth: 60 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right", cellWidth: 100, fontStyle: "bold" },
    },
    styles: { cellPadding: 8 },
    theme: "grid",
  });

  // Totals
  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  const totalsX = pageWidth - margin - 200;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text("Subtotal", totalsX, finalY);
  doc.setTextColor(40, 40, 40);
  doc.text(fmtCOP.format(quote.subtotal), pageWidth - margin, finalY, { align: "right" });

  if ((quote.laborEmployeeAmount ?? 0) > 0) {
    doc.setTextColor(110, 110, 110);
    doc.text(
      `M.O. empleados (${quote.laborWorkers ?? 0} × ${quote.laborHours ?? 0}h)`,
      totalsX,
      finalY + 16,
    );
    doc.setTextColor(40, 40, 40);
    doc.text(fmtCOP.format(quote.laborEmployeeAmount ?? 0), pageWidth - margin, finalY + 16, {
      align: "right",
    });
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(totalsX, finalY + 26, pageWidth - margin, finalY + 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text("Total", totalsX, finalY + 46);
  doc.setTextColor(94, 53, 177);
  doc.text(fmtCOP.format(quote.total), pageWidth - margin, finalY + 46, { align: "right" });

  // Notes
  if (quote.notes) {
    const notesY = finalY + 80;
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(margin, notesY, pageWidth - margin * 2, 60, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text("NOTAS", margin + 12, notesY + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(quote.notes, pageWidth - margin * 2 - 24);
    doc.text(lines, margin + 12, notesY + 34);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado por Quanty · ${fmtDate.format(Date.now())}`, pageWidth / 2, pageHeight - 24, {
    align: "center",
  });

  doc.save(`${quote.folio}-${quote.clientName.replace(/\s+/g, "_")}.pdf`);
}
