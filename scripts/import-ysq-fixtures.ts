import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Fixture = {
  slug: string;
  version: number;
  language: string;
  title: string;
  description: string;
  scoringConfigJson: unknown;
  questions: Array<{
    order: number;
    text: string;
    dimension: string;
    isReverse: boolean;
  }>;
};

async function loadFixture(fileName: string): Promise<Fixture> {
  const fullPath = path.join(process.cwd(), "prisma", "fixtures", fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw) as Fixture;
}

async function upsertFixture(fixture: Fixture) {
  const test = await prisma.test.upsert({
    where: { slug: fixture.slug },
    update: {},
    create: { slug: fixture.slug }
  });

  const existing = await prisma.testVersion.findUnique({
    where: {
      testId_version_language: {
        testId: test.id,
        version: fixture.version,
        language: fixture.language
      }
    }
  });

  if (existing) {
    await prisma.question.deleteMany({ where: { testVersionId: existing.id } });
    await prisma.testVersion.update({
      where: { id: existing.id },
      data: {
        title: fixture.title,
        description: fixture.description,
        scoringConfigJson: fixture.scoringConfigJson as object,
        isActive: true,
        questions: {
          createMany: {
            data: fixture.questions.map((q) => ({
              questionOrder: q.order,
              text: q.text,
              dimension: q.dimension,
              isReverse: q.isReverse
            }))
          }
        }
      }
    });
    console.log(`Atnaujinta versija: ${fixture.language} v${fixture.version}`);
    return;
  }

  await prisma.testVersion.create({
    data: {
      testId: test.id,
      version: fixture.version,
      language: fixture.language,
      title: fixture.title,
      description: fixture.description,
      scoringConfigJson: fixture.scoringConfigJson as object,
      isActive: true,
      questions: {
        createMany: {
          data: fixture.questions.map((q) => ({
            questionOrder: q.order,
            text: q.text,
            dimension: q.dimension,
            isReverse: q.isReverse
          }))
        }
      }
    }
  });

  console.log(`Sukurta versija: ${fixture.language} v${fixture.version}`);
}

async function main() {
  const fixtures = await Promise.all([
    loadFixture("ysq-r-en-v1.json"),
    loadFixture("ysq-r-ru-v1.json")
  ]);

  for (const fixture of fixtures) {
    await upsertFixture(fixture);
  }

  console.log("YSQ fixture importas baigtas.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
