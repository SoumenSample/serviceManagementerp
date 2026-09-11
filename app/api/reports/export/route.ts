import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { ServiceCall } from "@/models/ServiceCall";
import { ServiceVisit } from "@/models/ServiceVisit";
import { AmcContract } from "@/models/AmcContract";
import { Equipment } from "@/models/Equipment";
import { User } from "@/models/User";
import { Part } from "@/models/Part";
import { Inventory } from "@/models/Inventory";
import { PartRequest } from "@/models/PartRequest";
import { ServiceExpense } from "@/models/ServiceExpense";
import { getComputedAmcStatus } from "@/lib/amc-helpers";
import { OPEN_STATUSES, CLOSED_STATUSES, getPendingSince } from "@/lib/servicecall-helpers";

const EXPORT_MAX = 5000;

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "reports.view") || !hasPermission(auth.role, "reports.export")) return NextResponse.json({ error: "Forbidden reports.export" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const report = searchParams.get("report") || "open-calls";
  const format = searchParams.get("format") || "excel";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const customer = searchParams.get("customer") || undefined;
  const site = searchParams.get("site") || undefined;
  const engineer = searchParams.get("engineer") || undefined;

  await connectDB();
  const isEngineer = auth!.role === "engineer";
  const effectiveEngineer = isEngineer ? String(auth!.sub) : engineer;
  if (isEngineer && engineer && engineer !== String(auth!.sub)) return NextResponse.json({ error: "Forbidden engineer scope" }, { status: 403 });

  // Build filter helpers
  function baseSCFilter() {
    const f: Record<string, unknown> = {};
    if (from || to) {
      const d: Record<string, unknown> = {};
      if (from) (d as Record<string, unknown>).$gte = new Date(from);
      if (to) (d as Record<string, unknown>).$lte = new Date(to);
      f.complaintDate = d;
    }
    if (customer) f.customer = customer;
    if (site) f.site = site;
    if (effectiveEngineer) f.assignedEngineer = effectiveEngineer;
    return f;
  }

  let items: Record<string, unknown>[] = [];
  let summary: Record<string, unknown> = {};
  let columns: { header: string; key: string; width: number }[] = [];
  let rows: Record<string, unknown>[] = [];

  // Fetch data per report with EXPORT_MAX limit
  if (["open-calls", "pending-calls", "closed-calls", "sla", "monthly"].includes(report)) {
    const base = baseSCFilter();
    let statusFilter: Record<string, unknown> = {};
    if (report === "open-calls") statusFilter = { currentStatus: { $in: OPEN_STATUSES.filter(s => s !== "CANCELLED") } };
    else if (report === "pending-calls") statusFilter = { currentStatus: { $in: OPEN_STATUSES } };
    else if (report === "closed-calls") statusFilter = { currentStatus: { $in: CLOSED_STATUSES } };
    const filter = { ...base, ...statusFilter };
    let queryFilter = filter;
    if (report === "monthly") {
      const year = searchParams.get("year") || String(new Date().getFullYear());
      const month = searchParams.get("month") || "";
      if (month) {
        const start = new Date(`${year}-${month.padStart(2, "0")}-01`);
        const end = new Date(start); end.setMonth(end.getMonth() + 1);
        queryFilter = { ...base, complaintDate: { $gte: start, $lt: end } };
      } else if (year) {
        queryFilter = { ...base, complaintDate: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${Number(year) + 1}-01-01`) } };
      }
    }
    const docs = await ServiceCall.find(queryFilter).populate("customer", "companyName").populate("site", "siteName").populate("equipment", "equipmentId serialNumber").populate("assignedEngineer", "name").sort({ complaintDate: -1 }).limit(EXPORT_MAX).lean();
    items = docs as unknown as Record<string, unknown>[];
    const total = docs.length;
    summary = { total, report };
    if (report === "sla") {
      const enriched = (docs as unknown as { complaintDate: string; targetVisitDate?: string; actualVisitDate?: string; actualResolutionDate?: string }[]).map((r) => {
        const complaint = new Date(r.complaintDate).getTime();
        const target = r.targetVisitDate ? new Date(r.targetVisitDate).getTime() : null;
        const actualVisit = r.actualVisitDate ? new Date(r.actualVisitDate).getTime() : null;
        const breached = target && actualVisit ? actualVisit > target : target ? Date.now() > target && !actualVisit : false;
        const resolutionDays = r.actualResolutionDate ? (new Date(r.actualResolutionDate).getTime() - complaint) / (1000 * 60 * 60 * 24) : null;
        return { ...r, slaBreached: breached, resolutionDays: resolutionDays !== null ? Number(resolutionDays.toFixed(1)) : null };
      });
      items = enriched as unknown as Record<string, unknown>[];
    }
    columns = [
      { header: "Call ID", key: "callId", width: 16 },
      { header: "Complaint Date", key: "complaintDate", width: 14 },
      { header: "Customer", key: "customerName", width: 18 },
      { header: "Site", key: "siteName", width: 16 },
      { header: "Equipment", key: "equipmentId", width: 14 },
      { header: "Serial", key: "serialNumber", width: 14 },
      { header: "Problem", key: "problemDescription", width: 30 },
      { header: "Priority", key: "priority", width: 10 },
      { header: "Engineer", key: "engineerName", width: 16 },
      { header: "Status", key: "currentStatus", width: 14 },
      { header: "Pending Since", key: "pendingSince", width: 12 },
      { header: "Next Action", key: "nextAction", width: 20 },
      { header: "Target Visit", key: "targetVisitDate", width: 14 },
    ];
    rows = (items as unknown as { callId: string; complaintDate: string; customer?: { companyName: string }; site?: { siteName: string }; equipment?: { equipmentId: string; serialNumber: string }; problemDescription: string; priority: string; assignedEngineer?: { name: string }; currentStatus: string; createdAt: string; nextAction: string; targetVisitDate?: string }[]).map((r) => ({
      callId: r.callId,
      complaintDate: r.complaintDate ? new Date(r.complaintDate) : "",
      customerName: r.customer?.companyName || "",
      siteName: r.site?.siteName || "",
      equipmentId: r.equipment?.equipmentId || "",
      serialNumber: r.equipment?.serialNumber || "",
      problemDescription: r.problemDescription,
      priority: r.priority,
      engineerName: r.assignedEngineer?.name || "Unassigned",
      currentStatus: r.currentStatus,
      pendingSince: r.createdAt ? getPendingSince(r.createdAt as unknown as string) : "",
      nextAction: r.nextAction || "",
      targetVisitDate: r.targetVisitDate ? new Date(r.targetVisitDate as unknown as string) : "",
    }));
  } else if (report === "amc") {
    const amcFilter: Record<string, unknown> = {};
    if (customer) amcFilter.customer = customer;
    if (site) amcFilter.site = site;
    if (effectiveEngineer) amcFilter.assignedEngineer = effectiveEngineer;
    const amcType = searchParams.get("amcType");
    const amcStatus = searchParams.get("amcStatus");
    const paymentStatus = searchParams.get("paymentStatus");
    if (amcType) amcFilter.amcType = amcType;
    if (paymentStatus) amcFilter.paymentStatus = paymentStatus;
    const all = await AmcContract.find(amcFilter).populate("customer", "companyName").populate("site", "siteName").populate("assignedEngineer", "name").limit(EXPORT_MAX).lean();
    let filtered = all as unknown as { startDate: string; endDate: string; status: string }[];
    if (amcStatus) filtered = filtered.filter((a) => getComputedAmcStatus(a.startDate, a.endDate, a.status as never) === amcStatus);
    items = filtered as unknown as Record<string, unknown>[];
    summary = { total: filtered.length };
    columns = [
      { header: "AMC ID", key: "amcId", width: 16 },
      { header: "Customer", key: "customerName", width: 18 },
      { header: "Site", key: "siteName", width: 16 },
      { header: "Type", key: "amcType", width: 16 },
      { header: "Start Date", key: "startDate", width: 12 },
      { header: "End Date", key: "endDate", width: 12 },
      { header: "Status", key: "computedStatus", width: 14 },
      { header: "Amount", key: "contractAmount", width: 12 },
      { header: "Payment", key: "paymentStatus", width: 12 },
      { header: "Engineer", key: "engineerName", width: 16 },
    ];
    rows = (filtered as unknown as { amcId: string; customer?: { companyName: string }; site?: { siteName: string }; amcType: string; startDate: string; endDate: string; status: string; contractAmount: number; paymentStatus: string; assignedEngineer?: { name: string } }[]).map((r) => ({
      amcId: r.amcId,
      customerName: r.customer?.companyName || "",
      siteName: r.site?.siteName || "",
      amcType: r.amcType,
      startDate: r.startDate ? new Date(r.startDate) : "",
      endDate: r.endDate ? new Date(r.endDate) : "",
      computedStatus: getComputedAmcStatus(r.startDate, r.endDate, r.status as never),
      contractAmount: r.contractAmount,
      paymentStatus: r.paymentStatus,
      engineerName: r.assignedEngineer?.name || "",
    }));
  } else if (report === "equipment") {
    const eqFilter: Record<string, unknown> = {};
    if (customer) eqFilter.customer = customer;
    if (site) eqFilter.site = site;
    if (searchParams.get("make")) eqFilter.make = searchParams.get("make");
    const docs = await Equipment.find(eqFilter).populate("customer", "companyName").populate("site", "siteName").limit(EXPORT_MAX).lean();
    const ids = docs.map((e) => e._id);
    const counts = await ServiceCall.aggregate([{ $match: { equipment: { $in: ids } } }, { $group: { _id: "$equipment", count: { $sum: 1 } } }]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    items = docs as unknown as Record<string, unknown>[];
    columns = [
      { header: "Equipment ID", key: "equipmentId", width: 14 },
      { header: "Asset ID", key: "assetId", width: 14 },
      { header: "Customer", key: "customerName", width: 18 },
      { header: "Site", key: "siteName", width: 16 },
      { header: "Make", key: "make", width: 12 },
      { header: "Model", key: "model", width: 12 },
      { header: "Serial", key: "serialNumber", width: 14 },
      { header: "KVA", key: "kvaCapacity", width: 8 },
      { header: "Status", key: "equipmentStatus", width: 12 },
      { header: "Service Count", key: "serviceCount", width: 12 },
    ];
    rows = (docs as unknown as { equipmentId: string; assetId: string; customer?: { companyName: string }; site?: { siteName: string }; make: string; model: string; serialNumber: string; kvaCapacity: string; equipmentStatus: string; _id: unknown }[]).map((r) => ({
      equipmentId: r.equipmentId,
      assetId: r.assetId || "",
      customerName: r.customer?.companyName || "",
      siteName: r.site?.siteName || "",
      make: r.make || "",
      model: r.model || "",
      serialNumber: r.serialNumber || "",
      kvaCapacity: r.kvaCapacity || "",
      equipmentStatus: r.equipmentStatus,
      serviceCount: countMap.get(String(r._id)) || 0,
    }));
    summary = { total: docs.length };
  } else if (report === "engineer") {
    const users = await User.find({ role: "engineer", isActive: true }).select("name email").lean();
    const filteredUsers = isEngineer ? users.filter((u) => String(u._id) === String(auth!.sub)) : users;
    const limited = filteredUsers.slice(0, EXPORT_MAX);
    const docs: Record<string, unknown>[] = [];
    for (const u of limited) {
      const assigned = await ServiceCall.countDocuments({ assignedEngineer: u._id });
      const visits = await ServiceVisit.countDocuments({ engineer: u._id });
      const completedVisits = await ServiceVisit.countDocuments({ engineer: u._id, status: "COMPLETED" });
      docs.push({ name: u.name, email: u.email, assigned, visits, completedVisits });
    }
    items = docs;
    columns = [
      { header: "Name", key: "name", width: 20 },
      { header: "Email", key: "email", width: 24 },
      { header: "Assigned Calls", key: "assigned", width: 14 },
      { header: "Visits", key: "visits", width: 10 },
      { header: "Completed Visits", key: "completedVisits", width: 14 },
    ];
    rows = docs;
    summary = { totalEngineers: docs.length };
  } else if (report === "parts") {
    const partFilter: Record<string, unknown> = {};
    const category = searchParams.get("category");
    if (category) partFilter.category = category;
    const docs = await Part.find(partFilter).limit(EXPORT_MAX).lean();
    const invs = await Inventory.find({ part: { $in: docs.map((p) => p._id) } }).lean();
    const invMap = new Map(invs.map((i) => [String(i.part), i]));
    items = docs as unknown as Record<string, unknown>[];
    columns = [
      { header: "Part ID", key: "partId", width: 14 },
      { header: "SKU", key: "partNumber", width: 14 },
      { header: "Name", key: "name", width: 20 },
      { header: "Category", key: "category", width: 12 },
      { header: "Available", key: "available", width: 10 },
      { header: "Min Stock", key: "minimumStockLevel", width: 10 },
    ];
    rows = (docs as unknown as { partId: string; partNumber: string; name: string; category: string; minimumStockLevel: number; _id: unknown }[]).map((p) => {
      const inv = invMap.get(String(p._id)) as unknown as { quantityOnHand: number; quantityReserved: number } | undefined;
      const available = inv ? inv.quantityOnHand - inv.quantityReserved : 0;
      return { partId: p.partId, partNumber: p.partNumber, name: p.name, category: p.category || "", available, minimumStockLevel: p.minimumStockLevel };
    });
    summary = { total: docs.length };
  } else if (report === "expenses") {
    const expFilter: Record<string, unknown> = {};
    if (customer) expFilter.customer = customer;
    if (site) expFilter.site = site;
    if (searchParams.get("category")) expFilter.category = searchParams.get("category");
    if (searchParams.get("costSource")) expFilter.costSource = searchParams.get("costSource");
    if (searchParams.get("status")) expFilter.status = searchParams.get("status");
    if (isEngineer) expFilter.incurredBy = auth!.sub;
    else if (engineer) expFilter.incurredBy = engineer;
    if (from || to) {
      const d: Record<string, unknown> = {};
      if (from) (d as Record<string, unknown>).$gte = new Date(from);
      if (to) (d as Record<string, unknown>).$lte = new Date(to);
      expFilter.expenseDate = d;
    }
    const docs = await ServiceExpense.find(expFilter).populate("serviceCall", "callId").populate("incurredBy", "name").populate("serviceVisit", "visitId").limit(EXPORT_MAX).lean();
    items = docs as unknown as Record<string, unknown>[];
    columns = [
      { header: "Expense ID", key: "expenseId", width: 16 },
      { header: "Service Call", key: "callId", width: 14 },
      { header: "Visit", key: "visitId", width: 14 },
      { header: "Incurred By", key: "incurredBy", width: 16 },
      { header: "Cost Source", key: "costSource", width: 14 },
      { header: "Category", key: "category", width: 12 },
      { header: "Amount", key: "amount", width: 10 },
      { header: "Date", key: "expenseDate", width: 12 },
      { header: "Status", key: "status", width: 12 },
    ];
    rows = (docs as unknown as { expenseId: string; serviceCall?: { callId: string }; serviceVisit?: { visitId: string }; incurredBy?: { name: string }; costSource: string; category: string; amount: number; expenseDate: string; status: string }[]).map((r) => ({
      expenseId: r.expenseId,
      callId: r.serviceCall?.callId || "",
      visitId: r.serviceVisit?.visitId || "",
      incurredBy: r.incurredBy?.name || "",
      costSource: r.costSource || "FIELD",
      category: r.category,
      amount: r.amount,
      expenseDate: r.expenseDate ? new Date(r.expenseDate) : "",
      status: r.status,
    }));
    summary = { total: docs.length };
  } else {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }

  const filtersStr = searchParams.toString();
  const generated = new Date().toLocaleString();

  if (format === "pdf") {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const PAGE_W = 842;
    const PAGE_H = 595;
    const MARGIN = 32;
    const ROW_H = 14;
    const HEADER_H = 16;
    const FONT_SIZE = 6.5;
    const HEADER_FONT_SIZE = 6.5;

    function formatVal(v: unknown): string {
      if (v === null || v === undefined || v === "") return "-";
      if (v instanceof Date) return isNaN(v.getTime()) ? "-" : v.toLocaleDateString("en-GB");
      if (typeof v === "number") return String(v);
      return String(v);
    }

    // Calculate column widths proportionally from columns[].width
    const usableW = PAGE_W - MARGIN * 2;
    const totalWUnits = columns.reduce((s, c) => s + (c.width || 12), 0) || columns.length * 12;
    const colWs = columns.map((c) => (usableW * (c.width || 12)) / totalWUnits);
    // Precompute X positions
    const colXs: number[] = [];
    let acc = MARGIN;
    for (const w of colWs) { colXs.push(acc); acc += w; }

    const truncate = (text: string, maxChars: number) => {
      if (text.length <= maxChars) return text;
      return text.slice(0, maxChars - 1) + "…";
    };

    let page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - 30;

    const title = `Report: ${report}`;
    page.drawText(title, { x: MARGIN, y, size: 13, font: bold, color: rgb(0, 0, 0) });
    y -= 16;
    page.drawText(`Generated: ${generated}`, { x: MARGIN, y, size: 8, font });
    y -= 10;
    // Filters may be long, wrap/truncate to one line
    const filterText = `Filters: ${filtersStr || "-"}`;
    page.drawText(truncate(filterText, 140), { x: MARGIN, y, size: 6, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 9;
    const summaryText = `Summary: ${Object.entries(summary).map(([k, v]) => `${k}=${v}`).join(" | ") || "-" }  |  Rows: ${rows.length} (max ${EXPORT_MAX})`;
    page.drawText(truncate(summaryText, 150), { x: MARGIN, y, size: 6, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 14;

    // Helper to draw table header on current page
    const drawHeader = () => {
      // header background
      page.drawRectangle({ x: MARGIN, y: y - 2, width: usableW, height: HEADER_H, color: rgb(0.12, 0.16, 0.22) });
      for (let i = 0; i < columns.length; i++) {
        const c = columns[i];
        const maxChars = Math.max(4, Math.floor(colWs[i] / 4.2));
        page.drawText(truncate(c.header, maxChars), {
          x: colXs[i] + 2,
          y: y + 4,
          size: HEADER_FONT_SIZE,
          font: bold,
          color: rgb(1, 1, 1),
        });
      }
      y -= HEADER_H;
      // header underline
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
    };

    const ensureSpace = () => {
      if (y < MARGIN + ROW_H) {
        // footer page number
        page.drawText(`Page ${doc.getPageCount()}`, { x: PAGE_W - MARGIN - 40, y: 14, size: 6, font, color: rgb(0.5, 0.5, 0.5) });
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - 30;
        drawHeader();
      }
    };

    if (columns.length === 0) {
      page.drawText("No columns defined for this report", { x: MARGIN, y, size: 9, font });
    } else {
      drawHeader();
      if (rows.length === 0) {
        page.drawText("No records for selected filters", { x: MARGIN, y: y - 12, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
      } else {
        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
          ensureSpace();
          const r = rows[rIdx];
          // zebra
          if (rIdx % 2 === 1) {
            page.drawRectangle({ x: MARGIN, y: y - 2, width: usableW, height: ROW_H, color: rgb(0.96, 0.97, 0.98) });
          }
          // row border bottom
          page.drawLine({ start: { x: MARGIN, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 }, thickness: 0.3, color: rgb(0.9, 0.91, 0.93) });
          for (let cIdx = 0; cIdx < columns.length; cIdx++) {
            const col = columns[cIdx];
            const raw = (r as Record<string, unknown>)[col.key];
            const txt = truncate(formatVal(raw), Math.max(4, Math.floor(colWs[cIdx] / 3.8)));
            page.drawText(txt, { x: colXs[cIdx] + 2, y: y + 3, size: FONT_SIZE, font, color: rgb(0.15, 0.15, 0.15) });
          }
          // vertical separators
          for (let cIdx = 1; cIdx < columns.length; cIdx++) {
            page.drawLine({ start: { x: colXs[cIdx], y: y - 2 }, end: { x: colXs[cIdx], y: y + ROW_H - 2 }, thickness: 0.3, color: rgb(0.9, 0.91, 0.93) });
          }
          y -= ROW_H;
        }
      }
      // footer on last page
      page.drawText(`Page ${doc.getPageCount()}`, { x: PAGE_W - MARGIN - 40, y: 14, size: 6, font, color: rgb(0.5, 0.5, 0.5) });
      page.drawText(`Generated by ESP Soln • ${generated}`, { x: MARGIN, y: 14, size: 6, font, color: rgb(0.5, 0.5, 0.5) });
    }

    const bytes = await doc.save();
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=${report}.pdf` } });
  }

  // Excel
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ESP Soln";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(report.slice(0, 31));

  // Title section
  sheet.addRow([`Report: ${report}`]);
  sheet.addRow([`Generated: ${generated}`]);
  sheet.addRow([`Filters: ${filtersStr}`]);
  sheet.addRow([`Summary: ${Object.entries(summary).map(([k, v]) => `${k}=${v}`).join(" | ")}`]);
  sheet.addRow([]);
  // Header
  sheet.columns = columns;
  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.commit();

  // Data rows
  for (const r of rows) {
    const row = sheet.addRow(columns.map((c) => r[c.key]));
    // Date formatting
    columns.forEach((c, idx) => {
      const val = r[c.key];
      if (val instanceof Date) {
        row.getCell(idx + 1).numFmt = "dd-mm-yyyy";
      }
      if (c.key === "amount" || c.key === "contractAmount" || c.key === "available") {
        row.getCell(idx + 1).numFmt = '"₹"#,##0';
      }
    });
  }

  // Freeze header
  sheet.views = [{ state: "frozen", ySplit: 6 }];
  // Auto filter
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: columns.length } };
  // Borders
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 6) {
      row.eachCell((cell) => {
        cell.border = { top: { style: "thin", color: { argb: "FFE5E7EB" } }, left: { style: "thin", color: { argb: "FFE5E7EB" } }, bottom: { style: "thin", color: { argb: "FFE5E7EB" } }, right: { style: "thin", color: { argb: "FFE5E7EB" } } };
      });
    }
  });

  const buf = await workbook.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=${report}.xlsx`,
      "Content-Length": String((buf as ArrayBuffer).byteLength),
    },
  });
}
