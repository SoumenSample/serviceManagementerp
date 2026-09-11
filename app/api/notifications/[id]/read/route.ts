import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { Notification } from "@/models/Notification";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await connectDB();
  const notif = await Notification.findById(id);
  if (!notif) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (String(notif.recipientUser) !== String(auth.sub)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  notif.isRead = true;
  notif.readAt = new Date();
  notif.status = "READ";
  await notif.save();
  return NextResponse.json({ ok: true });
}
