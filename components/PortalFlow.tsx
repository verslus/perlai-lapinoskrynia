"use client";

import { useEffect, useMemo, useState } from "react";

type Question = {
  id: string;
  questionOrder: number;
  text: string;
  dimension: string;
  isReverse: boolean;
};

type InitPayload = {
  portal: { internalClientId: string };
  test: { id: string; title: string; description: string; language: string; questions: Question[] };
  latestAttempt: {
    id: string;
    status: string;
    answers: Record<string, number | null>;
    score: { overall: number } | null;
    report: {
      overall: number;
      interpretation: string;
      dimensions: { dimension: string; avg: number; level: string }[];
    } | null;
    feedback?: { clarity: number; usefulness: number; interest: number; comment?: string | null } | null;
  } | null;
  previousAttempt: {
    id: string;
    score: { overall: number } | null;
    finishedAt: string | null;
  } | null;
};

export function PortalFlow({ token }: { token: string }) {
  const [data, setData] = useState<InitPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"consent" | "test" | "report">("consent");
  const [reportSeenAt, setReportSeenAt] = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      const res = await fetch(`/api/portal/${token}/init`);
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Nepavyko atidaryti portalo");
        setLoading(false);
        return;
      }
      setData(payload);
      setAnswers(payload.latestAttempt?.answers ?? {});
      if (payload.latestAttempt?.status === "FINISHED" || payload.latestAttempt?.status === "REPORT_VIEWED") {
        setAttemptId(payload.latestAttempt.id);
        setPhase("report");
      }
      setLoading(false);
    }
    init();
  }, [token]);

  const questions = data?.test.questions ?? [];
  const current = questions[index];
  const progress = questions.length ? Math.round(((index + 1) / questions.length) * 100) : 0;

  const deltaLabel = useMemo(() => {
    const curr = data?.latestAttempt?.score?.overall;
    const prev = data?.previousAttempt?.score?.overall;
    if (typeof curr !== "number" || typeof prev !== "number") return null;
    const delta = Number((curr - prev).toFixed(2));
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta}`;
  }, [data]);

  async function start() {
    const res = await fetch(`/api/portal/${token}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true })
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error ?? "Nepavyko pradėti");
      return;
    }
    setAttemptId(payload.attemptId);
    setPhase("test");
  }

  async function persist(nextAnswers: Record<string, number | null>, sec = 6) {
    if (!attemptId) return;
    await fetch(`/api/portal/${token}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId,
        answers: nextAnswers,
        answerDurationSecDelta: sec
      })
    });
  }

  async function choose(value: number | null) {
    if (!current) return;
    const next = { ...answers, [current.id]: value };
    setAnswers(next);
    await persist(next);
    if (index < questions.length - 1) {
      setIndex((x) => x + 1);
    }
  }

  async function finish() {
    if (!attemptId) return;
    const res = await fetch(`/api/portal/${token}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, answers })
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error ?? "Nepavyko užbaigti");
      return;
    }

    setData((prev) =>
      prev
        ? {
            ...prev,
            latestAttempt: {
              ...(prev.latestAttempt ?? { id: attemptId, status: "FINISHED", answers }),
              id: attemptId,
              status: "FINISHED",
              answers,
              score: payload.score,
              report: payload.report
            }
          }
        : prev
    );
    setPhase("report");
    setReportSeenAt(Date.now());
  }

  async function markViewed() {
    if (!attemptId || !reportSeenAt) return;
    const delta = Math.floor((Date.now() - reportSeenAt) / 1000);
    await fetch(`/api/portal/${token}/report-viewed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, reportDurationSecDelta: Math.max(delta, 0) })
    });
  }

  async function submitFeedback(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!attemptId) return;
    const form = new FormData(e.currentTarget);
    await fetch(`/api/portal/${token}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId,
        clarity: Number(form.get("clarity")),
        usefulness: Number(form.get("usefulness")),
        interest: Number(form.get("interest")),
        comment: form.get("comment")?.toString() || undefined
      })
    });
    e.currentTarget.reset();
  }

  async function deleteData() {
    const phrase = prompt('Įrašykite "ISTRINTI"');
    if (!phrase) return;
    const res = await fetch(`/api/portal/${token}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phrase })
    });
    if (res.ok) {
      location.reload();
    }
  }

  if (loading) {
    return <p>Kraunama...</p>;
  }

  if (error || !data) {
    return <p style={{ color: "#8c2a2a" }}>{error ?? "Klaida"}</p>;
  }

  return (
    <div className="grid">
      <section className="card">
        <h1>{data.test.title}</h1>
        <p className="small">Kliento ID: {data.portal.internalClientId}</p>
        <p>{data.test.description}</p>
      </section>

      {phase === "consent" ? (
        <section className="card">
          <h2>Sutikimas</h2>
          <p>
            Tęsdami patvirtinate, kad perskaitėte taisykles, sutinkate su duomenų tvarkymu ir suprantate, kad
            testas nėra medicininė diagnozė.
          </p>
          <button onClick={start}>Pradėti testą</button>
        </section>
      ) : null}

      {phase === "test" && current ? (
        <section className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>
              Klausimas {index + 1} / {questions.length}
            </h2>
            <span className="tag">{progress}%</span>
          </div>
          <p>{current.text}</p>
          <div className="row">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                className={answers[current.id] === v ? "" : "secondary"}
                onClick={() => choose(v)}
              >
                {v}
              </button>
            ))}
            <button className="secondary" onClick={() => choose(null)}>
              Praleisti
            </button>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="secondary" onClick={() => setIndex((x) => Math.max(0, x - 1))}>
              Atgal
            </button>
            {index === questions.length - 1 ? <button onClick={finish}>Baigti testą</button> : null}
          </div>
        </section>
      ) : null}

      {phase === "report" ? (
        <section className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Jūsų ataskaita</h2>
            <button className="secondary" onClick={markViewed}>
              Pažymėti, kad peržiūrėta
            </button>
          </div>
          <p>
            Bendras balas: <strong>{data.latestAttempt?.report?.overall ?? data.latestAttempt?.score?.overall ?? "-"}</strong>
          </p>
          <p>{data.latestAttempt?.report?.interpretation}</p>
          <div className="grid">
            {data.latestAttempt?.report?.dimensions?.map((d) => (
              <div key={d.dimension} className="row">
                <strong>{d.dimension}</strong>
                <span className="tag">{d.avg}</span>
                <span className="small">{d.level}</span>
              </div>
            ))}
          </div>

          <hr style={{ margin: "18px 0", border: 0, borderTop: "1px solid #d4dfd6" }} />
          <h3>Palyginimas su ankstesniu atlikimu</h3>
          <p>
            Ankstesnis: {data.previousAttempt?.score?.overall ?? "-"} | Dabartinis: {data.latestAttempt?.score?.overall ?? "-"}
            {deltaLabel ? ` | Pokytis: ${deltaLabel}` : ""}
          </p>

          <h3>Trumpas įvertinimas</h3>
          <form className="grid" onSubmit={submitFeedback}>
            <label>
              Aiškumas (1-5)
              <input type="number" name="clarity" min={1} max={5} required />
            </label>
            <label>
              Naudingumas (1-5)
              <input type="number" name="usefulness" min={1} max={5} required />
            </label>
            <label>
              Įdomumas (1-5)
              <input type="number" name="interest" min={1} max={5} required />
            </label>
            <label>
              Komentaras (optional)
              <textarea name="comment" rows={3} />
            </label>
            <button type="submit">Išsaugoti įvertinimą</button>
          </form>

          <div style={{ marginTop: 16 }}>
            <button className="secondary" onClick={deleteData}>
              Ištrinti mano duomenis
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
