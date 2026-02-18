import { EventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const questionSchema = z.object({
  order: z.number().int().min(1),
  text: z.string().min(1),
  dimension: z.string().min(1),
  isReverse: z.boolean().optional()
});

const importSchema = z.object({
  slug: z.string().min(2),
  version: z.number().int().min(1),
  language: z.string().min(2),
  title: z.string().min(2),
  description: z.string().min(2),
  questions: z.array(questionSchema).min(1)
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Neleistina" }, { status: 403 });
  }

  const parsed = importSchema.safeParse(await req.json());
  if (!parsed.success) {
    await logEvent({
      type: EventType.IMPORT_ERROR,
      actorUserId: session.id,
      metadataJson: { reason: parsed.error.flatten() }
    });
    return NextResponse.json({ error: "Neteisingas import failas" }, { status: 400 });
  }

  const data = parsed.data;
  const test = await prisma.test.upsert({
    where: { slug: data.slug },
    update: {},
    create: { slug: data.slug }
  });

  const version = await prisma.testVersion.create({
    data: {
      testId: test.id,
      version: data.version,
      language: data.language,
      title: data.title,
      description: data.description,
      scoringConfigJson: { importedAt: new Date().toISOString() },
      questions: {
        createMany: {
          data: data.questions.map((q) => ({
            questionOrder: q.order,
            text: q.text,
            dimension: q.dimension,
            isReverse: q.isReverse ?? false
          }))
        }
      }
    }
  });

  return NextResponse.json({ testVersionId: version.id });
}
