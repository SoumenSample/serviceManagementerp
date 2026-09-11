import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { StockMovement } from "@/models/StockMovement";
import "@/models/Part";
import "@/models/User";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "inventory.view") && !hasPermission(auth.role, "parts.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const part = searchParams.get("part");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (part) filter.part = part;
  const [items, total] = await Promise.all([
    StockMovement.find(filter).populate("part", "partId partNumber name").populate("performedBy", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    StockMovement.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}
