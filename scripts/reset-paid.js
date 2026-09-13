const mongoose=require('mongoose');
const fs=require('fs');
const env=fs.readFileSync('.env.local','utf8');
const m=env.match(/MONGODB_URI=(.*)/);
const uri=m?m[1].trim():'';
async function run(){
  await mongoose.connect(uri);
  const col=mongoose.connection.db.collection('amccontracts');
  const res=await col.updateOne({amcId:'AMC-2026-000002'}, {$set:{paidAmount:0}});
  console.log('updated',res.modifiedCount);
  const doc=await col.findOne({amcId:'AMC-2026-000002'});
  console.log('now',doc.paidAmount);
  await mongoose.disconnect();
}
run();
