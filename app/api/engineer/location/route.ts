import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { EngineerShift } from "@/models/EngineerShift";
import { EngineerLocation } from "@/models/EngineerLocation";
import { reverseGeocode } from "@/lib/location/reverse-geocode";
import { z } from "zod";

const schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
});

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "engineer") return NextResponse.json({ error: "Only engineers can update location" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  await connectDB();
  const shift = await EngineerShift.findOne({ engineer: auth.sub, status: "ACTIVE" });
  if (!shift) return NextResponse.json({ error: "No active shift. Start shift first." }, { status: 400 });

  const { latitude, longitude, accuracy } = parsed.data;

  // Reverse geocode — failure should not block storage
  let geo = null;
  try {
    geo = await reverseGeocode(latitude, longitude);
  } catch {
    geo = null;
  }

  const loc = await EngineerLocation.create({
    engineer: auth.sub,
    shift: shift._id,
    latitude,
    longitude,
    accuracy,
    address: geo?.address,
    city: geo?.city,
    state: geo?.state,
    country: geo?.country,
    postalCode: geo?.postalCode,
    capturedAt: new Date(),
  });

  // Update shift latest location (fast retrieval)
  shift.lastLocationAt = new Date();
  shift.lastLatitude = latitude;
  shift.lastLongitude = longitude;
  shift.lastAccuracy = accuracy;
  shift.lastAddress = geo?.address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  await shift.save();

  return NextResponse.json({ location: loc, shift }, { status: 201 });
}

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "engineer") return NextResponse.json({ error: "Only engineers" }, { status: 403 });
  await connectDB();
  const shift = await EngineerShift.findOne({ engineer: auth.sub, status: "ACTIVE" }).lean();
  if (!shift) return NextResponse.json({ shift: null, location: null });
  const loc = await EngineerLocation.findOne({ engineer: auth.sub, shift: shift._id }).sort({ capturedAt: -1 }).lean();
  return NextResponse.json({ shift, location: loc });
}
