import { NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Neleistina" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "json";

  const attempts = await prisma.attempt.findMany({
    where: { deletedAt: null },
    include: {
      portal: { select: { internalClientId: true } },
      testVersion: { select: { title: true, version: true, language: true } },
      feedback: true
    },
    orderBy: { createdAt: "desc" }
  });

  if (format === "csv") {
    const csv = stringify(
      attempts.map((a) => ({
        attemptId: a.id,
        clientId: a.portal.internalClientId,
        status: a.status,
        test: `${a.testVersion.title} v${a.testVersion.version} (${a.testVersion.language})`,
        overall: (a.scoreJson as any)?.overall ?? "",
        answerMinutes: Math.round(a.answerDurationSec / 60),
        reportMinutes: Math.round(a.reportDurationSec / 60),
        clarity: a.feedback?.clarity ?? "",
        usefulness: a.feedback?.usefulness ?? "",
        interest: a.feedback?.interest ?? "",
        createdAt: a.createdAt.toISOString()
      })),
      { header: true }
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=attempts.csv"
      }
    });
  }

  return NextResponse.json(attempts, {
    headers: { "Content-Disposition": "attachment; filename=attempts.json" }
  });
}
