import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { Notification } from "@/models/Notification";

export async function POST() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  await Notification.updateMany({ recipientUser: auth.sub, isRead: false }, { $set: { isRead: true, readAt: new Date(), status: "READ" } });
  return NextResponse.json({ ok: true });
}
