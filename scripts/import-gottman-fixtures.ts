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

async function loadFixtures(): Promise<Fixture[]> {
  const fullPath = path.join(process.cwd(), "prisma", "fixtures", "gottman-fixtures.json");
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw) as Fixture[];
}

async function upsertFixture(fixture: Fixture) {
  const isActive = fixture.version === 1;
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
        isActive,
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
      isActive,
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
}

async function main() {
  const fixtures = await loadFixtures();

  for (const fixture of fixtures) {
    await upsertFixture(fixture);
  }

  console.log(`Gottman fixture importas baigtas. Įrašų: ${fixtures.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
