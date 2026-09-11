import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { hasPermission } from "@/lib/rbac";
import { PartRequest } from "@/models/PartRequest";
import { Inventory } from "@/models/Inventory";
import { StockMovement } from "@/models/StockMovement";
import { partRequestStatusSchema } from "@/lib/validators";
import { isValidPartTransition } from "@/lib/part-request-helpers";
import { genMovementId } from "@/lib/id-generators";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = partRequestStatusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const { id } = await params;
  const pr = await PartRequest.findById(id);
  if (!pr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const from = pr.status;
  const to = parsed.data.status as typeof from;
  if (from === to) return NextResponse.json({ error: "Already in this status" }, { status: 400 });
  if (!isValidPartTransition(from, to)) return NextResponse.json({ error: `Invalid transition ${from}→${to}` }, { status: 400 });

  // Permissions per transition
  if (to === "REQUESTED" && !hasPermission(auth.role, "parts.request") && !hasPermission(auth.role, "partRequest.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (to === "APPROVED" && !hasPermission(auth.role, "parts.approve") && !hasPermission(auth.role, "partRequest.approve")) return NextResponse.json({ error: "Forbidden approve" }, { status: 403 });
  if (to === "DISPATCHED" && !hasPermission(auth.role, "parts.dispatch") && !hasPermission(auth.role, "partRequest.dispatch")) return NextResponse.json({ error: "Forbidden dispatch" }, { status: 403 });
  if (to === "RECEIVED" && !hasPermission(auth.role, "parts.receive") && !hasPermission(auth.role, "partRequest.receive")) return NextResponse.json({ error: "Forbidden receive" }, { status: 403 });
  if (to === "USED" && !hasPermission(auth.role, "parts.receive") && !hasPermission(auth.role, "partRequest.use")) {
    // Allow engineer to mark USED if they are requester? But use inventory.issue permission
    if (!hasPermission(auth.role, "inventory.issue") && auth.role !== "engineer") return NextResponse.json({ error: "Forbidden use" }, { status: 403 });
  }

  // Idempotency: already in target state handled above

  // Inventory operations - atomic
  if (to === "APPROVED") {
    // Reserve stock: quantityReserved += quantity atomically if available
    const inv = await Inventory.findOne({ part: pr.part });
    if (!inv) return NextResponse.json({ error: "Inventory not found for part" }, { status: 400 });
    const available = inv.quantityOnHand - inv.quantityReserved;
    if (available < pr.quantity) return NextResponse.json({ error: `Insufficient stock. Available ${available}` }, { status: 400 });
    const updated = await Inventory.findOneAndUpdate(
      { _id: inv._id, $expr: { $gte: [{ $subtract: ["$quantityOnHand", "$quantityReserved"] }, pr.quantity] } },
      { $inc: { quantityReserved: pr.quantity } },
      { new: true }
    );
    if (!updated) return NextResponse.json({ error: "Insufficient stock (race)" }, { status: 400 });
    const mid = await genMovementId();
    await StockMovement.create({ movementId: mid, part: pr.part, inventory: inv._id, movementType: "RESERVE", quantity: pr.quantity, referenceType: "PartRequest", referenceId: pr.requestId, partRequest: pr._id, serviceCall: pr.serviceCall, serviceVisit: pr.serviceVisit, performedBy: auth.sub, remarks: parsed.data.remarks });
    pr.approvedBy = auth.sub as never;
    pr.approvedAt = new Date();
  } else if (to === "DISPATCHED") {
    // No stock change yet, just mark dispatched
    pr.dispatchedBy = auth.sub as never;
    pr.dispatchedAt = new Date();
  } else if (to === "RECEIVED") {
    // Release reserved, keep onHand same? Actually received means physical arrival at site, reserve can stay or move? We keep reserved until USED.
    // No inventory math for RECEIVED per spec (not auto consume)
    pr.receivedBy = auth.sub as never;
    pr.receivedAt = new Date();
  } else if (to === "USED") {
    // Consume: onHand -= quantity, reserved -= quantity atomically, prevent negative
    const inv = await Inventory.findOne({ part: pr.part });
    if (!inv) return NextResponse.json({ error: "Inventory not found" }, { status: 400 });
    // Ensure reserved >= quantity and onHand >= quantity
    const res = await Inventory.findOneAndUpdate(
      { _id: inv._id, quantityReserved: { $gte: pr.quantity }, quantityOnHand: { $gte: pr.quantity } },
      { $inc: { quantityOnHand: -pr.quantity, quantityReserved: -pr.quantity } },
      { new: true }
    );
    if (!res) return NextResponse.json({ error: "Insufficient reserved/onHand for use" }, { status: 400 });
    const mid = await genMovementId();
    await StockMovement.create({ movementId: mid, part: pr.part, inventory: inv._id, movementType: "OUT", quantity: pr.quantity, referenceType: "PartRequest", referenceId: pr.requestId, partRequest: pr._id, serviceCall: pr.serviceCall, serviceVisit: pr.serviceVisit, performedBy: auth.sub, remarks: parsed.data.remarks });
    pr.usedBy = auth.sub as never;
    pr.usedAt = new Date();
  } else if (to === "REJECTED" || to === "CANCELLED") {
    // If was APPROVED, release reserved
    if (from === "APPROVED" || from === "DISPATCHED") {
      const inv = await Inventory.findOne({ part: pr.part });
      if (inv) {
        await Inventory.findByIdAndUpdate(inv._id, { $inc: { quantityReserved: -pr.quantity } });
        const mid = await genMovementId();
        await StockMovement.create({ movementId: mid, part: pr.part, inventory: inv._id, movementType: "RELEASE", quantity: pr.quantity, referenceType: "PartRequest", referenceId: pr.requestId, partRequest: pr._id, performedBy: auth.sub, remarks: parsed.data.rejectionReason || parsed.data.remarks });
      }
    }
    pr.rejectionReason = parsed.data.rejectionReason;
  }

  if (to === "REQUESTED") pr.requestedAt = new Date();

  pr.status = to;
  if (parsed.data.remarks) pr.remarks = parsed.data.remarks;
  await pr.save();
  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: to === "APPROVED" ? "APPROVE" : to === "REJECTED" ? "REJECT" : to === "CANCELLED" ? "CANCEL" : "STATUS_CHANGE",
    module: "PART_REQUEST",
    recordId: pr.requestId,
    recordObjectId: String(pr._id),
    recordType: "PartRequest",
    description: `Part request ${pr.requestId} status changed from ${from} to ${to}`,
    before: { status: from } as unknown as Record<string, unknown>,
    after: { status: to } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});

  // Notifications: PARTS_REQUIRED / PARTS_RECEIVED (observe, not control)
  try {
    const { notify } = await import("@/lib/notifications/notification-service");
    if (to === "REQUESTED" || to === "REQUIRED") {
      const { User } = await import("@/models/User");
      const staff = await User.find({ role: { $in: ["manager", "coordinator"] }, isActive: true }).select("_id").lean();
      for (const u of staff) notify({ eventType: "PARTS_REQUIRED", channel: "IN_APP", title: "Parts Required", message: `${pr.requestId} requires ${pr.quantity} units`, recipientUser: String(u._id), relatedModule: "PartRequest", relatedRecordId: String(pr._id), serviceCall: String(pr.serviceCall), dedupKey: `PARTS_REQUIRED:${pr._id}:IN_APP:${u._id}` }).catch(() => {});
      if (pr.serviceCall) {
        const sc = await (await import("@/models/ServiceCall")).ServiceCall.findById(pr.serviceCall);
        if (sc?.assignedEngineer) notify({ eventType: "PARTS_REQUIRED", channel: "IN_APP", title: "Parts Required", message: `${pr.requestId} parts required`, recipientUser: String(sc.assignedEngineer), relatedModule: "PartRequest", relatedRecordId: String(pr._id), serviceCall: String(pr.serviceCall), dedupKey: `PARTS_REQUIRED:${pr._id}:IN_APP:${sc.assignedEngineer}` }).catch(() => {});
      }
    }
    if (to === "RECEIVED") {
      const sc = await (await import("@/models/ServiceCall")).ServiceCall.findById(pr.serviceCall);
      if (sc?.assignedEngineer) notify({ eventType: "PARTS_RECEIVED", channel: "IN_APP", title: "Parts Received", message: `${pr.requestId} received`, recipientUser: String(sc.assignedEngineer), relatedModule: "PartRequest", relatedRecordId: String(pr._id), serviceCall: String(pr.serviceCall), dedupKey: `PARTS_RECEIVED:${pr._id}:IN_APP:${sc.assignedEngineer}` }).catch(() => {});
    }
  } catch {}

  return NextResponse.json(pr);
}
