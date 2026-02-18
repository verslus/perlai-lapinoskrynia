import { EventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logEvent(params: {
  type: EventType;
  actorUserId?: string;
  portalId?: string;
  attemptId?: string;
  metadataJson?: unknown;
}) {
  await prisma.auditEvent.create({
    data: {
      type: params.type,
      actorUserId: params.actorUserId,
      portalId: params.portalId,
      attemptId: params.attemptId,
      metadataJson: params.metadataJson as object | undefined
    }
  });
}
