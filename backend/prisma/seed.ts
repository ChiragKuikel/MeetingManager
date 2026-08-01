import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Default Organization' },
  });

  await prisma.user.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      organizationId: org.id,
      email: 'dev@example.com',
      name: 'Default User',
      passwordHash: 'unused-pending-phase-4-auth',
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
