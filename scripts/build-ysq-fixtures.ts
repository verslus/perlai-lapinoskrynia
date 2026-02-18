import fs from "node:fs/promises";
import path from "node:path";
import xlsx from "xlsx";

type SchemaDef = {
  key: string;
  label: string;
  description: string;
  itemOrders: number[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s*\/\s*/g, "-")
    .replace(/[()]/g, "")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sheetCell(ws: xlsx.WorkSheet, col: string, row: number) {
  return ws[`${col}${row}`]?.v;
}

function parseRangeFromFormula(formula: string) {
  const m = formula.match(/D(\d+):D(\d+)/);
  if (!m) {
    throw new Error(`Nepavyko ištraukti intervalo iš formulės: ${formula}`);
  }
  return { start: Number(m[1]), end: Number(m[2]) };
}

function parseWorkbook(opts: {
  filePath: string;
  inputSheet: string;
  profileSheet: string;
  language: "en" | "ru";
  title: string;
  description: string;
  statusLabels: { elevated: string; notElevated: string };
}) {
  const wb = xlsx.readFile(opts.filePath, { cellFormula: true, cellText: false });
  const input = wb.Sheets[opts.inputSheet];
  const profile = wb.Sheets[opts.profileSheet];
  if (!input || !profile) {
    throw new Error(`Nerasti sheet'ai ${opts.inputSheet} / ${opts.profileSheet}`);
  }

  const schemas: SchemaDef[] = [];
  const seen = new Map<string, number>();

  for (let row = 7; row <= 80; row += 1) {
    const labelRaw = sheetCell(profile, "B", row);
    const avgFormula = profile[`C${row}`]?.f;
    if (!labelRaw || !avgFormula) continue;

    const label = String(labelRaw).trim();
    const { start, end } = parseRangeFromFormula(avgFormula);
    const itemOrders = Array.from({ length: end - start + 1 }, (_, idx) => start - 6 + idx);
    const descRaw = sheetCell(input, "F", start) ?? "";
    const baseKey = slugify(label);
    const count = seen.get(baseKey) ?? 0;
    seen.set(baseKey, count + 1);
    const key = count === 0 ? baseKey : `${baseKey}-${count + 1}`;

    schemas.push({
      key,
      label,
      description: String(descRaw).replace(/\s+/g, " ").trim(),
      itemOrders
    });
  }

  const orderToSchema = new Map<number, string>();
  for (const schema of schemas) {
    for (const order of schema.itemOrders) {
      orderToSchema.set(order, schema.key);
    }
  }

  const questions: Array<{ order: number; text: string; dimension: string; isReverse: boolean }> = [];
  for (let row = 7; row <= 122; row += 1) {
    const order = Number(sheetCell(input, "B", row));
    const text = sheetCell(input, "C", row);
    if (!order || !text) continue;

    const dimension = orderToSchema.get(order);
    if (!dimension) {
      throw new Error(`Nerastas schema raktas klausimui #${order} (${opts.language})`);
    }

    questions.push({
      order,
      text: String(text).replace(/\s+/g, " ").trim(),
      dimension,
      isReverse: false
    });
  }

  if (questions.length !== 116) {
    throw new Error(`Tikėtasi 116 klausimų, gauta ${questions.length} (${opts.language})`);
  }

  return {
    slug: "ysq-r-v43",
    version: 1,
    language: opts.language,
    title: opts.title,
    description: opts.description,
    questions,
    scoringConfigJson: {
      type: "ysq_r_v43",
      scaleMin: 1,
      scaleMax: 6,
      elevatedMinValue: 5,
      highMinValue: 4,
      elevatedCutoff: 0.5,
      statusLabels: opts.statusLabels,
      schemas
    }
  };
}

async function main() {
  const enPath =
    process.env.YSQ_EN_XLSX ??
    "/Users/az/Downloads/YSQ-R+Scorer+Version+4.3+Final+(22.08.24).xlsx";
  const ruPath =
    process.env.YSQ_RU_XLSX ?? "/Users/az/Downloads/YSQ-R_RU_Подсчет_результатов.xlsx";

  const en = parseWorkbook({
    filePath: enPath,
    inputSheet: "Input Data",
    profileSheet: "Schema Profile",
    language: "en",
    title: "YSQ-R (English)",
    description: "Young Schema Questionnaire Revised v4.3 (EN)",
    statusLabels: { elevated: "Elevated", notElevated: "Not Elevated" }
  });

  const ru = parseWorkbook({
    filePath: ruPath,
    inputSheet: "Исходные данные",
    profileSheet: "Схема профиля",
    language: "ru",
    title: "YSQ-R (Русский)",
    description: "Опросник ранних дезадаптивных схем YSQ-R v4.3 (RU)",
    statusLabels: { elevated: "Повышено", notElevated: "Не повышено" }
  });

  await fs.mkdir(path.join(process.cwd(), "prisma", "fixtures"), { recursive: true });
  await fs.writeFile(
    path.join(process.cwd(), "prisma", "fixtures", "ysq-r-en-v1.json"),
    JSON.stringify(en, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(process.cwd(), "prisma", "fixtures", "ysq-r-ru-v1.json"),
    JSON.stringify(ru, null, 2),
    "utf8"
  );

  console.log("Paruošti fixture failai: prisma/fixtures/ysq-r-en-v1.json, prisma/fixtures/ysq-r-ru-v1.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
