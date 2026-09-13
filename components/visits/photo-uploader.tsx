"use client";
import { useState } from "react";
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
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploaded({ url: data.url, publicId: data.publicId, fileName: file.name, resourceType: file.type });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed, retry");
    } finally { setUploading(false); e.target.value = ""; }
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
