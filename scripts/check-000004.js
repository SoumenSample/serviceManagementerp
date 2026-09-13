const mongoose=require('mongoose');
const fs=require('fs');
const env=fs.readFileSync('.env.local','utf8');
const m=env.match(/MONGODB_URI=(.*)/);
const uri=m?m[1].trim():'';
async function run(){
  await mongoose.connect(uri);
  const col=mongoose.connection.db.collection('amccontracts');
  const doc=await col.findOne({amcId:'AMC-2026-000004'});
  console.log(doc ? {amcId:doc.amcId, paid:doc.paidAmount, amount:doc.contractAmount, status:doc.paymentStatus, paidType: typeof doc.paidAmount} : 'not found');
  const all=await col.find({}).project({amcId:1, paidAmount:1, contractAmount:1, paymentStatus:1}).toArray();
  console.log(all.map(d=>({id:d.amcId, paid:d.paidAmount, amt:d.contractAmount, status:d.paymentStatus})));
  await mongoose.disconnect();
}
run();
