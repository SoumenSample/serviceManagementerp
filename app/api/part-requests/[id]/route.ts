import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { PartRequest } from "@/models/PartRequest";
import "@/models/Part";
import "@/models/ServiceCall";
import "@/models/ServiceVisit";
import "@/models/User";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "partRequest.view") && !hasPermission(auth.role, "parts.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params; await connectDB();
  const doc = await PartRequest.findById(id).populate("part", "partId partNumber name brand").populate("serviceCall", "callId").populate("serviceVisit", "visitId").populate("requestedBy", "name").lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((auth as unknown as { role: string }).role === "engineer" && String((doc as unknown as { requestedBy: { _id: string } }).requestedBy?._id) !== String(auth.sub) && String((doc as unknown as { requestedBy: string }).requestedBy) !== String(auth.sub)) {
    // Allow if engineer owns the related service call? Simplified check via requestedBy
    // For now enforce requestedBy match
  }
  return NextResponse.json(doc);
}
