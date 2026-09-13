const mongoose = require('mongoose');
const fs = require('fs');
const env = fs.readFileSync('.env.local','utf8');
const m = env.match(/MONGODB_URI=(.*)/);
const uri = m ? m[1].trim() : '';
async function run(){
  await mongoose.connect(uri);
  const AmcContract = mongoose.model('AmcContract', new mongoose.Schema({}, {strict:false}), 'amccontracts');
  // Find AMC-2026-000002
  const doc = await AmcContract.findOne({amcId:'AMC-2026-000002'});
  console.log('before', {amcId:doc.amcId, paid:doc.paidAmount, amount:doc.contractAmount, status:doc.paymentStatus, id:String(doc._id)});
  // Simulate PUT logic as in route
  const body = {amcType: doc.amcType, paymentStatus:'PARTIAL', contractAmount:5000, paidAmount:3997, startDate:'2026-09-10', endDate:'2026-09-11'};
  // Simulate Zod parsing (just use body)
  const parsed = {data: body};
  const existing = await AmcContract.findById(doc._id);
  console.log('existing before', {paid:existing.paidAmount});
  const newContractAmount = parsed.data.contractAmount !== undefined ? parsed.data.contractAmount : existing.contractAmount;
  const newPaymentStatus = parsed.data.paymentStatus || existing.paymentStatus;
  let newPaidAmount = parsed.data.paidAmount !== undefined ? Number(parsed.data.paidAmount) : (existing.paidAmount ?? 0);
  console.log('newPaid', newPaidAmount, 'newContract', newContractAmount, 'newStatus', newPaymentStatus);
  if (newPaymentStatus === 'PAID') newPaidAmount = newContractAmount;
  if (newPaidAmount > newContractAmount) console.log('fail paid > contract');
  if (newPaymentStatus === 'PARTIAL' && (!newPaidAmount || newPaidAmount <=0 || newPaidAmount >= newContractAmount)) console.log('fail partial validation');
  Object.assign(existing, {
    ...parsed.data,
    ...(parsed.data.startDate ? { startDate: new Date(parsed.data.startDate) } : {}),
    ...(parsed.data.endDate ? { endDate: new Date(parsed.data.endDate) } : {}),
    paymentStatus: newPaymentStatus,
    paidAmount: newPaidAmount,
  });
  console.log('before save', {paid:existing.paidAmount, isModified: existing.isModified('paidAmount')});
  await existing.save();
  console.log('saved');
  const after = await AmcContract.findById(doc._id).lean();
  console.log('after', {paid:after.paidAmount, status:after.paymentStatus});
  // revert to 0 for test
  // await AmcContract.findByIdAndUpdate(doc._id, {paidAmount:0});
  // console.log('reverted');
  await mongoose.disconnect();
}
run().catch(e=>{console.error(e);process.exit(1)});
