import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(){
  try{
    const res = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'ordenitem' AND column_name = 'detalles'`);
    const count = Array.isArray(res) && res.length ? Number(res[0].c || res[0].C) : 0;
    if(count > 0){
      console.log('Column detalles already exists.');
    } else {
      console.log('Adding column detalles to ordenitem...');
      await prisma.$executeRawUnsafe('ALTER TABLE ordenitem ADD COLUMN detalles TEXT NULL');
      console.log('Column added successfully.');
    }
  } catch(e){
    console.error('Error while adding column:', e.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
