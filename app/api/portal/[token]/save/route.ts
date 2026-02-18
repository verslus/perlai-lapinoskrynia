import { EventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logEvent } from "@/lib/audit";
import { findAccessByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  attemptId: z.string(),
  answers: z.record(z.string(), z.number().int().min(1).max(5).nullable()),
  answerDurationSecDelta: z.number().int().min(0).max(300).default(0)
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

  await prisma.attempt.update({
    where: { id: attempt.id },
    data: {
      answersJson: parsed.data.answers,
      status: "STARTED",
      answerDurationSec: { increment: parsed.data.answerDurationSecDelta }
    }
  });

  await logEvent({
    type: EventType.ANSWERS_SAVED,
    portalId: access.portalId,
    attemptId: attempt.id,
    metadataJson: { count: Object.keys(parsed.data.answers).length }
  });

  return NextResponse.json({ ok: true });
}
