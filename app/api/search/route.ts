import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { ServiceCall } from "@/models/ServiceCall";
import { Equipment } from "@/models/Equipment";
import { Customer } from "@/models/Customer";
import { Site } from "@/models/Site";
import { User } from "@/models/User";
import { escapeRegExp } from "@/lib/search-helpers";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const qRaw = searchParams.get("q") || "";
  const q = qRaw.trim();
  if (q.length < 2) return NextResponse.json({ error: "Query too short (min 2 chars)" }, { status: 400 });
  if (q.length > 50) return NextResponse.json({ error: "Query too long (max 50)" }, { status: 400 });
  // Prevent operator injection
  if (q.includes("$") || q.includes("{") || q.includes("}")) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const safe = escapeRegExp(q);
  const regex = new RegExp(safe, "i");
  await connectDB();

  const limit = 5;

  // ServiceCalls - scoped for engineer
  let serviceCalls: unknown[] = [];
  if (hasPermission(auth.role, "serviceCall.view")) {
    const filter: Record<string, unknown> = {
      $or: [{ callId: regex }, { problemDescription: regex }],
    };
    if (auth.role === "engineer") {
      // Only assigned
      filter.assignedEngineer = auth.sub;
      // Also need to handle form where $or includes callId etc - merge
      const or = [{ callId: regex }, { problemDescription: regex }];
      // For engineer, we keep assignedEngineer + or for callId/problem
      // To avoid overriding, we keep filter as assignedEngineer + or
      delete (filter as Record<string, unknown>).$or;
      const engineerCalls = await ServiceCall.find({ assignedEngineer: auth.sub, $or: or }).populate("customer", "companyName").populate("site", "siteName").populate("equipment", "equipmentId").limit(limit).lean();
      serviceCalls = engineerCalls.map((c) => ({ id: (c as unknown as { _id: unknown })._id, label: (c as unknown as { callId: string }).callId, sub: `${((c.customer as unknown) as { companyName: string })?.companyName || ""} · ${((c.site as unknown) as { siteName: string })?.siteName || ""}`, path: `/dashboard/service-calls/${(c as unknown as { _id: unknown })._id}` }));
    } else {
      // Search customer/site/equipment relations for broader match
      const custs = await Customer.find({ companyName: regex }).select("_id").limit(5).lean();
      const sites = await Site.find({ siteName: regex }).select("_id").limit(5).lean();
      const eqs = await Equipment.find({ $or: [{ equipmentId: regex }, { assetId: regex }, { serialNumber: regex }] }).select("_id").limit(5).lean();
      const or: Record<string, unknown>[] = [{ callId: regex }, { problemDescription: regex }];
      if (custs.length) or.push({ customer: { $in: custs.map((c) => c._id) } });
      if (sites.length) or.push({ site: { $in: sites.map((s) => s._id) } });
      if (eqs.length) or.push({ equipment: { $in: eqs.map((e) => e._id) } });
      const calls = await ServiceCall.find({ $or: or }).populate("customer", "companyName").populate("site", "siteName").populate("equipment", "equipmentId").limit(limit).lean();
      serviceCalls = calls.map((c) => ({ id: (c as unknown as { _id: unknown })._id, label: (c as unknown as { callId: string }).callId, sub: `${((c.customer as unknown) as { companyName: string })?.companyName || ""} · ${((c.site as unknown) as { siteName: string })?.siteName || ""}`, path: `/dashboard/service-calls/${(c as unknown as { _id: unknown })._id}` }));
    }
  }

  let equipment: unknown[] = [];
  if (hasPermission(auth.role, "equipment.view")) {
    const eqs = await Equipment.find({ $or: [{ equipmentId: regex }, { assetId: regex }, { serialNumber: regex }, { make: regex }, { model: regex }] }).populate("customer", "companyName").populate("site", "siteName").limit(limit).lean();
    equipment = eqs.map((e) => ({ id: (e as unknown as { _id: unknown })._id, label: (e as unknown as { equipmentId: string }).equipmentId, sub: `Asset: ${(e as unknown as { assetId: string }).assetId || "-"} Serial: ${(e as unknown as { serialNumber: string }).serialNumber || "-"} · ${((e.customer as unknown) as { companyName: string })?.companyName || ""}`, path: `/dashboard/equipment/${(e as unknown as { _id: unknown })._id}` }));
  }

  let customers: unknown[] = [];
  if (hasPermission(auth.role, "customer.view")) {
    const custs = await Customer.find({ $or: [{ companyName: regex }, { customerId: regex }, { contactPerson: regex }, { email: regex }] }).limit(limit).lean();
    customers = custs.map((c) => ({ id: c._id, label: c.companyName, sub: c.customerId, path: `/dashboard/customers` }));
  }

  let sites: unknown[] = [];
  if (hasPermission(auth.role, "site.view")) {
    const siteDocs = await Site.find({ $or: [{ siteName: regex }, { siteId: regex }, { city: regex }] }).populate("customer", "companyName").limit(limit).lean();
    sites = siteDocs.map((s) => ({ id: (s as unknown as { _id: unknown })._id, label: (s as unknown as { siteName: string }).siteName, sub: `${(s as unknown as { siteId: string }).siteId} · ${((s.customer as unknown) as { companyName: string })?.companyName || ""}`, path: `/dashboard/sites` }));
  }

  let engineers: unknown[] = [];
  if (hasPermission(auth.role, "users.view") || hasPermission(auth.role, "users.manage")) {
    const engs = await User.find({ $or: [{ name: regex }, { employeeId: regex }, { email: regex }], role: "engineer" }).limit(limit).lean();
    engineers = engs.map((e) => ({ id: e._id, label: e.name, sub: e.employeeId || e.email, path: `/dashboard/users/${e._id}` }));
  }

  return NextResponse.json({ query: q, results: { serviceCalls, equipment, customers, sites, engineers } });
}
