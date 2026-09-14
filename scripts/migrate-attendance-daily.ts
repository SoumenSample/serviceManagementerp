import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "E:/csw/espsoln/.env.local" });

function getISTDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

async function main() {
  const uri = process.env.MONGODB_URI!;
  const dbName = process.env.MONGODB_DB;
  await mongoose.connect(uri, { dbName });
  const db = mongoose.connection.db!;
  const coll = db.collection("attendances");

  console.log("=== BEFORE MIGRATION ===");
  const all = await coll.find({}).sort({ createdAt: 1 }).toArray();
  console.log(`Total docs: ${all.length}`);
  for (const d of all) {
    console.log(`${d.attendanceId} user=${d.user} startedAt=${d.startedAt?.toISOString()} attendanceDate=${d.attendanceDate} sessions=${JSON.stringify(d.sessions)} status=${d.status}`);
  }

  const indexesBefore = await coll.indexes();
  console.log("Indexes before:", JSON.stringify(indexesBefore, null, 2));

  // Step 1: Backfill attendanceDate and sessions for old records
  console.log("\n=== BACKFILL attendanceDate & sessions ===");
  for (const doc of all) {
    const updates: any = {};
    if (!doc.attendanceDate) {
      const dateStr = doc.startedAt ? getISTDateString(new Date(doc.startedAt)) : getISTDateString(new Date(doc.createdAt));
      updates.attendanceDate = dateStr;
      console.log(`Backfill ${doc.attendanceId} -> attendanceDate=${dateStr}`);
    }
    if (!doc.sessions || doc.sessions.length === 0) {
      // Create sessions from startedAt/endedAt
      if (doc.startedAt) {
        const sess: any = { loginAt: new Date(doc.startedAt) };
        if (doc.endedAt) sess.logoutAt = new Date(doc.endedAt);
        else if (doc.status === "ENDED" && doc.lastActivityAt) sess.logoutAt = new Date(doc.lastActivityAt);
        updates.sessions = [sess];
        console.log(`Backfill ${doc.attendanceId} -> sessions=${JSON.stringify(updates.sessions)}`);
      }
    }
    if (Object.keys(updates).length > 0) {
      await coll.updateOne({ _id: doc._id }, { $set: updates });
    }
  }

  // Step 2: Find duplicates per user+attendanceDate and merge
  console.log("\n=== FIND DUPLICATES ===");
  const dupGroups = await coll.aggregate([
    { $match: { attendanceDate: { $exists: true } } },
    { $group: { _id: { user: "$user", attendanceDate: "$attendanceDate" }, count: { $sum: 1 }, docs: { $push: "$$ROOT" } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  console.log(`Found ${dupGroups.length} duplicate groups`);

  for (const group of dupGroups) {
    const docs: any[] = group.docs.sort((a: any, b: any) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    const canonical = docs[0];
    const duplicates = docs.slice(1);
    console.log(`\nMerging group user=${group._id.user} date=${group._id.attendanceDate} canonical=${canonical.attendanceId} duplicates=${duplicates.map((d) => d.attendanceId).join(",")}`);

    // Merge sessions chronologically
    const allSessions: any[] = [];
    for (const d of docs) {
      if (d.sessions && d.sessions.length > 0) {
        for (const s of d.sessions) allSessions.push({ loginAt: new Date(s.loginAt), logoutAt: s.logoutAt ? new Date(s.logoutAt) : undefined });
      } else if (d.startedAt) {
        allSessions.push({ loginAt: new Date(d.startedAt), logoutAt: d.endedAt ? new Date(d.endedAt) : undefined });
      }
    }
    allSessions.sort((a, b) => a.loginAt.getTime() - b.loginAt.getTime());

    // Recalc fields
    const startedAt = allSessions[0]?.loginAt || canonical.startedAt;
    const lastSess = allSessions[allSessions.length - 1];
    const hasOpen = !lastSess?.logoutAt;
    const lastLogout = hasOpen ? undefined : lastSess?.logoutAt;
    const endedAt = hasOpen ? undefined : lastLogout;
    const status = hasOpen ? "ACTIVE" : "ENDED";
    const lastActivityAt = hasOpen ? lastSess.loginAt : lastLogout || canonical.lastActivityAt;

    console.log(`Merged sessions: ${JSON.stringify(allSessions.map((s) => ({ loginAt: s.loginAt.toISOString(), logoutAt: s.logoutAt?.toISOString() })))}`);
    console.log(`Canonical update: startedAt=${startedAt?.toISOString()} endedAt=${endedAt?.toISOString()} status=${status} sessions=${allSessions.length}`);

    const updateSet: any = {
      sessions: allSessions,
      startedAt,
      status,
      lastActivityAt: lastActivityAt || new Date(),
      attendanceDate: group._id.attendanceDate,
    };
    if (endedAt) updateSet.endedAt = endedAt;
    const updateOp: any = { $set: updateSet };
    if (hasOpen) updateOp.$unset = { endedAt: "" };

    await coll.updateOne({ _id: canonical._id }, updateOp);

    // Delete duplicates after merge
    for (const dup of duplicates) {
      console.log(`Deleting duplicate ${dup.attendanceId}`);
      await coll.deleteOne({ _id: dup._id });
    }
  }

  // Step 3: Create unique index
  console.log("\n=== CREATE UNIQUE INDEX ===");
  try {
    await coll.createIndex({ user: 1, attendanceDate: 1 }, { unique: true, sparse: true });
    console.log("Created index user_1_attendanceDate_1");
  } catch (e: any) {
    console.log("Index creation error:", e.message);
    if (e.message.includes("duplicate")) {
      console.log("Still duplicates exist, re-checking...");
      const dup2 = await coll.aggregate([
        { $match: { attendanceDate: { $exists: true } } },
        { $group: { _id: { user: "$user", attendanceDate: "$attendanceDate" }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ]).toArray();
      console.log(JSON.stringify(dup2, null, 2));
    }
  }

  const indexesAfter = await coll.indexes();
  console.log("Indexes after:", JSON.stringify(indexesAfter, null, 2));

  const finalDocs = await coll.find({}).sort({ attendanceDate: -1, startedAt: -1 }).toArray();
  console.log("\n=== FINAL DOCS ===");
  for (const d of finalDocs) {
    console.log(`${d.attendanceId} user=${d.user} date=${d.attendanceDate} sessions=${JSON.stringify(d.sessions)} status=${d.status} startedAt=${d.startedAt?.toISOString()} endedAt=${d.endedAt?.toISOString()}`);
  }

  await mongoose.disconnect();
  console.log("Done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
