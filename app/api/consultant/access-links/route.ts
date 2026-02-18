import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomToken, encryptOptional } from "@/lib/utils";
import { logEvent } from "@/lib/audit";
import { EventType } from "@prisma/client";

const schema = z.object({
  internalClientId: z.string().min(2).max(32),
  testVersionId: z.string().min(10),
  locale: z.string().default("lt"),
  email: z.string().email().optional()
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "CONSULTANT") {
    return NextResponse.json({ error: "Neleistina" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Neteisingi duomenys" }, { status: 400 });
  }

  const portal = await prisma.clientPortal.create({
    data: {
      internalClientId: parsed.data.internalClientId,
      portalToken: randomToken(20),
      consultantId: session.id,
      encryptedEmail: encryptOptional(parsed.data.email)
    }
  });

  const link = await prisma.accessLink.create({
    data: {
      token: randomToken(24),
      portalId: portal.id,
      testVersionId: parsed.data.testVersionId
    }
  });

  await logEvent({
    type: EventType.ACCESS_LINK_CREATED,
    actorUserId: session.id,
    portalId: portal.id,
    metadataJson: { internalClientId: parsed.data.internalClientId, locale: parsed.data.locale }
  });

  return NextResponse.json({
    portalId: portal.id,
    accessUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/p/${link.token}`
  });
}
