const mongoose=require('mongoose');
const fs=require('fs');
const env=fs.readFileSync('.env.local','utf8');
const m=env.match(/MONGODB_URI=(.*)/);
const uri=m?m[1].trim():'';
async function run(){
  await mongoose.connect(uri);
  const col=mongoose.connection.db.collection('amccontracts');
  // Fix 000004 to 999 as per email
  await col.updateOne({amcId:'AMC-2026-000004'}, {$set:{paidAmount:999}});
  console.log('fixed 000004 to 999');
  // Fix 000003 PAID to 500
  await col.updateOne({amcId:'AMC-2026-000003'}, {$set:{paidAmount:500}});
  console.log('fixed 000003 to 500');
  // For 000002, keep 0 for now (user can edit)
  const docs=await col.find({}).project({amcId:1, paidAmount:1, contractAmount:1, paymentStatus:1}).toArray();
  console.log(docs.map(d=>({id:d.amcId, paid:d.paidAmount, amt:d.contractAmount, status:d.paymentStatus})));
  await mongoose.disconnect();
}
run();
