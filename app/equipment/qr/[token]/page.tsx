import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Equipment } from "@/models/Equipment";
import { AmcContract } from "@/models/AmcContract";
import { ServiceCall } from "@/models/ServiceCall";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getComputedAmcStatus } from "@/lib/amc-helpers";
import QRCode from "qrcode";
import { QrPrintActions } from "@/components/equipment/qr-print-actions";

export default async function QrEquipmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connectDB();
  const eq = await Equipment.findOne({ qrToken: token }).populate("customer", "companyName customerId").populate("site", "siteName siteId siteAddress city").lean() as unknown as { _id: unknown; equipmentId: string; assetId?: string; make?: string; model?: string; serialNumber?: string; kvaCapacity?: string; equipmentStatus: string; currentCondition?: string; warrantyEndDate?: string; amcStartDate?: string; amcEndDate?: string; customer: { _id: unknown; companyName: string }; site: { _id: unknown; siteName: string; siteId: string } } | null;
  if (!eq) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qrUrl = `${appUrl.replace(/\/$/, "")}/equipment/qr/${token}`;
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 300, margin: 1 });
  } catch {
    qrDataUrl = "";
  }

  // AMC details for this equipment
  const amc = await (AmcContract as unknown as { findOne: (f: Record<string, unknown>) => { sort: (s: Record<string, unknown>) => { lean: () => Promise<unknown> } } }).findOne({ equipmentIds: eq._id as unknown as string }).sort({ endDate: -1 }).lean() as unknown as { amcId: string; amcType: string; startDate: string; endDate: string; status: string } | null;
  let amcComputed: string | null = null;
  if (amc) amcComputed = getComputedAmcStatus(amc.startDate, amc.endDate, amc.status as never);

  // Recent service history (5 recent)
  const history = await (ServiceCall as unknown as { find: (f: Record<string, unknown>) => { sort: (s: Record<string, unknown>) => { limit: (n: number) => { populate: (a: string, b: string) => { lean: () => Promise<unknown> } } } } }).find({ equipment: eq._id as unknown as string }).sort({ complaintDate: -1 }).limit(5).populate("assignedEngineer", "name").lean() as unknown as { callId: string; complaintDate: string; currentStatus: string; priority: string; assignedEngineer?: { name: string } }[];

  // Open complaints
  const openComplaints = await (ServiceCall as unknown as { find: (f: Record<string, unknown>) => { sort: (s: Record<string, unknown>) => { limit: (n: number) => { lean: () => Promise<unknown> } } } }).find({ equipment: eq._id as unknown as string, currentStatus: { $in: ["NEW", "ASSIGNED", "VISIT_SCHEDULED", "ENGINEER_VISITED", "DIAGNOSIS", "REPAIR_IN_PROGRESS", "PARTS_REQUIRED", "PARTS_RECEIVED"] } }).sort({ complaintDate: -1 }).limit(5).lean() as unknown as { _id: unknown; callId: string; complaintDate: string; problemDescription: string; priority: string; currentStatus: string }[];

  return (
    <div className="min-h-svh bg-muted flex flex-col items-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{eq.equipmentId}</CardTitle>
            <CardDescription>{[eq.make, eq.model].filter(Boolean).join(" ") || "UPS/Inverter"} • {eq.kvaCapacity || ""}</CardDescription>
            <div className="flex justify-center gap-2 mt-2">
              <Badge>{eq.equipmentStatus}</Badge>
              {eq.currentCondition && <Badge variant="outline">{eq.currentCondition}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-col items-center gap-2 py-2 border rounded-lg bg-white print:border-black">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt={`QR ${eq.equipmentId}`} width={180} height={180} className="rounded" />
              ) : (
                <p className="text-xs text-muted-foreground">QR unavailable</p>
              )}
              <p className="font-mono text-sm font-bold">{eq.equipmentId}</p>
              <p className="text-xs text-muted-foreground">{[eq.make, eq.model].filter(Boolean).join(" ") || "UPS/Inverter"} {eq.assetId ? `• ${eq.assetId}` : ""}</p>
              <p className="font-mono text-[10px] text-muted-foreground break-all px-2">{token}</p>
            </div>
            {qrDataUrl && (
              <QrPrintActions
                qrDataUrl={qrDataUrl}
                equipmentId={eq.equipmentId}
                assetId={eq.assetId}
                serialNumber={eq.serialNumber}
                token={token}
                make={eq.make}
                model={eq.model}
                siteName={eq.site?.siteName}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Customer</span><p className="font-medium">{eq.customer?.companyName}</p></div>
              <div><span className="text-muted-foreground">Site</span><p className="font-medium">{eq.site?.siteName}</p></div>
              <div><span className="text-muted-foreground">Serial</span><p className="font-mono text-xs">{eq.serialNumber || "-"}</p></div>
              <div><span className="text-muted-foreground">Asset ID</span><p className="font-mono text-xs">{eq.assetId || "-"}</p></div>
              <div><span className="text-muted-foreground">KVA</span><p>{eq.kvaCapacity || "-"}</p></div>
              <div><span className="text-muted-foreground">Current Site</span><p>{eq.site?.siteName || "-"}</p></div>
            </div>

            <div className="border-t pt-3">
              <p className="font-medium mb-1">AMC Details</p>
              {amc ? (
                <div className="space-y-1 text-xs">
                  <p>AMC ID: <span className="font-mono">{amc.amcId}</span> • {amc.amcType} • <Badge variant={amcComputed === "ACTIVE" ? "secondary" : amcComputed === "EXPIRED" ? "destructive" : "outline"}>{amcComputed}</Badge></p>
                  <p>Start: {new Date(amc.startDate).toLocaleDateString()} • End: {new Date(amc.endDate).toLocaleDateString()}</p>
                </div>
              ) : <p className="text-xs text-muted-foreground">No AMC found for this equipment</p>}
            </div>

            <div className="border-t pt-3">
              <p className="font-medium mb-1">Previous Service History (recent 5)</p>
              {history.length === 0 ? <p className="text-xs text-muted-foreground">No previous service history</p> : (
                <div className="space-y-1">
                  {history.map((h) => (
                    <div key={h.callId} className="flex justify-between text-xs border-b py-1">
                      <span className="font-mono">{h.callId} • {h.currentStatus}</span>
                      <span>{new Date(h.complaintDate).toLocaleDateString()} • {h.assignedEngineer?.name || "Unassigned"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-3">
              <p className="font-medium mb-1">Open Complaints</p>
              {openComplaints.length === 0 ? <p className="text-xs text-muted-foreground">No open complaints</p> : (
                <div className="space-y-1">
                  {openComplaints.map((c) => (
                    <div key={String(c._id)} className="text-xs border rounded p-2">
                      <p className="font-mono">{c.callId} • {c.currentStatus} • {c.priority}</p>
                      <p className="truncate">{c.problemDescription}</p>
                      <p className="text-muted-foreground">{new Date(c.complaintDate).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link href={`/dashboard/service-calls/new?equipmentId=${String(eq._id)}`} className="w-full"><Button className="w-full">Create New Service Call for this Equipment</Button></Link>
              <Link href={`/dashboard/equipment/${String(eq._id)}`} className="w-full"><Button variant="outline" className="w-full">View Equipment in Dashboard</Button></Link>
              <p className="text-xs text-muted-foreground text-center">Scanned via QR • Token is secure, no ObjectId exposed</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
