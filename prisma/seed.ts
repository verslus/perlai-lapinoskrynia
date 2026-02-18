import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function makeQuestions(total: number) {
  const dimensions = ["sleep_hygiene", "anxiety", "fatigue", "routine"];
  return Array.from({ length: total }, (_, i) => ({
    questionOrder: i + 1,
    text: `Klausimas ${i + 1}: kaip dažnai tai patiriate?`,
    dimension: dimensions[i % dimensions.length],
    isReverse: i % 7 === 0
  }));
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@testu.lt";
  const consultantEmail = process.env.SEED_CONSULTANT_EMAIL ?? "konsultantas@testu.lt";
  const password = process.env.SEED_DEFAULT_PASSWORD ?? "ChangeMe123!";
  const hash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: hash, role: Role.ADMIN },
    create: { email: adminEmail, passwordHash: hash, role: Role.ADMIN }
  });

  await prisma.user.upsert({
    where: { email: consultantEmail },
    update: { passwordHash: hash, role: Role.CONSULTANT },
    create: { email: consultantEmail, passwordHash: hash, role: Role.CONSULTANT }
  });

  const test = await prisma.test.upsert({
    where: { slug: "miegas-116" },
    update: {},
    create: { slug: "miegas-116" }
  });

  const existing = await prisma.testVersion.findFirst({
    where: { testId: test.id, version: 1, language: "lt" }
  });

  if (!existing) {
    await prisma.testVersion.create({
      data: {
        testId: test.id,
        version: 1,
        language: "lt",
        title: "Miego kokybės testas (116)",
        description: "Likert skalės klausimynas savęs įsivertinimui.",
        scoringConfigJson: {
          min: 1,
          max: 5,
          thresholds: {
            low: 2.4,
            medium: 3.7
          }
        },
        questions: {
          createMany: {
            data: makeQuestions(116)
          }
        }
      }
    });
  }

  console.log("Seed baigtas.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
