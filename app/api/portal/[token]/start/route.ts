import { EventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { logEvent } from "@/lib/audit";
import { findAccessByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  accepted: z.boolean()
});

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success || !parsed.data.accepted) {
    return NextResponse.json({ error: "Būtinas sutikimas" }, { status: 400 });
  }

  const access = await findAccessByToken(token);
  if (!access) {
    return NextResponse.json({ error: "Nuoroda negalioja" }, { status: 404 });
  }

  let attempt = await prisma.attempt.findFirst({
    where: {
      portalId: access.portalId,
      testVersionId: access.testVersionId,
      status: { in: ["NOT_STARTED", "STARTED"] },
      deletedAt: null
    },
    orderBy: { createdAt: "desc" }
  });

  if (!attempt) {
    attempt = await prisma.attempt.create({
      data: {
        portalId: access.portalId,
        accessLinkId: access.id,
        testVersionId: access.testVersionId,
        status: "STARTED",
        startedAt: new Date(),
        answersJson: {}
      }
    });

    await prisma.consent.create({
      data: {
        attemptId: attempt.id,
        policyVersion: env.policyVersion
      }
    });

    await logEvent({
      type: EventType.TEST_STARTED,
      portalId: access.portalId,
      attemptId: attempt.id
    });
  } else if (attempt.status === "NOT_STARTED") {
    attempt = await prisma.attempt.update({
      where: { id: attempt.id },
      data: { status: "STARTED", startedAt: attempt.startedAt ?? new Date() }
    });
  }

  return NextResponse.json({ attemptId: attempt.id });
}
