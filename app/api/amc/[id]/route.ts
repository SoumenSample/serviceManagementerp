import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { AmcContract } from "@/models/AmcContract";
import { Customer } from "@/models/Customer";
import { Site } from "@/models/Site";
import { Equipment } from "@/models/Equipment";
import { User } from "@/models/User";
import { amcUpdateSchema } from "@/lib/validators";
import { getComputedAmcStatus, getDaysRemaining } from "@/lib/amc-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "amc.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const doc = await AmcContract.findById(id)
    .populate("customer", "companyName customerId contactPerson mobile email billingAddress")
    .populate("site", "siteName siteId siteAddress city state pincode contactPerson mobile email")
    .populate("assignedEngineer", "name email employeeId")
    .populate("equipmentIds", "equipmentId assetId make model serialNumber kvaCapacity equipmentStatus")
    .lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = doc as unknown as { endDate: string; startDate: string; status: string };
  const daysRemaining = getDaysRemaining(d.endDate);
  const computedStatus = getComputedAmcStatus(d.startDate, d.endDate, d.status as never);
  return NextResponse.json({ ...doc, daysRemaining, computedStatus });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "amc.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const parsed = amcUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const existing = await AmcContract.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "CANCELLED" || existing.status === "RENEWED") return NextResponse.json({ error: "Cannot edit cancelled/renewed AMC" }, { status: 400 });

  // If customer/site/equipment changing, re-validate relationships
  const newCustomer = (parsed.data.customer as string) || String(existing.customer);
  const newSite = (parsed.data.site as string) || String(existing.site);
  const newEquipmentIds = (parsed.data.equipmentIds as string[]) || existing.equipmentIds.map(String);

  if (parsed.data.customer || parsed.data.site || parsed.data.equipmentIds) {
    const customer = await Customer.findById(newCustomer);
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 400 });
    const site = await Site.findById(newSite);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 400 });
    if (String(site.customer) !== String(newCustomer)) return NextResponse.json({ error: "Site does not belong to Customer" }, { status: 400 });
    const eqs = await Equipment.find({ _id: { $in: newEquipmentIds } });
    if (eqs.length !== newEquipmentIds.length) return NextResponse.json({ error: "Some equipment not found" }, { status: 400 });
    for (const eq of eqs) if (String(eq.site) !== String(newSite)) return NextResponse.json({ error: `Equipment ${eq.equipmentId} not in site` }, { status: 400 });
    if (new Set(newEquipmentIds).size !== newEquipmentIds.length) return NextResponse.json({ error: "Duplicate equipment" }, { status: 400 });
  }
  if (parsed.data.assignedEngineer) {
    const eng = await User.findById(parsed.data.assignedEngineer);
    if (!eng || eng.role !== "engineer" || !eng.isActive) return NextResponse.json({ error: "Invalid engineer" }, { status: 400 });
  }
  // Validate dates
  const start = parsed.data.startDate ? new Date(parsed.data.startDate) : existing.startDate;
  const end = parsed.data.endDate ? new Date(parsed.data.endDate) : existing.endDate;
  if (end < start) return NextResponse.json({ error: "End date must not be before start date" }, { status: 400 });
  if (parsed.data.contractAmount !== undefined && parsed.data.contractAmount < 0) return NextResponse.json({ error: "Amount cannot be negative" }, { status: 400 });

  Object.assign(existing, {
    ...parsed.data,
    ...(parsed.data.startDate ? { startDate: new Date(parsed.data.startDate) } : {}),
    ...(parsed.data.endDate ? { endDate: new Date(parsed.data.endDate) } : {}),
    assignedEngineer: parsed.data.assignedEngineer || undefined,
    updatedBy: auth.sub,
  });
  await existing.save();
  return NextResponse.json(existing);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "amc.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  const doc = await AmcContract.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Soft cancel — preserve history
  doc.status = "CANCELLED";
  await doc.save();
  return NextResponse.json({ ok: true, status: "CANCELLED" });
}
