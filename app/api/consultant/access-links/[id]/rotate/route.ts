import { NextResponse } from "next/server";
import { EventType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomToken } from "@/lib/utils";
import { logEvent } from "@/lib/audit";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "CONSULTANT") {
    return NextResponse.json({ error: "Neleistina" }, { status: 403 });
  }

  const { id } = await params;
  const access = await prisma.accessLink.findUnique({
    where: { id },
    include: { portal: true }
  });

  if (!access || access.portal.consultantId !== session.id) {
    return NextResponse.json({ error: "Nerasta" }, { status: 404 });
  }

  await prisma.accessLink.updateMany({
    where: { portalId: access.portalId, testVersionId: access.testVersionId, active: true },
    data: { active: false, rotatedAt: new Date() }
  });

  const rotated = await prisma.accessLink.create({
    data: {
      portalId: access.portalId,
      testVersionId: access.testVersionId,
      token: randomToken(24),
      active: true
    }
  });

  await logEvent({
    type: EventType.ACCESS_LINK_ROTATED,
    actorUserId: session.id,
    portalId: access.portalId,
    metadataJson: { previousAccessLinkId: access.id, newAccessLinkId: rotated.id }
  });

  return NextResponse.json({
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/p/${rotated.token}`
  });
}
