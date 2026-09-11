import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { Notification } from "@/models/Notification";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const count = await Notification.countDocuments({ recipientUser: auth.sub, isRead: false });
  return NextResponse.json({ count });
}
