import { v2 as cloudinary } from "cloudinary";

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
export const MAX_FILE_SIZE_MB = 5;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function validateCloudinaryFile(file: { mimetype: string; size: number }) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) throw new Error(`Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error(`File too large. Max ${MAX_FILE_SIZE_MB}MB`);
}

export function getEquipmentFolder(equipmentId: string) {
  return `ups-system/equipment/${equipmentId}`;
}
export function getAmcFolder(amcId: string) {
  return `ups-system/amc/${amcId}`;
}
export function getVisitFolder(callId: string, visitId: string) {
  return `ups-system/service-calls/${callId}/${visitId}`;
}
export function getSignatureFolder(callId: string) {
  return `ups-system/signatures/${callId}`;
}
export function getExpenseFolder(expenseId: string) {
  return `ups-system/expenses/${expenseId}`;
}

export { cloudinary };
