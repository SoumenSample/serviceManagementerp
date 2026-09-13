import mongoose from 'mongoose';
import fs from 'fs';
import { AmcContract } from '../models/AmcContract';

const env = fs.readFileSync('.env.local','utf8');
const m = env.match(/MONGODB_URI=(.*)/);
const uri = m ? m[1].trim() : '';
async function run(){
  await mongoose.connect(uri);
  const doc = await AmcContract.findOne({amcId:'AMC-2026-000002'}).lean() as any;
  console.log('current', {paid: doc.paidAmount, amount: doc.contractAmount, status: doc.paymentStatus, id: doc._id});
  await mongoose.disconnect();
}
run().catch(e=>{console.error(e);process.exit(1)});
