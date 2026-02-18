import { NextResponse } from "next/server";
import { z } from "zod";
import { findAccessByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  attemptId: z.string(),
  clarity: z.number().int().min(1).max(5),
  usefulness: z.number().int().min(1).max(5),
  interest: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional()
});

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Neteisingi duomenys" }, { status: 400 });
  }

  const access = await findAccessByToken(token);
  if (!access) return NextResponse.json({ error: "Nuoroda negalioja" }, { status: 404 });

  const attempt = await prisma.attempt.findUnique({ where: { id: parsed.data.attemptId } });
  if (!attempt || attempt.portalId !== access.portalId || attempt.deletedAt) {
    return NextResponse.json({ error: "Attempt nerastas" }, { status: 404 });
  }

  await prisma.feedback.upsert({
    where: { attemptId: attempt.id },
    update: {
      clarity: parsed.data.clarity,
      usefulness: parsed.data.usefulness,
      interest: parsed.data.interest,
      comment: parsed.data.comment
    },
    create: {
      attemptId: attempt.id,
      clarity: parsed.data.clarity,
      usefulness: parsed.data.usefulness,
      interest: parsed.data.interest,
      comment: parsed.data.comment
    }
  });

  return NextResponse.json({ ok: true });
}
