import fs from "node:fs/promises";
import path from "node:path";

type Locale = "en" | "lt" | "ua";

type Fixture = {
  slug: string;
  version: number;
  language: Locale;
  title: string;
  description: string;
  scoringConfigJson: {
    source?: { pdfFile?: string; questionnaireId?: string };
    instructions?: { user?: string; consultant?: string; admin?: string };
    responseFormat?: string;
    responseOptionsByOrder?: Record<string, Array<{ value: number; label: string }>>;
  };
  questions: Array<{ order: number; text: string }>;
};

function esc(value: unknown) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatOptions(options: Array<{ value: number; label: string }> | undefined) {
  if (!options?.length) return "";
  return options.map((o) => `${o.value}=${o.label}`).join(" | ");
}

async function main() {
  const fixturePath = path.join(process.cwd(), "prisma", "fixtures", "gottman-fixtures.json");
  const raw = await fs.readFile(fixturePath, "utf8");
  const fixtures = JSON.parse(raw) as Fixture[];

  const srh = fixtures.filter((f) => f.slug === "gottman-sound-relationship-house-questionnaires");
  if (!srh.length) throw new Error("SRH fixture nerastas");

  const byVersion = new Map<number, Record<Locale, Fixture>>();
  for (const f of srh) {
    const bucket = byVersion.get(f.version) ?? ({} as Record<Locale, Fixture>);
    bucket[f.language] = f;
    byVersion.set(f.version, bucket);
  }

  const headers = [
    "slug",
    "version",
    "test_key",
    "pdf_file",
    "title_en",
    "title_lt",
    "title_ua",
    "description_en",
    "description_lt",
    "description_ua",
    "instruction_user_en",
    "instruction_user_lt",
    "instruction_user_ua",
    "instruction_consultant_en",
    "instruction_consultant_lt",
    "instruction_consultant_ua",
    "instruction_admin_en",
    "instruction_admin_lt",
    "instruction_admin_ua",
    "response_format_en",
    "response_format_lt",
    "response_format_ua",
    "question_order",
    "question_en",
    "question_lt",
    "question_ua",
    "scale_en",
    "scale_lt",
    "scale_ua"
  ];

  const lines = [headers.join(",")];

  for (const [version, langMap] of [...byVersion.entries()].sort((a, b) => a[0] - b[0])) {
    const en = langMap.en;
    const lt = langMap.lt;
    const ua = langMap.ua;
    if (!en || !lt || !ua) continue;

    const total = Math.max(en.questions.length, lt.questions.length, ua.questions.length);

    for (let i = 0; i < total; i += 1) {
      const order = i + 1;
      const enScale = formatOptions(en.scoringConfigJson.responseOptionsByOrder?.[String(order)]);
      const ltScale = formatOptions(lt.scoringConfigJson.responseOptionsByOrder?.[String(order)]);
      const uaScale = formatOptions(ua.scoringConfigJson.responseOptionsByOrder?.[String(order)]);

      const row = [
        en.slug,
        version,
        en.scoringConfigJson.source?.questionnaireId ?? "",
        en.scoringConfigJson.source?.pdfFile ?? "",
        en.title,
        lt.title,
        ua.title,
        en.description,
        lt.description,
        ua.description,
        en.scoringConfigJson.instructions?.user ?? "",
        lt.scoringConfigJson.instructions?.user ?? "",
        ua.scoringConfigJson.instructions?.user ?? "",
        en.scoringConfigJson.instructions?.consultant ?? "",
        lt.scoringConfigJson.instructions?.consultant ?? "",
        ua.scoringConfigJson.instructions?.consultant ?? "",
        en.scoringConfigJson.instructions?.admin ?? "",
        lt.scoringConfigJson.instructions?.admin ?? "",
        ua.scoringConfigJson.instructions?.admin ?? "",
        en.scoringConfigJson.responseFormat ?? "",
        lt.scoringConfigJson.responseFormat ?? "",
        ua.scoringConfigJson.responseFormat ?? "",
        order,
        en.questions[i]?.text ?? "",
        lt.questions[i]?.text ?? "",
        ua.questions[i]?.text ?? "",
        enScale,
        ltScale,
        uaScale
      ];

      lines.push(row.map(esc).join(","));
    }
  }

  await fs.mkdir(path.join(process.cwd(), "docs"), { recursive: true });
  const out = path.join(process.cwd(), "docs", "srh-house-questionnaire-translations-en-lt-ua.csv");
  await fs.writeFile(out, lines.join("\n"), "utf8");
  console.log(`Paruošta: ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
