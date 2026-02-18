"use client";

import { useState } from "react";

type TestVersion = {
  id: string;
  label: string;
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
  const [testVersionId, setTestVersionId] = useState(tests[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedUrl(null);

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
        <form className="grid" onSubmit={createLink}>
          <label>
            Vidinis kliento ID
            <input value={internalClientId} onChange={(e) => setInternalClientId(e.target.value)} required />
          </label>
          <label>
            Testas
            <select value={testVersionId} onChange={(e) => setTestVersionId(e.target.value)} required>
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            El. paštas (optional)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit">Sukurti nuorodą</button>
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
