import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { Notification } from "@/models/Notification";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const skip = (page - 1) * limit;
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const deletedOnly = searchParams.get("deletedOnly") === "true";
  const base: Record<string, unknown> = { recipientUser: auth.sub };
  let filter: Record<string, unknown>;
  if (deletedOnly) filter = { ...base, isDeleted: true };
  else if (includeDeleted) filter = base;
  else filter = { ...base, isDeleted: { $ne: true } };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientUser: auth.sub, isRead: false, isDeleted: { $ne: true } }),
  ]);
  return NextResponse.json({ items, total, unread, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function DELETE(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const permanent = searchParams.get("permanent") === "true";
  const deletedOnly = searchParams.get("deletedOnly") === "true";

  // Single delete via ?id=xxx
  if (id) {
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

  // Bulk delete: all user's notifications (or only deleted for permanent purge)
  if (permanent) {
    const f: Record<string, unknown> = { recipientUser: auth.sub };
    if (deletedOnly) f.isDeleted = true;
    const res = await Notification.deleteMany(f);
    return NextResponse.json({ ok: true, permanent: true, deletedCount: res.deletedCount });
  }
  // soft delete all non-deleted
  const res = await Notification.updateMany({ recipientUser: auth.sub, isDeleted: { $ne: true } }, { $set: { isDeleted: true, deletedAt: new Date() } });
  return NextResponse.json({ ok: true, soft: true, modifiedCount: res.modifiedCount });
}
