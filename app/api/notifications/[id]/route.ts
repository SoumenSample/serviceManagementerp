import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { Notification } from "@/models/Notification";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get("permanent") === "true";
  await connectDB();
  const notif = await Notification.findOne({ _id: id, recipientUser: auth.sub });
  if (!notif) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (permanent) {
    await Notification.findByIdAndDelete(id);
    return NextResponse.json({ ok: true, permanent: true });
  }
  if (notif.isDeleted) return NextResponse.json({ ok: true, alreadyDeleted: true });
  notif.isDeleted = true as never;
  notif.deletedAt = new Date() as never;
  await notif.save();
  return NextResponse.json({ ok: true, soft: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Restore soft-deleted
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.action !== "restore") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  await connectDB();
  const notif = await Notification.findOne({ _id: id, recipientUser: auth.sub });
  if (!notif) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!notif.isDeleted) return NextResponse.json({ ok: true, alreadyRestored: true });
  notif.isDeleted = false as never;
  notif.deletedAt = undefined as never;
  await notif.save();
  return NextResponse.json({ ok: true, restored: true });
}
