import { EventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logEvent } from "@/lib/audit";
import { sendCriticalAlert } from "@/lib/alerts";
import { findAccessByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { scoreAttempt } from "@/lib/scoring";

const schema = z.object({
  attemptId: z.string(),
  answers: z.record(z.string(), z.number().int().min(1).max(5).nullable())
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

  try {
    const score = scoreAttempt(access.testVersion.questions, parsed.data.answers);
    const consultantSummary = {
      overall: score.overall,
      topDimensions: score.dimensions.slice(0, 3)
    };

    const updated = await prisma.attempt.update({
      where: { id: attempt.id },
      data: {
        answersJson: parsed.data.answers,
        scoreJson: score,
        fullReportJson: score,
        consultantSummaryJson: consultantSummary,
        status: "FINISHED",
        finishedAt: new Date()
      }
    });

    await logEvent({
      type: EventType.TEST_FINISHED,
      portalId: access.portalId,
      attemptId: attempt.id
    });

    return NextResponse.json({ score: updated.scoreJson, report: updated.fullReportJson });
  } catch (error) {
    await logEvent({
      type: EventType.SCORING_ERROR,
      portalId: access.portalId,
      attemptId: attempt.id,
      metadataJson: { error: `${error}` }
    });
    await sendCriticalAlert({
      subject: "[perlai-ls] Scoring error",
      text: `Scoring failed.\nPortalId: ${access.portalId}\nAttemptId: ${attempt.id}\nError: ${String(error)}`
    });
    return NextResponse.json({ error: "Scoring klaida" }, { status: 500 });
  }
}
