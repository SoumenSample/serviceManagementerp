import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth-server";
import { cloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "ups-system/misc";
  const dataUrl = formData.get("dataUrl") as string | null;

  if (!file && !dataUrl) return NextResponse.json({ error: "file or dataUrl required" }, { status: 400 });

  // Validate folder prefix for security — must start with ups-system/
  if (!folder.startsWith("ups-system/")) return NextResponse.json({ error: "Invalid folder prefix. Must start with ups-system/" }, { status: 400 });
  if (folder.includes("..")) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
  }

  try {
    let uploadStr: string;
    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      // Validate size 5MB
      if (buffer.length > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large >5MB" }, { status: 400 });
      const mime = file.type || "image/jpeg";
      uploadStr = `data:${mime};base64,${buffer.toString("base64")}`;
    } else {
      // dataUrl e.g. data:image/png;base64,...
      uploadStr = dataUrl!;
      if (!uploadStr.startsWith("data:")) return NextResponse.json({ error: "Invalid dataUrl" }, { status: 400 });
    }

    const result = await cloudinary.uploader.upload(uploadStr, {
      folder,
      resource_type: "auto",
    });

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      folder,
      bytes: result.bytes,
      format: result.format,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Cloudinary upload failed: " + msg }, { status: 500 });
  }
}
