"use client";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

type Props = {
  qrDataUrl: string;
  equipmentId: string;
  assetId?: string;
  serialNumber?: string;
  token: string;
  make?: string;
  model?: string;
  siteName?: string;
};

export function QrPrintActions({ qrDataUrl, equipmentId, assetId, serialNumber, token, make, model, siteName }: Props) {
  function handleDownload() {
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${equipmentId}-QR.png`;
    a.click();
  }

  function handlePrint() {
    const printWindow = window.open("", "_blank", "width=600,height=700");
    if (!printWindow) {
      window.print();
      return;
    }
    const title = equipmentId;
    const sub = [make, model].filter(Boolean).join(" ") || "UPS / Inverter";
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>QR - ${escapeHtml(title)}</title>
<style>
  @page { size: auto; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; margin:0; padding:24px; color:#111; }
  .sheet { max-width: 380px; margin: 0 auto; border: 2px solid #111; border-radius: 12px; padding: 20px; text-align: center; }
  .brand { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color:#666; margin-bottom: 6px; }
  .eq { font-size: 22px; font-weight: 800; letter-spacing: 0.02em; margin: 6px 0 2px; font-family: ui-monospace, monospace; }
  .sub { font-size: 11px; color:#555; margin-bottom: 12px; }
  .qr-wrap { background:#fff; border-radius: 10px; padding: 10px; display:inline-block; border: 1px solid #e5e7eb; }
  .qr-wrap img { width: 220px; height: 220px; display:block; }
  .meta { margin-top: 14px; text-align: left; font-size: 11px; line-height: 1.6; border-top: 1px dashed #ddd; padding-top: 10px; }
  .meta .row { display:flex; justify-content: space-between; }
  .meta .k { color:#666; }
  .meta .v { font-weight:600; font-family: ui-monospace, monospace; }
  .footer { margin-top: 10px; font-size: 9px; color:#888; }
  .token { font-family: ui-monospace, monospace; font-size: 8px; color:#aaa; word-break: break-all; margin-top: 6px; }
  @media print {
    body { padding:0; }
    .no-print { display:none !important; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="brand">Equipment QR</div>
    <div class="eq">${escapeHtml(title)}</div>
    <div class="sub">${escapeHtml(sub)} ${siteName ? `• ${escapeHtml(siteName)}` : ""}</div>
    <div class="qr-wrap"><img src="${qrDataUrl}" alt="QR ${escapeHtml(title)}" /></div>
    <div class="meta">
      ${assetId ? `<div class="row"><span class="k">Asset ID</span><span class="v">${escapeHtml(assetId)}</span></div>` : ""}
      ${serialNumber ? `<div class="row"><span class="k">Serial</span><span class="v">${escapeHtml(serialNumber)}</span></div>` : ""}
      <div class="row"><span class="k">Scan to</span><span class="v">/equipment/qr/${escapeHtml(token)}</span></div>
    </div>
    <div class="footer">Stick on equipment • Scan to view AMC & create Service Call</div>
    <div class="token">${escapeHtml(token)}</div>
  </div>
  <p class="no-print" style="text-align:center; margin-top:18px;"><button onclick="window.print()" style="padding:8px 16px; font-size:13px; cursor:pointer;">Print</button> <button onclick="window.close()" style="padding:8px 16px; font-size:13px; cursor:pointer;">Close</button></p>
  <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
</body>
</html>`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <div className="flex gap-2 w-full print:hidden">
      <Button variant="outline" size="sm" className="flex-1" onClick={handlePrint} disabled={!qrDataUrl}>
        <Printer className="h-4 w-4 mr-1.5" />
        Print QR Label
      </Button>
      <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload} disabled={!qrDataUrl}>
        <Download className="h-4 w-4 mr-1.5" />
        Download PNG
      </Button>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
