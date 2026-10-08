import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { Content } from '../models/Content';
import { updateContent } from '../controllers/adminController';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/moviebuzz');
  const item = await Content.findOne();
  if (!item) {
    console.log('No item found');
    process.exit(0);
  }
  console.log('Testing item:', item._id, 'Title:', item.title, 'Current Type:', item.type);
  const targetType = item.type === 'movie' ? 'series' : 'movie';
  
  const req: any = {
    params: { id: item._id.toString() },
    body: { type: targetType, title: item.title }
  };
  const res: any = {
    json: (data: any) => console.log('Response JSON:', data),
    status: (code: number) => ({ json: (data: any) => console.log(`Status ${code}:`, data) })
  };

  await updateContent(req, res);

  const updatedItem = await Content.findById(item._id);
  console.log('After updateContent execution, DB Type:', updatedItem?.type);

  process.exit(0);
}

test();
