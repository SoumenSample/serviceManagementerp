import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Equipment } from "@/models/Equipment";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connectDB();
  const eq = await Equipment.findOne({ qrToken: token })
    .populate("customer", "companyName customerId contactPerson mobile")
    .populate("site", "siteName siteId siteAddress city")
    .lean();
  if (!eq) return NextResponse.json({ error: "Invalid QR token" }, { status: 404 });
  // Return limited fields for QR scan — avoid exposing internal IDs
  return NextResponse.json({
    equipmentId: eq.equipmentId,
    assetId: eq.assetId,
    make: eq.make,
    model: eq.model,
    serialNumber: eq.serialNumber,
    kvaCapacity: eq.kvaCapacity,
    installationDate: eq.installationDate,
    warrantyStartDate: eq.warrantyStartDate,
    warrantyEndDate: eq.warrantyEndDate,
    amcStartDate: eq.amcStartDate,
    amcEndDate: eq.amcEndDate,
    equipmentStatus: eq.equipmentStatus,
    currentCondition: eq.currentCondition,
    customer: eq.customer,
    site: eq.site,
  });
}
