import { NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type OptionsMap = Record<string, Array<{ value: number; label: string }>>;

function optionLabelByValue(options: OptionsMap | undefined, order: number, value: number | null | undefined) {
  if (typeof value !== "number") return "";
  const opts = options?.[String(order)] ?? [];
  return opts.find((o) => o.value === value)?.label ?? String(value);
}

function parseOptions(config: unknown): OptionsMap | undefined {
  if (!config || typeof config !== "object") return undefined;
  const raw = (config as { responseOptionsByOrder?: unknown }).responseOptionsByOrder;
  if (!raw || typeof raw !== "object") return undefined;
  return raw as OptionsMap;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "CONSULTANT") {
    return NextResponse.json({ error: "Neleistina" }, { status: 403 });
  }

  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "json";

  const attempt = await prisma.attempt.findUnique({
    where: { id },
    include: {
      portal: true,
      testVersion: {
        include: {
          test: true,
          questions: { orderBy: { questionOrder: "asc" } }
        }
      }
    }
  });

  if (!attempt || attempt.deletedAt) {
    return NextResponse.json({ error: "Attempt nerastas" }, { status: 404 });
  }

  if (attempt.portal.consultantId !== session.id) {
    return NextResponse.json({ error: "Neleistina" }, { status: 403 });
  }

  const answers = (attempt.answersJson ?? {}) as Record<string, number | null>;

  const enVersion = await prisma.testVersion.findUnique({
    where: {
      testId_version_language: {
        testId: attempt.testVersion.testId,
        version: attempt.testVersion.version,
        language: "en"
      }
    },
    include: { questions: { orderBy: { questionOrder: "asc" } } }
  });

  const localOptions = parseOptions(attempt.testVersion.scoringConfigJson);
  const enOptions = parseOptions(enVersion?.scoringConfigJson);

  const rows = attempt.testVersion.questions.map((q) => {
    const enQuestion = enVersion?.questions.find((eq) => eq.questionOrder === q.questionOrder)?.text ?? q.text;
    const value = answers[q.id] ?? null;

    return {
      order: q.questionOrder,
      questionLocal: q.text,
      questionEn: enQuestion,
      answerValue: value,
      answerLocal: optionLabelByValue(localOptions, q.questionOrder, value),
      answerEn: optionLabelByValue(enOptions, q.questionOrder, value)
    };
  });

  if (format === "csv") {
    const csv = stringify(
      rows.map((r) => ({
        testTitleParticipantLanguage: attempt.testVersion.title,
        testTitleEn: enVersion?.title ?? attempt.testVersion.title,
        participantLanguage: attempt.testVersion.language,
        questionOrder: r.order,
        questionParticipantLanguage: r.questionLocal,
        questionEn: r.questionEn,
        answerValue: r.answerValue ?? "",
        answerParticipantLanguage: r.answerLocal,
        answerEn: r.answerEn
      })),
      { header: true }
    );

    const safeTitle = (attempt.testVersion.title || "test")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${safeTitle}-answers.csv`
      }
    });
  }

  return NextResponse.json({
    attemptId: attempt.id,
    testTitleParticipantLanguage: attempt.testVersion.title,
    testTitleEn: enVersion?.title ?? attempt.testVersion.title,
    participantLanguage: attempt.testVersion.language,
    rows
  });
}
