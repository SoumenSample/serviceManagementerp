import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth-server";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: auth });
}
