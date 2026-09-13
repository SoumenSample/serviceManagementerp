import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuth } from "@/lib/auth-server";
import { hasPermission } from "@/lib/rbac";
import { AmcContract } from "@/models/AmcContract";
import { createAuditLog, extractRequestMeta } from "@/lib/audit/audit-service";
import { cloudinary } from "@/lib/cloudinary";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "amc.edit") && !hasPermission(auth.role, "amc.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const { url, publicId, fileName, resourceType } = body as { url: string; publicId: string; fileName: string; resourceType: string };
  if (!url || !publicId || !fileName) return NextResponse.json({ error: "url, publicId, fileName required" }, { status: 400 });
  await connectDB();
  const doc = await AmcContract.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const expectedPrefix = `ups-system/amc/${doc.amcId}/`;
  if (!publicId.startsWith(expectedPrefix)) return NextResponse.json({ error: `Invalid folder. Expected prefix ${expectedPrefix}` }, { status: 400 });
  if (publicId.includes("..")) return NextResponse.json({ error: "Invalid publicId" }, { status: 400 });

  doc.documents.push({
    url,
    publicId,
    fileName,
    resourceType: resourceType || "auto",
    uploadedBy: auth.sub as never,
    uploadedAt: new Date(),
  });
  await doc.save();

  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "UPDATE",
    module: "AMC",
    recordId: doc.amcId,
    recordObjectId: String(doc._id),
    recordType: "AmcContract",
    description: `AMC document ${fileName} uploaded`,
    after: { publicId, fileName } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});

  return NextResponse.json(doc);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth.role, "amc.edit") && !hasPermission(auth.role, "amc.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const publicId = searchParams.get("publicId");
  if (!publicId) return NextResponse.json({ error: "publicId required" }, { status: 400 });
  await connectDB();
  const doc = await AmcContract.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const before = doc.documents.length;
  doc.documents = doc.documents.filter((d) => d.publicId !== publicId) as never;
  if (doc.documents.length === before) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  await doc.save();

  // Try to delete from Cloudinary (best effort)
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {}

  createAuditLog({
    actorId: auth.sub,
    actorEmail: auth.email,
    actorName: auth.name,
    actorRole: auth.role,
    action: "UPDATE",
    module: "AMC",
    recordId: doc.amcId,
    recordObjectId: String(doc._id),
    recordType: "AmcContract",
    description: `AMC document ${publicId} deleted`,
    before: { publicId } as unknown as Record<string, unknown>,
    metadata: extractRequestMeta(req) as Record<string, unknown>,
  }).catch(() => {});

  return NextResponse.json(doc);
}
