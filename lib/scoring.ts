type AnswerMap = Record<string, number | null | undefined>;

type Question = {
  id: string;
  dimension: string;
  isReverse: boolean;
};

export function scoreAttempt(questions: Question[], answers: AnswerMap) {
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
