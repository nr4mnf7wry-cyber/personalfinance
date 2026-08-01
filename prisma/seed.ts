// Seeds the single user account (from .env) and their default category list,
// taken from Kevin's existing Excel structure. Run with `npm run seed`.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CATEGORIES } from "../src/lib/categories";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  const name = process.env.SEED_USER_NAME ?? "Moi";
  const currency = process.env.DEFAULT_CURRENCY ?? "EUR";

  if (!email || !password) {
    throw new Error(
      "SEED_USER_EMAIL et SEED_USER_PASSWORD doivent être définis (voir .env.example)"
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, currency },
    create: { email, passwordHash, name, currency },
  });

  for (const group of Object.keys(DEFAULT_CATEGORIES) as Array<
    keyof typeof DEFAULT_CATEGORIES
  >) {
    const names = DEFAULT_CATEGORIES[group];
    for (let i = 0; i < names.length; i++) {
      await prisma.categoryConfig.upsert({
        where: {
          userId_group_name: { userId: user.id, group, name: names[i] },
        },
        update: { order: i },
        create: { userId: user.id, group, name: names[i], order: i },
      });
    }
  }

  console.log(`Utilisateur créé/à jour: ${user.email}`);
  console.log(
    `Catégories créées: ${Object.values(DEFAULT_CATEGORIES).flat().length}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
