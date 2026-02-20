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
  test: {
    id: string;
    title: string;
    description: string;
    language: string;
    scoringConfig?: {
      responseOptionsByOrder?: Record<string, Array<{ value: number; label: string }>>;
      instructions?: {
        user?: string;
        consultant?: string;
        admin?: string;
      };
    };
    questions: Question[];
  };
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

type FeedbackKey = "clarity" | "usefulness" | "interest";

function getDefaultLikert(language: string) {
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

  const ua = [
    { value: 1, label: "Абсолютно не про мене" },
    { value: 2, label: "Переважно не про мене" },
    { value: 3, label: "Скоріше так, ніж ні" },
    { value: 4, label: "Помірно про мене" },
    { value: 5, label: "Переважно про мене" },
    { value: 6, label: "Повністю про мене" }
  ];

  if (language === "ua") return ua;
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

const feedbackPrompts: Array<{ key: FeedbackKey; label: string }> = [
  { key: "clarity", label: "Kiek buvo aišku?" },
  { key: "usefulness", label: "Kiek buvo vertinga?" },
  { key: "interest", label: "Kiek buvo įdomu?" }
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
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saved">("idle");

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
  const fallbackLikert = getDefaultLikert(data?.test.language ?? "lt");
  const currentOptions =
    data?.test.scoringConfig?.responseOptionsByOrder?.[String(current?.questionOrder ?? 0)] ?? fallbackLikert;

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
    setError(null);
    setFeedbackStatus("saved");
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
    <div className="portal-flow">
      <section className="card portal-hero">
        <div className="portal-hero-main">
          <p className="portal-overline">Asmeninis testas</p>
          <h1>{data.test.title}</h1>
          <p className="small">Kliento ID: {data.portal.internalClientId}</p>
          <p className="portal-hero-description">{data.test.description}</p>
        </div>
        <div className="portal-badges">
          <span className="tag">{data.test.language.toUpperCase()}</span>
          <span className="tag">{questions.length} klausimų</span>
        </div>
      </section>

      {phase === "consent" ? (
        <section className="card portal-panel portal-consent">
          <h2>Sutikimas</h2>
          {data.test.scoringConfig?.instructions?.user ? (
            <p style={{ marginBottom: 10 }}>{data.test.scoringConfig.instructions.user}</p>
          ) : null}
          <p>
            Tęsdami patvirtinate, kad perskaitėte taisykles, sutinkate su duomenų tvarkymu ir suprantate, kad
            testas nėra medicininė diagnozė.
          </p>
          <button onClick={start}>Pradėti testą</button>
        </section>
      ) : null}

      {phase === "test" && current ? (
        <section className="card portal-panel portal-test-shell">
          <div className="row portal-test-head">
            <h2>
              Klausimas {index + 1} / {questions.length}
            </h2>
            <span className="tag">{progress}%</span>
          </div>
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>

          <p className="question-text">{current.text}</p>
          <div className="likert-stack">
            {currentOptions.map((opt) => {
              const active = answers[current.id] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`likert-card ${active ? "active" : ""}`}
                  onClick={() => choose(opt.value)}
                >
                  <span className="likert-label-wrap">
                    <span className="likert-label">{opt.label}</span>
                  </span>
                  <span className="likert-check">{active ? "Pasirinkta" : "Pasirinkti"}</span>
                </button>
              );
            })}
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
          <div className="row portal-test-head">
            <h2>Jūsų ataskaita</h2>
            <button className="secondary" onClick={markViewed}>
              Pažymėti, kad peržiūrėta
            </button>
          </div>
          <div className="report-summary">
            <p className="small">Bendras balas</p>
            <p className="report-total">{data.latestAttempt?.report?.overall ?? data.latestAttempt?.score?.overall ?? "-"}</p>
            <p>{data.latestAttempt?.report?.interpretation}</p>
          </div>
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
            {feedbackPrompts.map((prompt) => (
              <div className="feedback-question-card" key={prompt.key}>
                <p className="feedback-question-title">{prompt.label}</p>
                <div className="feedback-scale" role="radiogroup" aria-label={prompt.label}>
                  {feedbackLikert.map((opt) => {
                    const active = feedback[prompt.key] === opt.value;
                    return (
                      <button
                        type="button"
                        key={`${prompt.key}-${opt.value}`}
                        className={`feedback-option ${active ? "active" : ""}`}
                        onClick={() => {
                          setFeedback((prev) => ({ ...prev, [prompt.key]: opt.value }));
                          setFeedbackStatus("idle");
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <label>
              Komentaras (optional)
              <textarea
                name="comment"
                rows={3}
                value={feedback.comment}
                onChange={(e) => {
                  setFeedback((prev) => ({ ...prev, comment: e.target.value }));
                  setFeedbackStatus("idle");
                }}
              />
            </label>
            <button type="submit">Išsaugoti įvertinimą</button>
            {feedbackStatus === "saved" ? <p className="small">Įvertinimas išsaugotas.</p> : null}
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
