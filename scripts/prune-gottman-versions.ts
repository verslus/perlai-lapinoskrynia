import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Fixture = {
  slug: string;
  version: number;
  language: string;
};

async function loadKeepSet() {
  const fullPath = path.join(process.cwd(), "prisma", "fixtures", "gottman-fixtures.json");
  const raw = await fs.readFile(fullPath, "utf8");
  const fixtures = JSON.parse(raw) as Fixture[];
  return new Set(fixtures.map((f) => `${f.slug}|${f.version}|${f.language}`));
}

async function main() {
  const keep = await loadKeepSet();

  const versions = await prisma.testVersion.findMany({
    where: { test: { slug: { startsWith: "gottman-" } } },
    include: {
      test: true,
      _count: {
        select: {
          attempts: true,
          accessLinks: true
        }
      }
    }
  });

  let deleted = 0;
  let deactivated = 0;
  let kept = 0;

  for (const tv of versions) {
    const key = `${tv.test.slug}|${tv.version}|${tv.language}`;
    if (keep.has(key)) {
      kept += 1;
      continue;
    }

    if (tv._count.attempts === 0 && tv._count.accessLinks === 0) {
      await prisma.testVersion.delete({ where: { id: tv.id } });
      deleted += 1;
    } else if (tv.isActive) {
      await prisma.testVersion.update({ where: { id: tv.id }, data: { isActive: false } });
      deactivated += 1;
    }
  }

  await prisma.test.deleteMany({
    where: {
      slug: { startsWith: "gottman-" },
      versions: { none: {} }
    }
  });

  console.log(`Prune done. kept=${kept}, deleted=${deleted}, deactivated=${deactivated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
