const mongoose = require('mongoose');
const fs = require('fs');
const env = fs.readFileSync('.env.local','utf8');
const m = env.match(/MONGODB_URI=(.*)/);
const uri = m ? m[1].trim() : '';
async function run(){
  await mongoose.connect(uri);
  console.log('connected');
  // use mongoose model directly
  const AmcContract = mongoose.model('AmcContract', new mongoose.Schema({}, {strict:false}), 'amccontracts');
  const count = await AmcContract.countDocuments();
  console.log('count',count);
  const one = await AmcContract.findOne({paymentStatus:'PARTIAL'});
  console.log('partial', one ? {id:String(one._id), amcId:one.amcId, paid:one.paidAmount, amount:one.contractAmount, status:one.paymentStatus} : 'none');
  const any = await AmcContract.findOne().lean();
  console.log('any', any ? {amcId:any.amcId, paid:any.paidAmount, status:any.paymentStatus, amount:any.contractAmount, paidType: typeof any.paidAmount} : 'none');
  // try update
  if (one) {
    const id = one._id;
    console.log('trying update paidAmount to 1234');
    const updated = await AmcContract.findByIdAndUpdate(id, {paidAmount:1234}, {new:true});
    console.log('after update', {paid: updated.paidAmount});
    // revert
    await AmcContract.findByIdAndUpdate(id, {paidAmount: one.paidAmount});
    console.log('reverted');
  }
  await mongoose.disconnect();
  process.exit(0);
}
run().catch(e=>{console.error(e);process.exit(1)});
