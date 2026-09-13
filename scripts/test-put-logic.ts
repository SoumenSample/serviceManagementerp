import mongoose from 'mongoose';
import fs from 'fs';
import { AmcContract } from '../models/AmcContract';
import { amcUpdateSchema } from '../lib/validators';

const env = fs.readFileSync('.env.local','utf8');
const m = env.match(/MONGODB_URI=(.*)/);
const uri = m ? m[1].trim() : '';

async function run(){
  await mongoose.connect(uri);
  const id = '6aa4728bf2f122442d7351f4'; // AMC-2026-000002
  // Reset to 0 to simulate legacy
  await AmcContract.findByIdAndUpdate(id, {paidAmount: 0, paymentStatus: 'PARTIAL', contractAmount: 5000});
  console.log('reset to 0');
  let doc = await AmcContract.findById(id).lean() as any;
  console.log('after reset', {paid: doc.paidAmount, status: doc.paymentStatus});

  // Simulate frontend body
  const body = {
    amcType: 'COMPREHENSIVE',
    paymentStatus: 'PARTIAL',
    contractAmount: 5000,
    paidAmount: 3997,
    startDate: '2026-09-10',
    endDate: '2026-09-11',
    terms: 'all covered',
    status: 'ACTIVE'
  };
  console.log('body', body);
  const parsed = amcUpdateSchema.safeParse(body);
  console.log('parsed success', parsed.success);
  if (!parsed.success) console.log(JSON.stringify(parsed.error.flatten(), null, 2));
  else console.log('parsed data', parsed.data);

  // Simulate route logic
  const existing = await AmcContract.findById(id);
  console.log('existing before', {paid: existing!.paidAmount, amount: existing!.contractAmount});
  const newContractAmount = (parsed as any).data.contractAmount !== undefined ? (parsed as any).data.contractAmount : existing!.contractAmount;
  const newPaymentStatus = (parsed as any).data.paymentStatus || existing!.paymentStatus;
  let newPaidAmount = (parsed as any).data.paidAmount !== undefined ? Number((parsed as any).data.paidAmount) : (existing!.paidAmount ?? 0);
  console.log('newPaid', newPaidAmount, 'newContract', newContractAmount, 'newStatus', newPaymentStatus);
  if (newPaymentStatus === 'PAID') newPaidAmount = newContractAmount;
  if (newPaidAmount > newContractAmount) console.log('fail >');
  if (newPaymentStatus === 'PARTIAL' && (!newPaidAmount || newPaidAmount <=0 || newPaidAmount >= newContractAmount)) console.log('fail partial');
  Object.assign(existing!, {
    ...(parsed as any).data,
    ...( (parsed as any).data.startDate ? { startDate: new Date((parsed as any).data.startDate) } : {}),
    ...( (parsed as any).data.endDate ? { endDate: new Date((parsed as any).data.endDate) } : {}),
    paymentStatus: newPaymentStatus as any,
    paidAmount: newPaidAmount,
  });
  console.log('before save isModified', existing!.isModified('paidAmount'), (existing as any).paidAmount);
  await existing!.save();
  console.log('saved');
  const after = await AmcContract.findById(id).lean() as any;
  console.log('after', {paid: after.paidAmount, status: after.paymentStatus});

  // also test via direct API handler simulation with actual fetch? We'll just check DB
  await mongoose.disconnect();
}
run().catch(e=>{console.error(e);process.exit(1)});
