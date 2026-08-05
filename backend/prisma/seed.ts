import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEV_PASSWORD = 'devpassword123';

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Default Organization' },
  });

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  await prisma.user.upsert({
    where: { id: 1 },
    update: { passwordHash },
    create: {
      id: 1,
      organizationId: org.id,
      email: 'dev@example.com',
      name: 'Default User',
      passwordHash,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
