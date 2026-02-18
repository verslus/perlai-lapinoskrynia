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
      dimensions: {
        dimension: string;
        avg: number;
        level: string;
        elevatedPct?: number;
        highPct?: number;
      }[];
    } | null;
    feedback?: { clarity: number; usefulness: number; interest: number; comment?: string | null } | null;
  } | null;
  previousAttempt: {
    id: string;
    score: { overall: number } | null;
    finishedAt: string | null;
  } | null;
};

type FeedbackState = {
  clarity: number | null;
  usefulness: number | null;
  interest: number | null;
  comment: string;
};

function getTestLikert(language: string) {
  const lt = [
    { value: 1, label: "Visiškai netinka man" },
    { value: 2, label: "Daugiausia netinka man" },
    { value: 3, label: "Labiau tinka nei netinka" },
    { value: 4, label: "Vidutiniškai tinka man" },
    { value: 5, label: "Daugiausia tinka man" },
    { value: 6, label: "Puikiai mane apibūdina" }
  ];

  const en = [
    { value: 1, label: "Completely untrue of me" },
    { value: 2, label: "Mostly untrue of me" },
    { value: 3, label: "Slightly more true than untrue" },
    { value: 4, label: "Moderately true of me" },
    { value: 5, label: "Mostly true of me" },
    { value: 6, label: "Describes me perfectly" }
  ];

  const ru = [
    { value: 1, label: "Абсолютно не соответствует мне" },
    { value: 2, label: "В основном не соответствует мне" },
    { value: 3, label: "Скорее соответствует, чем нет" },
    { value: 4, label: "В общем, соответствует" },
    { value: 5, label: "По большей части соответствует" },
    { value: 6, label: "Полностью соответствует мне" }
  ];

  if (language === "ru") return ru;
  if (language === "en") return en;
  return lt;
}

const feedbackLikert = [
  { value: 1, label: "Visiškai ne" },
  { value: 2, label: "Labiau ne" },
  { value: 3, label: "Per vidurį" },
  { value: 4, label: "Labiau taip" },
  { value: 5, label: "Labai taip" }
];

export function PortalFlow({ token }: { token: string }) {
  const [data, setData] = useState<InitPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"consent" | "test" | "report">("consent");
  const [reportSeenAt, setReportSeenAt] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    clarity: null,
    usefulness: null,
    interest: null,
    comment: ""
  });

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
      if (payload.latestAttempt?.feedback) {
        setFeedback({
          clarity: payload.latestAttempt.feedback.clarity,
          usefulness: payload.latestAttempt.feedback.usefulness,
          interest: payload.latestAttempt.feedback.interest,
          comment: payload.latestAttempt.feedback.comment ?? ""
        });
      }
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
  const testLikert = getTestLikert(data?.test.language ?? "lt");

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

    if (!feedback.clarity || !feedback.usefulness || !feedback.interest) {
      setError("Pasirinkite visus tris įvertinimo atsakymus.");
      return;
    }

    await fetch(`/api/portal/${token}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId,
        clarity: feedback.clarity,
        usefulness: feedback.usefulness,
        interest: feedback.interest,
        comment: feedback.comment || undefined
      })
    });
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
    <div className="grid portal-flow">
      <section className="card portal-hero">
        <div>
          <h1>{data.test.title}</h1>
          <p className="small">Kliento ID: {data.portal.internalClientId}</p>
          <p>{data.test.description}</p>
        </div>
        <div className="tag">{data.test.language.toUpperCase()}</div>
      </section>

      {phase === "consent" ? (
        <section className="card portal-panel">
          <h2>Sutikimas</h2>
          <p>
            Tęsdami patvirtinate, kad perskaitėte taisykles, sutinkate su duomenų tvarkymu ir suprantate, kad
            testas nėra medicininė diagnozė.
          </p>
          <button onClick={start}>Pradėti testą</button>
        </section>
      ) : null}

      {phase === "test" && current ? (
        <section className="card portal-panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>
              Klausimas {index + 1} / {questions.length}
            </h2>
            <span className="tag">{progress}%</span>
          </div>
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>

          <p className="question-text">{current.text}</p>
          <div className="likert-grid">
            {testLikert.map((opt) => (
              <button
                key={opt.value}
                className={`likert-option ${answers[current.id] === opt.value ? "active" : ""}`}
                onClick={() => choose(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="secondary" onClick={() => setIndex((x) => Math.max(0, x - 1))}>
              Atgal
            </button>
            <button className="secondary" onClick={() => choose(null)}>
              Praleisti
            </button>
            {index === questions.length - 1 ? <button onClick={finish}>Baigti testą</button> : null}
          </div>
        </section>
      ) : null}

      {phase === "report" ? (
        <section className="card portal-panel">
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
              <div key={d.dimension} className="row report-chip">
                <strong>{d.dimension}</strong>
                <span className="tag">{d.avg}</span>
                <span className="small">{d.level}</span>
                {typeof d.elevatedPct === "number" ? <span className="small">5/6: {d.elevatedPct}%</span> : null}
                {typeof d.highPct === "number" ? <span className="small">4/5/6: {d.highPct}%</span> : null}
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
            <div className="feedback-item">
              <label>Kiek buvo aišku?</label>
              <div className="feedback-scale" role="radiogroup" aria-label="Kiek buvo aišku?">
                {feedbackLikert.map((opt) => (
                  <button
                    type="button"
                    key={`clarity-${opt.value}`}
                    className={`feedback-pill ${feedback.clarity === opt.value ? "active" : ""}`}
                    onClick={() => setFeedback((prev) => ({ ...prev, clarity: opt.value }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-item">
              <label>Kiek buvo vertinga?</label>
              <div className="feedback-scale" role="radiogroup" aria-label="Kiek buvo vertinga?">
                {feedbackLikert.map((opt) => (
                  <button
                    type="button"
                    key={`usefulness-${opt.value}`}
                    className={`feedback-pill ${feedback.usefulness === opt.value ? "active" : ""}`}
                    onClick={() => setFeedback((prev) => ({ ...prev, usefulness: opt.value }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-item">
              <label>Kiek buvo įdomu?</label>
              <div className="feedback-scale" role="radiogroup" aria-label="Kiek buvo įdomu?">
                {feedbackLikert.map((opt) => (
                  <button
                    type="button"
                    key={`interest-${opt.value}`}
                    className={`feedback-pill ${feedback.interest === opt.value ? "active" : ""}`}
                    onClick={() => setFeedback((prev) => ({ ...prev, interest: opt.value }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label>
              Komentaras (optional)
              <textarea
                name="comment"
                rows={3}
                value={feedback.comment}
                onChange={(e) => setFeedback((prev) => ({ ...prev, comment: e.target.value }))}
              />
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
