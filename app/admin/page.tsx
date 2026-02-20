import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEST_CATEGORIES, getCategoryLabel, resolveTestCategory } from "@/lib/test-categories";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ language?: string; category?: string }>;
}) {
  const params = await searchParams;
  const languageFilter = params.language ?? "all";
  const categoryFilter = params.category ?? "all";
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/consultant");

  const [testsCount, attemptsCount, completedCount, testVersions] = await Promise.all([
    prisma.testVersion.count({ where: { isActive: true } }),
    prisma.attempt.count({ where: { deletedAt: null } }),
    prisma.attempt.count({ where: { status: { in: ["FINISHED", "REPORT_VIEWED"] }, deletedAt: null } }),
    prisma.testVersion.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: "desc" }],
      include: { test: true }
    })
  ]);

  const completionRate = attemptsCount > 0 ? Math.round((completedCount / attemptsCount) * 100) : 0;
  const languages = [...new Set(testVersions.map((tv) => tv.language))].sort();
  const filteredTestVersions = testVersions.filter((tv) => {
    const category = resolveTestCategory(tv.scoringConfigJson, tv.test.slug);
    return (languageFilter === "all" || tv.language === languageFilter) &&
      (categoryFilter === "all" || category === categoryFilter);
  });

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
          POST į <code>/api/admin/import</code> su JSON: slug, version, language, category, title, description,
          questions[].
        </p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Testų aprašai (admin)</h2>
        <form method="GET" className="row" style={{ marginBottom: 10 }}>
          <label>
            Kalba
            <select name="language" defaultValue={languageFilter}>
              <option value="all">Visos</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kategorija
            <select name="category" defaultValue={categoryFilter}>
              <option value="all">Visos</option>
              {TEST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {getCategoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Filtruoti</button>
        </form>
        <table className="table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Pavadinimas</th>
              <th>Kategorija</th>
              <th>Kalba / versija</th>
              <th>Aprašas</th>
              <th>Admin instrukcija</th>
            </tr>
          </thead>
          <tbody>
            {filteredTestVersions.map((tv) => {
              const category = resolveTestCategory(tv.scoringConfigJson, tv.test.slug);
              const adminInstruction =
                typeof tv.scoringConfigJson === "object" &&
                tv.scoringConfigJson &&
                "instructions" in tv.scoringConfigJson &&
                typeof (tv.scoringConfigJson as { instructions?: { admin?: string } }).instructions?.admin ===
                  "string"
                  ? (tv.scoringConfigJson as { instructions?: { admin?: string } }).instructions?.admin
                  : "-";

              return (
                <tr key={tv.id}>
                  <td>{tv.test.slug}</td>
                  <td>{tv.title}</td>
                  <td>{getCategoryLabel(category)}</td>
                  <td>
                    {tv.language} v{tv.version}
                  </td>
                  <td>{tv.description}</td>
                  <td>{adminInstruction}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
