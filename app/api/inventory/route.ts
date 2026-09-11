import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { Inventory } from "@/models/Inventory";
import "@/models/Part";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "inventory.view") && !hasPermission(auth.role, "parts.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const low = searchParams.get("low");
  await connectDB();
  const items = await Inventory.find().populate("part", "partId partNumber name minimumStockLevel active").lean();
  const enriched = (items as unknown as { part: { minimumStockLevel: number }; quantityOnHand: number; quantityReserved: number }[]).map((i) => ({
    ...i,
    quantityAvailable: i.quantityOnHand - i.quantityReserved,
  })) as unknown as { quantityAvailable: number; part: { minimumStockLevel: number } }[];
  let filtered = enriched;
  if (low === "true") filtered = enriched.filter((i) => (i.quantityAvailable as number) <= (i.part as { minimumStockLevel: number }).minimumStockLevel);
  return NextResponse.json({ items: filtered });
}
