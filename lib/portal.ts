import { prisma } from "@/lib/prisma";

export async function findAccessByToken(token: string) {
  return prisma.accessLink.findFirst({
    where: { token, active: true, portal: { deletedAt: null } },
    include: {
      portal: true,
      testVersion: {
        include: {
          questions: { orderBy: { questionOrder: "asc" } }
        }
      }
    }
  });
}
