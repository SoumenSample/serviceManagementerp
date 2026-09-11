// Run with: npx tsx scripts/seed.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import bcrypt from "bcryptjs";
import { connectDB } from "../lib/db";
import { User } from "../models/User";

async function main() {
  await connectDB();
  const email = process.env.SEED_EMAIL || "admin@gmail.com";
  const password = process.env.SEED_PASSWORD || "admin123";
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    console.log(`User ${email} already exists`);
    process.exit(0);
  }
  const hash = await bcrypt.hash(password, 10);
  await User.create({
    name: "Super Admin",
    email: email.toLowerCase(),
    passwordHash: hash,
    role: "super_admin",
    employeeId: "EMP-001",
    designation: "Super Admin",
    isActive: true,
  });
  console.log(`Seeded super_admin: ${email} / ${password}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
