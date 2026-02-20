"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
  latestAttemptId: string | null;
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
  const [openedAttemptId, setOpenedAttemptId] = useState<string | null>(null);
  const [answersByAttempt, setAnswersByAttempt] = useState<
    Record<
      string,
      {
        loading: boolean;
        error: string | null;
        rows: Array<{
          order: number;
          questionLocal: string;
          questionEn: string;
          answerValue: number | null;
          answerLocal: string;
          answerEn: string;
        }>;
      }
    >
  >({});

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

  async function toggleAnswers(attemptId: string | null) {
    if (!attemptId) return;
    if (openedAttemptId === attemptId) {
      setOpenedAttemptId(null);
      return;
    }
    setOpenedAttemptId(attemptId);

    if (answersByAttempt[attemptId]?.rows?.length || answersByAttempt[attemptId]?.loading) return;

    setAnswersByAttempt((prev) => ({
      ...prev,
      [attemptId]: { loading: true, error: null, rows: [] }
    }));

    const res = await fetch(`/api/consultant/attempts/${attemptId}/answers`);
    const payload = await res.json();

    if (!res.ok) {
      setAnswersByAttempt((prev) => ({
        ...prev,
        [attemptId]: { loading: false, error: payload.error ?? "Klaida užkraunant atsakymus", rows: [] }
      }));
      return;
    }

    setAnswersByAttempt((prev) => ({
      ...prev,
      [attemptId]: { loading: false, error: null, rows: payload.rows ?? [] }
    }));
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
              <Fragment key={row.portalId}>
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
                    {row.latestAttemptId ? (
                      <div className="row" style={{ marginTop: 6 }}>
                        <button className="secondary" onClick={() => toggleAnswers(row.latestAttemptId)}>
                          {openedAttemptId === row.latestAttemptId ? "Slėpti atsakymus" : "Peržiūrėti atsakymus"}
                        </button>
                        <a href={`/api/consultant/attempts/${row.latestAttemptId}/answers?format=csv`}>
                          Atsisiųsti CSV
                        </a>
                      </div>
                    ) : null}
                  </td>
                </tr>
                {row.latestAttemptId && openedAttemptId === row.latestAttemptId ? (
                  <tr key={`${row.portalId}-answers`}>
                    <td colSpan={7}>
                      {answersByAttempt[row.latestAttemptId]?.loading ? <p>Kraunama...</p> : null}
                      {answersByAttempt[row.latestAttemptId]?.error ? (
                        <p style={{ color: "#8c2a2a" }}>{answersByAttempt[row.latestAttemptId]?.error}</p>
                      ) : null}
                      {answersByAttempt[row.latestAttemptId]?.rows?.length ? (
                        <table className="table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Klausimas (EN)</th>
                              <th>Klausimas (dalyvio kalba)</th>
                              <th>Atsakymas (EN)</th>
                              <th>Atsakymas (dalyvio kalba)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {answersByAttempt[row.latestAttemptId].rows.map((answer) => (
                              <tr key={`${row.latestAttemptId}-${answer.order}`}>
                                <td>{answer.order}</td>
                                <td>{answer.questionEn}</td>
                                <td>{answer.questionLocal}</td>
                                <td>{answer.answerEn || "-"}</td>
                                <td>{answer.answerLocal || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
