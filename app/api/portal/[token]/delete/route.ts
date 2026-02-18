import { EventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logEvent } from "@/lib/audit";
import { findAccessByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  phrase: z.string().min(1)
});

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success || parsed.data.phrase !== "ISTRINTI") {
    return NextResponse.json({ error: "Patvirtinimo frazė neteisinga" }, { status: 400 });
  }

  const access = await findAccessByToken(token);
  if (!access) return NextResponse.json({ error: "Nuoroda negalioja" }, { status: 404 });

  await prisma.attempt.updateMany({
    where: { portalId: access.portalId, deletedAt: null },
    data: { deletedAt: new Date() }
  });

  await prisma.clientPortal.update({
    where: { id: access.portalId },
    data: { deletedAt: new Date() }
  });

  await logEvent({
    type: EventType.DATA_DELETED,
    portalId: access.portalId
  });

  return NextResponse.json({ ok: true });
}
