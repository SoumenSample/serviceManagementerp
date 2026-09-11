import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { ServiceExpense } from "@/models/ServiceExpense";
import { ServiceCall } from "@/models/ServiceCall";
import { ServiceVisit } from "@/models/ServiceVisit";
import { serviceExpenseSchema } from "@/lib/validators";
import { genExpenseId } from "@/lib/id-generators";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "expense.view") && !hasPermission(auth.role, "finance.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const serviceCall = searchParams.get("serviceCall");
  const serviceVisit = searchParams.get("serviceVisit");
  const incurredBy = searchParams.get("incurredBy");
  const costSource = searchParams.get("costSource");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (serviceCall) filter.serviceCall = serviceCall;
  if (serviceVisit) filter.serviceVisit = serviceVisit;
  if (incurredBy) filter.incurredBy = incurredBy;
  if (costSource) filter.costSource = costSource;
  if (auth.role === "engineer") {
    // Engineers see expenses they submitted or incurred, or for their assigned calls
    filter.$or = [{ submittedBy: auth.sub }, { incurredBy: auth.sub }];
  }
  const [items, total] = await Promise.all([
    ServiceExpense.find(filter).populate("serviceCall", "callId").populate("serviceVisit", "visitId visitPurpose").populate("submittedBy", "name").populate("incurredBy", "name").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ServiceExpense.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "expense.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = serviceExpenseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const sc = await ServiceCall.findById(parsed.data.serviceCall);
  if (!sc) return NextResponse.json({ error: "ServiceCall not found" }, { status: 400 });
  // Engineers must provide serviceVisit and it must be their own visit
  if (auth.role === "engineer" && !parsed.data.serviceVisit) return NextResponse.json({ error: "Engineers must provide serviceVisit for their own visit" }, { status: 400 });
  if (parsed.data.serviceVisit) {
    const sv = await ServiceVisit.findById(parsed.data.serviceVisit);
    if (!sv) return NextResponse.json({ error: "ServiceVisit not found" }, { status: 400 });
    if (String(sv.serviceCall) !== String(parsed.data.serviceCall)) return NextResponse.json({ error: "Visit does not belong to ServiceCall" }, { status: 400 });
    if (auth.role === "engineer" && String(sv.engineer) !== String(auth.sub)) {
      return NextResponse.json({ error: "Engineers can only expense on their own visit" }, { status: 403 });
    }
  }
  // Determine incurredBy: default to authenticated user, but allow authorized users to submit on behalf
  let incurredBy: string = auth.sub as string;
  if (parsed.data.incurredBy) {
    if (auth.role === "engineer" && String(parsed.data.incurredBy) !== String(auth.sub)) return NextResponse.json({ error: "Engineers cannot set incurredBy to another person" }, { status: 403 });
    // Validate incurredBy user exists
    const { User } = await import("@/models/User");
    const u = await User.findById(parsed.data.incurredBy);
    if (!u) return NextResponse.json({ error: "incurredBy user not found" }, { status: 400 });
    incurredBy = parsed.data.incurredBy;
  }
  // Cost source authorization: engineers can only create FIELD, SERVICE_CENTER requires manager/coordinator/super_admin or finance
  const costSource = parsed.data.costSource || "FIELD";
  if (costSource === "SERVICE_CENTER" && auth.role === "engineer") {
    if (!hasPermission(auth.role, "finance.view")) return NextResponse.json({ error: "Engineers cannot create SERVICE_CENTER costs" }, { status: 403 });
  }
  // Derive customer/site/equipment from ServiceCall
  const expenseId = await genExpenseId();
  // Validate receipt folder security if provided
  if (parsed.data.receipt && !parsed.data.receipt.publicId.startsWith(`ups-system/expenses/${expenseId}`)) {
    return NextResponse.json({ error: "Invalid receipt folder" }, { status: 400 });
  }
  const doc = await ServiceExpense.create({
    expenseId,
    serviceCall: parsed.data.serviceCall,
    serviceVisit: parsed.data.serviceVisit || undefined,
    customer: sc.customer,
    site: sc.site,
    equipment: sc.equipment,
    category: parsed.data.category,
    description: parsed.data.description,
    amount: parsed.data.amount,
    expenseDate: new Date(parsed.data.expenseDate),
    incurredBy,
    submittedBy: auth.sub,
    costSource,
    status: "SUBMITTED",
    receipt: parsed.data.receipt,
    remarks: parsed.data.remarks,
  });
    createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "CREATE",
    module: "EXPENSE",
    recordId: (doc as any).expenseId || String((doc as any)._id),
    recordObjectId: String((doc as any)._id),
    recordType: "ServiceExpense",
    description: `Expense ${(doc as any).expenseId} created`,
    after: { amount: (doc as any).amount, category: (doc as any).category } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(()=>{});
return NextResponse.json(doc, { status: 201 });
}
