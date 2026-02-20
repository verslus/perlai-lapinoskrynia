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

function getPortalUi(language: string) {
  if (language === "en") {
    return {
      load: "Loading...",
      openError: "Could not open portal",
      genericError: "Error",
      personalTest: "Personal assessment",
      clientId: "Client ID",
      questionsCount: "questions",
      consent: "Consent",
      consentText:
        "By continuing, you confirm that you have read the rules, agree to data processing, and understand this assessment is not a medical diagnosis.",
      start: "Start test",
      questionLabel: "Question",
      back: "Back",
      skip: "Skip",
      finish: "Finish test",
      reportTitle: "Your report",
      reportViewed: "View recorded",
      reportTracking: "Recording view automatically...",
      overallScore: "Overall score",
      comparisonTitle: "Comparison with previous attempt",
      previous: "Previous",
      current: "Current",
      change: "Change",
      feedbackTitle: "Quick feedback",
      feedbackDone: "Feedback already submitted. Thank you.",
      feedbackSaved: "Feedback saved.",
      feedbackComment: "Comment (optional)",
      feedbackSave: "Save feedback",
      deleteData: "Delete my data",
      deletePrompt: 'Type "DELETE"',
      feedbackMissing: "Please answer all three feedback questions.",
      clarity: "How clear was it?",
      usefulness: "How useful was it?",
      interest: "How interesting was it?",
      feedbackScale: ["Not at all", "Rather no", "Neutral", "Rather yes", "Very much"]
    };
  }

  if (language === "ua") {
    return {
      load: "Завантаження...",
      openError: "Не вдалося відкрити портал",
      genericError: "Помилка",
      personalTest: "Особистий тест",
      clientId: "ID клієнта",
      questionsCount: "питань",
      consent: "Згода",
      consentText:
        "Продовжуючи, ви підтверджуєте, що ознайомилися з правилами, погоджуєтесь на обробку даних і розумієте, що тест не є медичним діагнозом.",
      start: "Почати тест",
      questionLabel: "Питання",
      back: "Назад",
      skip: "Пропустити",
      finish: "Завершити тест",
      reportTitle: "Ваш звіт",
      reportViewed: "Перегляд зафіксовано",
      reportTracking: "Перегляд фіксується автоматично...",
      overallScore: "Загальний бал",
      comparisonTitle: "Порівняння з попередньою спробою",
      previous: "Попередній",
      current: "Поточний",
      change: "Зміна",
      feedbackTitle: "Короткий відгук",
      feedbackDone: "Відгук уже збережено. Дякуємо.",
      feedbackSaved: "Відгук збережено.",
      feedbackComment: "Коментар (необов'язково)",
      feedbackSave: "Зберегти відгук",
      deleteData: "Видалити мої дані",
      deletePrompt: 'Введіть "ВИДАЛИТИ"',
      feedbackMissing: "Оберіть усі три відповіді оцінювання.",
      clarity: "Наскільки зрозуміло було?",
      usefulness: "Наскільки корисно було?",
      interest: "Наскільки цікаво було?",
      feedbackScale: ["Зовсім ні", "Скоріше ні", "Посередньо", "Скоріше так", "Дуже так"]
    };
  }

  return {
    load: "Kraunama...",
    openError: "Nepavyko atidaryti portalo",
    genericError: "Klaida",
    personalTest: "Asmeninis testas",
    clientId: "Kliento ID",
    questionsCount: "klausimų",
    consent: "Sutikimas",
    consentText:
      "Tęsdami patvirtinate, kad perskaitėte taisykles, sutinkate su duomenų tvarkymu ir suprantate, kad testas nėra medicininė diagnozė.",
    start: "Pradėti testą",
    questionLabel: "Klausimas",
    back: "Atgal",
    skip: "Praleisti",
    finish: "Baigti testą",
    reportTitle: "Jūsų ataskaita",
    reportViewed: "Peržiūra užfiksuota",
    reportTracking: "Peržiūra fiksuojama automatiškai...",
    overallScore: "Bendras balas",
    comparisonTitle: "Palyginimas su ankstesniu atlikimu",
    previous: "Ankstesnis",
    current: "Dabartinis",
    change: "Pokytis",
    feedbackTitle: "Trumpas įvertinimas",
    feedbackDone: "Įvertinimas jau išsaugotas. Ačiū už atsakymus.",
    feedbackSaved: "Įvertinimas išsaugotas.",
    feedbackComment: "Komentaras (optional)",
    feedbackSave: "Išsaugoti įvertinimą",
    deleteData: "Ištrinti mano duomenis",
    deletePrompt: 'Įrašykite "ISTRINTI"',
    feedbackMissing: "Pasirinkite visus tris įvertinimo atsakymus.",
    clarity: "Kiek buvo aišku?",
    usefulness: "Kiek buvo vertinga?",
    interest: "Kiek buvo įdomu?",
    feedbackScale: ["Visiškai ne", "Labiau ne", "Per vidurį", "Labiau taip", "Labai taip"]
  };
}

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
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [reportMarked, setReportMarked] = useState(false);

  const locale = data?.test.language ?? "lt";
  const ui = getPortalUi(locale);

  useEffect(() => {
    async function init() {
      const res = await fetch(`/api/portal/${token}/init`);
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? getPortalUi("lt").openError);
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
        setFeedbackSubmitted(true);
      }
      if (payload.latestAttempt?.status === "FINISHED" || payload.latestAttempt?.status === "REPORT_VIEWED") {
        setAttemptId(payload.latestAttempt.id);
        setPhase("report");
        setReportSeenAt(Date.now());
        setReportMarked(payload.latestAttempt.status === "REPORT_VIEWED");
      }
      setLoading(false);
    }
    init();
  }, [token]);

  const questions = data?.test.questions ?? [];
  const current = questions[index];
  const progress = questions.length ? Math.round(((index + 1) / questions.length) * 100) : 0;
  const fallbackLikert = getDefaultLikert(locale);
  const feedbackLikert = ui.feedbackScale.map((label, i) => ({ value: i + 1, label }));
  const feedbackPrompts: Array<{ key: FeedbackKey; label: string }> = [
    { key: "clarity", label: ui.clarity },
    { key: "usefulness", label: ui.usefulness },
    { key: "interest", label: ui.interest }
  ];

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
      setError(payload.error ?? ui.genericError);
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
      setError(payload.error ?? ui.genericError);
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

  async function markViewed(deltaOverrideSec?: number) {
    if (!attemptId || reportMarked) return;
    const delta = deltaOverrideSec ?? (reportSeenAt ? Math.floor((Date.now() - reportSeenAt) / 1000) : 0);
    await fetch(`/api/portal/${token}/report-viewed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, reportDurationSecDelta: Math.max(delta, 0) })
    });
    setReportMarked(true);
    setData((prev) =>
      prev?.latestAttempt
        ? {
            ...prev,
            latestAttempt: {
              ...prev.latestAttempt,
              status: "REPORT_VIEWED"
            }
          }
        : prev
    );
  }

  async function submitFeedback(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!attemptId) return;

    if (!feedback.clarity || !feedback.usefulness || !feedback.interest) {
      setError(ui.feedbackMissing);
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
    setFeedbackSubmitted(true);
    setData((prev) =>
      prev?.latestAttempt
        ? {
            ...prev,
            latestAttempt: {
              ...prev.latestAttempt,
              feedback: {
                clarity: feedback.clarity!,
                usefulness: feedback.usefulness!,
                interest: feedback.interest!,
                comment: feedback.comment || null
              }
            }
          }
        : prev
    );
  }

  useEffect(() => {
    if (phase !== "report" || !attemptId || reportMarked) return;
    const startedAt = reportSeenAt ?? Date.now();
    if (!reportSeenAt) {
      setReportSeenAt(startedAt);
    }
    const timer = window.setTimeout(() => {
      const deltaSec = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
      void markViewed(deltaSec);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [phase, attemptId, reportMarked, reportSeenAt]);

  async function deleteData() {
    const phrase = prompt(ui.deletePrompt);
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
    return <p>{ui.load}</p>;
  }

  if (error || !data) {
    return <p style={{ color: "#8c2a2a" }}>{error ?? ui.genericError}</p>;
  }

  return (
    <div className="portal-flow">
      <section className="card portal-hero">
        <div className="portal-hero-main">
          <p className="portal-overline">{ui.personalTest}</p>
          <h1>{data.test.title}</h1>
          <p className="small">
            {ui.clientId}: {data.portal.internalClientId}
          </p>
          <p className="portal-hero-description">{data.test.description}</p>
        </div>
        <div className="portal-badges">
          <span className="tag">{data.test.language.toUpperCase()}</span>
          <span className="tag">
            {questions.length} {ui.questionsCount}
          </span>
        </div>
      </section>

      {phase === "consent" ? (
        <section className="card portal-panel portal-consent">
          <h2>{ui.consent}</h2>
          {data.test.scoringConfig?.instructions?.user ? (
            <p style={{ marginBottom: 10 }}>{data.test.scoringConfig.instructions.user}</p>
          ) : null}
          <p>{ui.consentText}</p>
          <button onClick={start}>{ui.start}</button>
        </section>
      ) : null}

      {phase === "test" && current ? (
        <section className="card portal-panel portal-test-shell">
          <div className="row portal-test-head">
            <h2>
              {ui.questionLabel} {index + 1} / {questions.length}
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
                </button>
              );
            })}
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="secondary" onClick={() => setIndex((x) => Math.max(0, x - 1))}>
              {ui.back}
            </button>
            <button className="secondary" onClick={() => choose(null)}>
              {ui.skip}
            </button>
            {index === questions.length - 1 ? <button onClick={finish}>{ui.finish}</button> : null}
          </div>
        </section>
      ) : null}

      {phase === "report" ? (
        <section className="card portal-panel">
          <div className="row portal-test-head">
            <h2>{ui.reportTitle}</h2>
            <span className="small">{reportMarked ? ui.reportViewed : ui.reportTracking}</span>
          </div>
          <div className="report-summary">
            <p className="small">{ui.overallScore}</p>
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
          <h3>{ui.comparisonTitle}</h3>
          <p>
            {ui.previous}: {data.previousAttempt?.score?.overall ?? "-"} | {ui.current}: {data.latestAttempt?.score?.overall ?? "-"}
            {deltaLabel ? ` | ${ui.change}: ${deltaLabel}` : ""}
          </p>

          <h3>{ui.feedbackTitle}</h3>
          {feedbackSubmitted ? (
            <p className="small">{ui.feedbackDone}</p>
          ) : (
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
                {ui.feedbackComment}
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
              <button type="submit">{ui.feedbackSave}</button>
              {feedbackStatus === "saved" ? <p className="small">{ui.feedbackSaved}</p> : null}
            </form>
          )}

          <div style={{ marginTop: 16 }}>
            <button className="secondary" onClick={deleteData}>
              {ui.deleteData}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
