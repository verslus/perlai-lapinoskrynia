"use client";

import { useEffect, useMemo, useState } from "react";
import { TEST_CATEGORIES, getCategoryLabel, type TestCategory } from "@/lib/test-categories";

type TestVersion = {
  id: string;
  label: string;
  language: string;
  category: TestCategory;
  categoryLabel: string;
  description: string;
  consultantInstruction: string | null;
};

type PortalRow = {
  portalId: string;
  internalClientId: string;
  latestStatus: string;
  updatedAt: string;
  accessLinkId: string | null;
  activeUrl: string | null;
  answeredMinutes: number;
  reportMinutes: number;
  feedback: string;
};

export function ConsultantDashboard({
  tests,
  rows
}: {
  tests: TestVersion[];
  rows: PortalRow[];
}) {
  const [internalClientId, setInternalClientId] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TestCategory>("all");
  const [testVersionId, setTestVersionId] = useState(tests[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const languages = useMemo(() => [...new Set(tests.map((t) => t.language))].sort(), [tests]);

  const filteredTests = useMemo(
    () =>
      tests.filter(
        (t) =>
          (languageFilter === "all" || t.language === languageFilter) &&
          (categoryFilter === "all" || t.category === categoryFilter)
      ),
    [tests, languageFilter, categoryFilter]
  );

  useEffect(() => {
    if (!filteredTests.some((t) => t.id === testVersionId)) {
      setTestVersionId(filteredTests[0]?.id ?? "");
    }
  }, [filteredTests, testVersionId]);

  const selectedTest = filteredTests.find((t) => t.id === testVersionId) ?? null;

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedUrl(null);
    if (!testVersionId) {
      setError("Pasirinkite testą.");
      return;
    }

    const res = await fetch("/api/consultant/access-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        internalClientId,
        testVersionId,
        email: email || undefined,
        locale: "lt"
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Klaida kuriant nuorodą");
      return;
    }

    setCreatedUrl(data.accessUrl);
    setInternalClientId("");
    setEmail("");
  }

  async function rotate(linkId: string) {
    const res = await fetch(`/api/consultant/access-links/${linkId}/rotate`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setCreatedUrl(data.url);
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Generuoti kliento prieigą</h2>
        {selectedTest ? (
          <div className="small" style={{ marginBottom: 12 }}>
            <p>{selectedTest.description}</p>
            {selectedTest.consultantInstruction ? <p>{selectedTest.consultantInstruction}</p> : null}
          </div>
        ) : null}
        <form className="grid" onSubmit={createLink}>
          <div className="row">
            <label style={{ flex: 1 }}>
              Kalba
              <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
                <option value="all">Visos</option>
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              Kategorija
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as "all" | TestCategory)}
              >
                <option value="all">Visos</option>
                {TEST_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {getCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Vidinis kliento ID
            <input value={internalClientId} onChange={(e) => setInternalClientId(e.target.value)} required />
          </label>
          <label>
            Testas
            <select value={testVersionId} onChange={(e) => setTestVersionId(e.target.value)} required>
              {filteredTests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.label} | {test.categoryLabel}
                </option>
              ))}
            </select>
          </label>
          <label>
            El. paštas (optional)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" disabled={!testVersionId}>
            Sukurti nuorodą
          </button>
          {!filteredTests.length ? <p className="small">Pagal pasirinktus filtrus testų nerasta.</p> : null}
          {error ? <p style={{ color: "#8c2a2a" }}>{error}</p> : null}
          {createdUrl ? (
            <p>
              Nauja nuoroda: <a href={createdUrl}>{createdUrl}</a>
            </p>
          ) : null}
        </form>
      </section>

      <section className="card">
        <h2>Klientų statusai</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Kliento ID</th>
              <th>Statusas</th>
              <th>Atsakymo min.</th>
              <th>Ataskaitos min.</th>
              <th>Feedback</th>
              <th>Atnaujinta</th>
              <th>Nuoroda</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.portalId}>
                <td>{row.internalClientId}</td>
                <td>{row.latestStatus}</td>
                <td>{row.answeredMinutes}</td>
                <td>{row.reportMinutes}</td>
                <td>{row.feedback}</td>
                <td>{new Date(row.updatedAt).toLocaleString("lt-LT")}</td>
                <td>
                  {row.activeUrl ? (
                    <div className="row">
                      <a href={row.activeUrl}>Atidaryti</a>
                      {row.accessLinkId ? (
                        <button className="secondary" onClick={() => rotate(row.accessLinkId!)}>
                          Regeneruoti
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
