"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type PhotoMeta = { url: string; publicId: string; fileName?: string; resourceType?: string };

export function PhotoUploader({ label, folder, onUploaded }: { label: string; folder: string; onUploaded: (meta: PhotoMeta) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) { setError(`Invalid type ${file.type}. Allowed JPG/JPEG/PNG/WEBP only — PDF not allowed for visit photos`); return; }
    if (file.size > MAX_FILE_SIZE_BYTES) { setError(`File too large ${(file.size / 1024 / 1024).toFixed(1)}MB >5MB`); return; }
    setUploading(true);
    // Try real Cloudinary upload if configured, else fallback to local object URL for demo
    try {
      // Client-side unsigned upload would require preset; for now simulate success
      // In production, POST to /api/upload with file
      await new Promise((r) => setTimeout(r, 800));
      const publicId = `${folder}/${Date.now()}-${file.name}`;
      // Use object URL as preview URL — in production this would be secure_url from Cloudinary
      const url = URL.createObjectURL(file);
      onUploaded({ url, publicId, fileName: file.name, resourceType: file.type });
    } catch (err) {
      setError("Upload failed, retry");
    } finally { setUploading(false); }
  }

  return (
    <div className="border rounded-md p-3 space-y-2">
      <p className="text-sm font-medium">{label} <span className="text-xs text-muted-foreground">JPG/JPEG/PNG/WEBP ≤5MB → {folder}</span></p>
      <Input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={onFile} disabled={uploading} />
      {uploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
