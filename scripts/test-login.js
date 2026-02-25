const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

(async function(){
  const prisma = new PrismaClient();
  try{
    const u = await prisma.user.findUnique({ where:{ email:'admin@arzesh.com' } });
    console.log('user:', u && { id: u.id, email: u.email, passwordPresent: !!u.password });
    if(u){
      const ok = await bcrypt.compare('admin123', u.password || '');
      console.log('password match?', ok);
    }
  } catch(e){
    console.error('error', e.message);
  } finally{
    await prisma.$disconnect();
  }
})();
