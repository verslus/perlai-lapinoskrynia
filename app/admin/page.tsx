import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/consultant");

  const [testsCount, attemptsCount, completedCount] = await Promise.all([
    prisma.testVersion.count(),
    prisma.attempt.count({ where: { deletedAt: null } }),
    prisma.attempt.count({ where: { status: { in: ["FINISHED", "REPORT_VIEWED"] }, deletedAt: null } })
  ]);

  const completionRate = attemptsCount > 0 ? Math.round((completedCount / attemptsCount) * 100) : 0;

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h1>Super admin</h1>
          <p className="small">Sveiki, {session.email}</p>
        </div>
        <LogoutButton />
      </div>

      <section className="card">
        <h2>Analitika</h2>
        <div className="row">
          <span className="tag">Testų versijos: {testsCount}</span>
          <span className="tag">Attempt'ai: {attemptsCount}</span>
          <span className="tag">Completion rate: {completionRate}%</span>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Eksportai</h2>
        <div className="row">
          <a href="/api/admin/export?format=json">Atsisiųsti JSON</a>
          <a href="/api/admin/export?format=csv">Atsisiųsti CSV</a>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Testo importas</h2>
        <p className="small">
          POST į <code>/api/admin/import</code> su JSON: slug, version, language, title, description, questions[].
        </p>
      </section>
    </main>
  );
}
