import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConsultantDashboard } from "@/components/ConsultantDashboard";
import { LogoutButton } from "@/components/LogoutButton";

export default async function ConsultantPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "CONSULTANT") redirect("/admin");

  const tests = await prisma.testVersion.findMany({
    where: { isActive: true },
    orderBy: [{ createdAt: "desc" }]
  });

  const portals = await prisma.clientPortal.findMany({
    where: { consultantId: session.id, deletedAt: null },
    include: {
      accessLinks: { where: { active: true }, take: 1, orderBy: { createdAt: "desc" } },
      attempts: {
        where: { deletedAt: null },
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { feedback: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const rows = portals.map((portal) => {
    const attempt = portal.attempts[0];
    const access = portal.accessLinks[0];
    return {
      portalId: portal.id,
      internalClientId: portal.internalClientId,
      latestStatus: attempt?.status ?? "NOT_STARTED",
      updatedAt: (attempt?.updatedAt ?? portal.createdAt).toISOString(),
      accessLinkId: access?.id ?? null,
      activeUrl: access ? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/p/${access.token}` : null,
      answeredMinutes: Math.round((attempt?.answerDurationSec ?? 0) / 60),
      reportMinutes: Math.round((attempt?.reportDurationSec ?? 0) / 60),
      feedback: attempt?.feedback
        ? `A:${attempt.feedback.clarity} N:${attempt.feedback.usefulness} I:${attempt.feedback.interest}`
        : "-"
    };
  });

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h1>Konsultanto skydelis</h1>
          <p className="small">Sveiki, {session.email}</p>
        </div>
        <LogoutButton />
      </div>

      <ConsultantDashboard
        tests={tests.map((t) => ({
          id: t.id,
          label: `${t.title} | ${t.language} v${t.version}`,
          description: t.description,
          consultantInstruction:
            typeof t.scoringConfigJson === "object" &&
            t.scoringConfigJson &&
            "instructions" in t.scoringConfigJson &&
            typeof (t.scoringConfigJson as { instructions?: { consultant?: string } }).instructions?.consultant ===
              "string"
              ? (t.scoringConfigJson as { instructions?: { consultant?: string } }).instructions?.consultant ?? null
              : null
        }))}
        rows={rows}
      />
    </main>
  );
}
