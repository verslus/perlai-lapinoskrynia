type AnswerMap = Record<string, number | null | undefined>;

type Question = {
  id: string;
  questionOrder: number;
  dimension: string;
  isReverse: boolean;
};

type YsqSchema = {
  key: string;
  label: string;
  description?: string;
  itemOrders: number[];
};

type YsqConfig = {
  type: "ysq_r_v43";
  scaleMin?: number;
  scaleMax?: number;
  elevatedMinValue?: number;
  highMinValue?: number;
  elevatedCutoff?: number;
  statusLabels?: {
    elevated?: string;
    notElevated?: string;
  };
  schemas: YsqSchema[];
};

type GenericOption = {
  value: number;
  label: string;
};

type GottmanGenericConfig = {
  type: "gottman_generic_v1";
  responseOptionsByOrder?: Record<string, GenericOption[]>;
};

function normalizeYsq(config: unknown): YsqConfig | null {
  if (!config || typeof config !== "object") return null;
  const typed = config as Partial<YsqConfig>;
  if (typed.type !== "ysq_r_v43" || !Array.isArray(typed.schemas)) return null;
  return {
    type: "ysq_r_v43",
    schemas: typed.schemas,
    scaleMin: typed.scaleMin ?? 1,
    scaleMax: typed.scaleMax ?? 6,
    elevatedMinValue: typed.elevatedMinValue ?? 5,
    highMinValue: typed.highMinValue ?? 4,
    elevatedCutoff: typed.elevatedCutoff ?? 0.5,
    statusLabels: {
      elevated: typed.statusLabels?.elevated ?? "Elevated",
      notElevated: typed.statusLabels?.notElevated ?? "Not Elevated"
    }
  };
}

function normalizeGottmanGeneric(config: unknown): GottmanGenericConfig | null {
  if (!config || typeof config !== "object") return null;
  const typed = config as Partial<GottmanGenericConfig>;
  if (typed.type !== "gottman_generic_v1") return null;
  return {
    type: "gottman_generic_v1",
    responseOptionsByOrder: typed.responseOptionsByOrder ?? {}
  };
}

function scoreYsqAttempt(questions: Question[], answers: AnswerMap, rawConfig: unknown) {
  const config = normalizeYsq(rawConfig);
  if (!config) return null;

  const byOrder = new Map<number, number>();
  for (const q of questions) {
    const raw = answers[q.id];
    if (typeof raw !== "number") continue;
    const normalized = q.isReverse ? (config.scaleMax ?? 6) + (config.scaleMin ?? 1) - raw : raw;
    byOrder.set(q.questionOrder, normalized);
  }

  const dimensions = config.schemas.map((schema) => {
    const values = schema.itemOrders
      .map((order) => byOrder.get(order))
      .filter((v): v is number => typeof v === "number");

    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const elevatedRatio = values.length
      ? values.filter((v) => v >= (config.elevatedMinValue ?? 5)).length / values.length
      : 0;
    const highRatio = values.length
      ? values.filter((v) => v >= (config.highMinValue ?? 4)).length / values.length
      : 0;

    const elevated = elevatedRatio >= (config.elevatedCutoff ?? 0.5);

    return {
      dimension: schema.label,
      schemaKey: schema.key,
      avg: Number(avg.toFixed(2)),
      level: elevated
        ? config.statusLabels?.elevated ?? "Elevated"
        : config.statusLabels?.notElevated ?? "Not Elevated",
      elevatedPct: Number((elevatedRatio * 100).toFixed(1)),
      highPct: Number((highRatio * 100).toFixed(1)),
      answered: values.length,
      description: schema.description ?? ""
    };
  });

  const overallValues = dimensions.map((d) => d.avg).filter((v) => v > 0);
  const overall = overallValues.length
    ? Number((overallValues.reduce((a, b) => a + b, 0) / overallValues.length).toFixed(2))
    : 0;

  const elevatedCount = dimensions.filter((d) => d.level === (config.statusLabels?.elevated ?? "Elevated")).length;

  return {
    overall,
    dimensions,
    interpretation: `Padidėjusių schemų: ${elevatedCount} iš ${dimensions.length}`
  };
}

function scoreGottmanGenericAttempt(questions: Question[], answers: AnswerMap, rawConfig: unknown) {
  const config = normalizeGottmanGeneric(rawConfig);
  if (!config) return null;

  const perDimension: Record<string, number[]> = {};

  for (const q of questions) {
    const raw = answers[q.id];
    if (typeof raw !== "number") continue;

    const options = config.responseOptionsByOrder?.[String(q.questionOrder)] ?? [];
    const min = options.length ? Math.min(...options.map((o) => o.value)) : 1;
    const max = options.length ? Math.max(...options.map((o) => o.value)) : 6;
    const normalized = max > min ? ((raw - min) / (max - min)) * 100 : 0;

    perDimension[q.dimension] = perDimension[q.dimension] ?? [];
    perDimension[q.dimension].push(normalized);
  }

  const dimensions = Object.entries(perDimension).map(([dimension, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    let level = "high";
    if (avg < 34) level = "low";
    else if (avg < 67) level = "medium";

    return {
      dimension,
      avg: Number(avg.toFixed(2)),
      level,
      answered: values.length
    };
  });

  const overallValues = dimensions.map((d) => d.avg);
  const overall = overallValues.length
    ? Number((overallValues.reduce((a, b) => a + b, 0) / overallValues.length).toFixed(2))
    : 0;

  return {
    overall,
    dimensions,
    interpretation:
      overall < 34
        ? "Low agreement/safety signal. Consultant follow-up is recommended."
        : overall < 67
          ? "Moderate signal. Review highest-stress themes with consultant."
          : "High positive signal. Keep tracking and discuss nuanced areas."
  };
}

function scoreDefaultAttempt(questions: Question[], answers: AnswerMap) {
  const perDimension: Record<string, number[]> = {};

  for (const q of questions) {
    const raw = answers[q.id];
    if (typeof raw !== "number") continue;
    const normalized = q.isReverse ? 6 - raw : raw;
    perDimension[q.dimension] = perDimension[q.dimension] ?? [];
    perDimension[q.dimension].push(normalized);
  }

  const dimensions = Object.entries(perDimension).map(([dimension, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    let level = "aukštas";
    if (avg < 2.4) level = "žemas";
    else if (avg < 3.7) level = "vidutinis";

    return {
      dimension,
      avg: Number(avg.toFixed(2)),
      level,
      answered: values.length
    };
  });

  const overallValues = dimensions.map((d) => d.avg);
  const overall = overallValues.length
    ? Number((overallValues.reduce((a, b) => a + b, 0) / overallValues.length).toFixed(2))
    : 0;

  return {
    overall,
    dimensions,
    interpretation:
      overall < 2.4
        ? "Rekomenduojama skirti daugiau dėmesio miego higienos įpročiams ir aptarti rezultatus su konsultantu."
        : overall < 3.7
          ? "Rezultatas vidutinis. Yra keli stiprintini punktai, kuriuos verta aptarti su konsultantu."
          : "Rezultatas geras. Toliau palaikykite stabilų miego režimą ir stebėkite pokyčius."
  };
}

export function scoreAttempt(questions: Question[], answers: AnswerMap, scoringConfig?: unknown) {
  const ysq = scoreYsqAttempt(questions, answers, scoringConfig);
  if (ysq) return ysq;
  const generic = scoreGottmanGenericAttempt(questions, answers, scoringConfig);
  if (generic) return generic;
  return scoreDefaultAttempt(questions, answers);
}
