import { NextResponse } from "next/server";
import { findAccessByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await findAccessByToken(token);
  if (!access) {
    return NextResponse.json({ error: "Nuoroda negalioja" }, { status: 404 });
  }

  const attempts = await prisma.attempt.findMany({
    where: { portalId: access.portalId, testVersionId: access.testVersionId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 2,
    include: { feedback: true }
  });

  const latest = attempts[0] ?? null;
  const previous = attempts[1] ?? null;

  return NextResponse.json({
    portal: {
      internalClientId: access.portal.internalClientId
    },
    test: {
      id: access.testVersion.id,
      title: access.testVersion.title,
      description: access.testVersion.description,
      language: access.testVersion.language,
      questions: access.testVersion.questions
    },
    latestAttempt: latest
      ? {
          id: latest.id,
          status: latest.status,
          answers: latest.answersJson ?? {},
          score: latest.scoreJson,
          report: latest.fullReportJson,
          feedback: latest.feedback,
          answerDurationSec: latest.answerDurationSec,
          reportDurationSec: latest.reportDurationSec
        }
      : null,
    previousAttempt: previous
      ? {
          id: previous.id,
          score: previous.scoreJson,
          finishedAt: previous.finishedAt
        }
      : null
  });
}
