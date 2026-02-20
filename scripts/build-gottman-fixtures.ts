import fs from "node:fs/promises";
import path from "node:path";
import xlsx from "xlsx";

type Locale = "en" | "lt" | "ua";
type SourceName = "csv_primary" | "csv_secondary";

type RowNorm = {
  source: SourceName;
  questionnaireId: string;
  questionnaireNameEn: string;
  questionnaireNameLt: string;
  questionnaireNameUa: string;
  descriptionEn: string;
  descriptionLt: string;
  descriptionUa: string;
  responseFormatEn: string;
  responseFormatLt: string;
  responseFormatUa: string;
  responseTypeRaw: string;
  itemNumberRaw: string;
  itemEn: string;
  itemLt: string;
  itemUa: string;
};

type QuestionnaireData = {
  source: SourceName;
  questionnaireId: string;
  names: Record<Locale, string>;
  descriptions: Record<Locale, string>;
  responseFormats: Record<Locale, string>;
  itemResponseTypeRaw: string;
  items: Array<{ itemNumberRaw: string; text: Record<Locale, string>; responseTypeRaw: string }>;
};

type Fixture = {
  slug: string;
  version: number;
  language: Locale;
  title: string;
  description: string;
  scoringConfigJson: {
    type: "gottman_generic_v1";
    source: {
      csvSource: SourceName;
      questionnaireId: string;
      questionnaireNameEn: string;
      pdfFile: string;
    };
    scale: {
      normalizedMin: number;
      normalizedMax: number;
    };
    responseOptionsByOrder: Record<number, Array<{ value: number; label: string }>>;
    instructions: {
      user: string;
      consultant: string;
      admin: string;
    };
    responseFormat: string;
  };
  questions: Array<{
    order: number;
    text: string;
    dimension: string;
    isReverse: boolean;
  }>;
};

type DiffSummary = {
  key: string;
  title: string;
  onlyInPrimary: boolean;
  onlyInSecondary: boolean;
  different: boolean;
  primaryItems: number;
  secondaryItems: number;
};

const SOURCE_FILES: Record<SourceName, string> = {
  csv_primary: "/Users/az/Downloads/gottman_questionnaires_lt_ua_en.csv",
  csv_secondary: "/Users/az/Downloads/gottman_klausimynai_en_lt_ua.csv"
};

const PDF_BY_FAMILY: Record<string, { file: string; title: string; instructionEn: string }> = {
  "01": {
    file: "01-locke-wallace.pdf",
    title: "Locke-Wallace Relationship Adjustment Test",
    instructionEn: "Circle the point that best matches your current relationship happiness and answer all follow-up items."
  },
  "03": {
    file: "03-srh-questionnaires.pdf",
    title: "Sound Relationship House Questionnaires",
    instructionEn: "Read each statement and mark the applicable response (mostly TRUE/FALSE)."
  },
  "04": {
    file: "04-19-areas-checklist.pdf",
    title: "Gottman 19 Areas Checklist",
    instructionEn: "Rate each relationship area based on your current reality, then discuss both solvable and perpetual themes."
  },
  "05": {
    file: "05-three-detour-scales.pdf",
    title: "Three Detour Scales",
    instructionEn: "Answer Yes/No for each statement in Chaos, Meta-Emotion, and Family History scales."
  },
  "06": {
    file: "06-eaq.pdf",
    title: "Gottman Emotional Abuse Questionnaire",
    instructionEn: "Mark TRUE/FALSE for each statement about emotional safety in the relationship."
  },
  "07": {
    file: "07-control-fear-suicide-and-acts-of-physical-aggression.pdf",
    title: "Control/Fear/Suicide/Physical Aggression",
    instructionEn: "Answer YES/NO based on the past 6 months and current safety risk indicators."
  },
  "09": {
    file: "09-cage-aid-and-b-mast.pdf",
    title: "CAGE-AID and b-MAST",
    instructionEn: "Answer substance-use screening items honestly; positive screens require consultant follow-up."
  }
};

function tryFixMojibake(value: string) {
  // Handles UTF-8 text that was decoded as Latin-1/Windows-1252 (e.g. "ÐÑÑ...")
  if (!(value.includes("Ð") || value.includes("Ñ") || value.includes("Ã") || value.includes("â"))) {
    return value;
  }
  const fixed = Buffer.from(value, "latin1").toString("utf8");
  const looksFixed = /[\u0400-\u04FFąčęėįšųūžĄČĘĖĮŠŲŪŽ]/.test(fixed);
  return looksFixed ? fixed : value;
}

function normalizeWhitespace(value: string) {
  return tryFixMojibake(value).replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function canonicalQuestionnaireKey(source: SourceName, questionnaireId: string, questionnaireNameEn: string) {
  const id = questionnaireId.toLowerCase();

  if (source === "csv_primary") {
    const map: Record<string, string> = {
      lw: "locke-wallace",
      "srh-lm": "srh-house",
      "srh-fa": "srh-house",
      "srh-tt": "srh-house",
      "srh-nso": "srh-house",
      "srh-hs": "srh-house",
      "srh-ai": "srh-house",
      "srh-ra": "srh-house",
      "srh-co": "srh-house",
      "srh-gp": "srh-house",
      "srh-4h": "srh-house",
      "srh-fl": "srh-house",
      "srh-ed": "srh-house",
      "srh-srp": "srh-house",
      "srh-tr": "srh-house",
      "srh-cm": "srh-house",
      "srh-sm": "srh-house",
      eaq: "eaq",
      ctrl: "control",
      fear: "fear",
      suic: "suicide-potential",
      phys: "physical-aggression",
      cage: "cage-aid",
      bmast: "b-mast",
      chaos: "detour-chaos",
      meta: "detour-meta-emotions",
      famhx: "detour-family-history"
    };
    if (map[id]) return map[id];
    if (id.startsWith("19a-")) return `19areas-${id}`;
  } else {
    const map: Record<string, string> = {
      "01": "locke-wallace",
      "1": "locke-wallace",
      "02a": "srh-house",
      "02b": "srh-house",
      "02c": "srh-house",
      "02d": "srh-house",
      "02e": "srh-house",
      "02f": "srh-house",
      "02g": "srh-house",
      "02h": "srh-house",
      "02i": "srh-house",
      "02j": "srh-house",
      "02k": "srh-house",
      "02l": "srh-house",
      "02m": "srh-house",
      "02n": "srh-house",
      "02o": "srh-house",
      "02p": "srh-house",
      "3": "19areas-master",
      "04a": "detour-chaos",
      "04b": "detour-meta-emotions",
      "04c": "detour-family-history",
      "5": "eaq",
      "06a": "control",
      "06b": "fear",
      "06c": "suicide-potential",
      "06d": "physical-aggression",
      "07a": "cage-aid",
      "07b": "b-mast"
    };
    if (map[id]) return map[id];
  }

  return normKey(questionnaireNameEn || questionnaireId);
}

function canonicalText(value: string) {
  return value
    .toLowerCase()
    .replace(/[“”"'`´’]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compareItemOrder(a: string, b: string) {
  const pa = a.match(/^(\d+)([a-z]*)$/i);
  const pb = b.match(/^(\d+)([a-z]*)$/i);
  if (pa && pb) {
    const na = Number(pa[1]);
    const nb = Number(pb[1]);
    if (na !== nb) return na - nb;
    return (pa[2] || "").localeCompare(pb[2] || "", "en");
  }
  return a.localeCompare(b, "en");
}

function readRows(source: SourceName): RowNorm[] {
  const wb = xlsx.readFile(SOURCE_FILES[source], { raw: false, cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const rows: RowNorm[] = [];

  for (const r of rawRows) {
    const keyMap = new Map<string, unknown>();
    for (const [k, v] of Object.entries(r)) {
      keyMap.set(k.toLowerCase(), v);
    }

    const questionnaireId = String(
      keyMap.get("questionnaire_id") ?? keyMap.get("questionnaireid") ?? ""
    ).trim();

    const itemNumberRaw = String(keyMap.get("item_number") ?? keyMap.get("itemnumber") ?? "").trim();
    if (!questionnaireId || !itemNumberRaw) continue;

    rows.push({
      source,
      questionnaireId,
      questionnaireNameEn: normalizeWhitespace(
        String(keyMap.get("questionnaire_name_en") ?? keyMap.get("questionnairenameen") ?? "")
      ),
      questionnaireNameLt: normalizeWhitespace(
        String(keyMap.get("questionnaire_name_lt") ?? keyMap.get("questionnairenamelt") ?? "")
      ),
      questionnaireNameUa: normalizeWhitespace(
        String(keyMap.get("questionnaire_name_ua") ?? keyMap.get("questionnairenameua") ?? "")
      ),
      descriptionEn: normalizeWhitespace(String(keyMap.get("description_en") ?? "")),
      descriptionLt: normalizeWhitespace(
        String(keyMap.get("questionnaire_description_lt") ?? keyMap.get("description_lt") ?? "")
      ),
      descriptionUa: normalizeWhitespace(
        String(keyMap.get("questionnaire_description_ua") ?? keyMap.get("description_ua") ?? "")
      ),
      responseFormatEn: normalizeWhitespace(String(keyMap.get("response_format_en") ?? "")),
      responseFormatLt: normalizeWhitespace(String(keyMap.get("response_format_lt") ?? "")),
      responseFormatUa: normalizeWhitespace(String(keyMap.get("response_format_ua") ?? "")),
      responseTypeRaw: normalizeWhitespace(String(keyMap.get("response_type") ?? "")),
      itemNumberRaw,
      itemEn: normalizeWhitespace(String(keyMap.get("question_en") ?? keyMap.get("item_en") ?? "")),
      itemLt: normalizeWhitespace(String(keyMap.get("question_lt") ?? keyMap.get("item_lt") ?? "")),
      itemUa: normalizeWhitespace(String(keyMap.get("question_ua") ?? keyMap.get("item_ua") ?? ""))
    });
  }

  return rows;
}

function groupQuestionnaires(rows: RowNorm[]): Map<string, QuestionnaireData> {
  const grouped = new Map<string, QuestionnaireData>();

  for (const row of rows) {
    const key = `${row.source}::${row.questionnaireId}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        source: row.source,
        questionnaireId: row.questionnaireId,
        names: {
          en: row.questionnaireNameEn,
          lt: row.questionnaireNameLt,
          ua: row.questionnaireNameUa
        },
        descriptions: {
          en: row.descriptionEn,
          lt: row.descriptionLt,
          ua: row.descriptionUa
        },
        responseFormats: {
          en: row.responseFormatEn,
          lt: row.responseFormatLt,
          ua: row.responseFormatUa
        },
        itemResponseTypeRaw: row.responseTypeRaw,
        items: [
          {
            itemNumberRaw: row.itemNumberRaw,
            text: { en: row.itemEn, lt: row.itemLt, ua: row.itemUa },
            responseTypeRaw: row.responseTypeRaw
          }
        ]
      });
      continue;
    }

    existing.names.en ||= row.questionnaireNameEn;
    existing.names.lt ||= row.questionnaireNameLt;
    existing.names.ua ||= row.questionnaireNameUa;
    existing.descriptions.en ||= row.descriptionEn;
    existing.descriptions.lt ||= row.descriptionLt;
    existing.descriptions.ua ||= row.descriptionUa;
    existing.responseFormats.en ||= row.responseFormatEn;
    existing.responseFormats.lt ||= row.responseFormatLt;
    existing.responseFormats.ua ||= row.responseFormatUa;
    existing.itemResponseTypeRaw ||= row.responseTypeRaw;

    existing.items.push({
      itemNumberRaw: row.itemNumberRaw,
      text: { en: row.itemEn, lt: row.itemLt, ua: row.itemUa },
      responseTypeRaw: row.responseTypeRaw
    });
  }

  for (const q of grouped.values()) {
    q.items.sort((a, b) => compareItemOrder(a.itemNumberRaw, b.itemNumberRaw));
  }

  return grouped;
}

function normalizeForCanonicalKey(data: QuestionnaireData, canonicalKey: string): QuestionnaireData {
  if (canonicalKey !== "srh-house") return data;

  return {
    ...data,
    questionnaireId: "srh-house",
    names: {
      en: "Sound Relationship House Questionnaires",
      lt: "Tvirtų santykių namo klausimynai",
      ua: "Опитувальники Будинку здорових стосунків"
    },
    descriptions: {
      en:
        data.descriptions.en ||
        "Combined Sound Relationship House questionnaire pack (all SRH subscales in one assessment).",
      lt:
        data.descriptions.lt ||
        "Sujungtas Tvirtų santykių namo klausimynų paketas (visos SRH subskalės viename vertinime).",
      ua:
        data.descriptions.ua ||
        "Об'єднаний пакет опитувальників Будинку здорових стосунків (усі підшкали SRH в одному тесті)."
    },
    items: data.items.map((item) => ({
      ...item,
      itemNumberRaw: `${data.questionnaireId}-${item.itemNumberRaw}`
    }))
  };
}

function mergeQuestionnaireData(base: QuestionnaireData, incoming: QuestionnaireData): QuestionnaireData {
  return {
    ...base,
    names: {
      en: base.names.en || incoming.names.en,
      lt: base.names.lt || incoming.names.lt,
      ua: base.names.ua || incoming.names.ua
    },
    descriptions: {
      en: base.descriptions.en || incoming.descriptions.en,
      lt: base.descriptions.lt || incoming.descriptions.lt,
      ua: base.descriptions.ua || incoming.descriptions.ua
    },
    responseFormats: {
      en: base.responseFormats.en || incoming.responseFormats.en,
      lt: base.responseFormats.lt || incoming.responseFormats.lt,
      ua: base.responseFormats.ua || incoming.responseFormats.ua
    },
    itemResponseTypeRaw: base.itemResponseTypeRaw || incoming.itemResponseTypeRaw,
    items: [...base.items, ...incoming.items].sort((a, b) => compareItemOrder(a.itemNumberRaw, b.itemNumberRaw))
  };
}

function resolvePdfFamily(questionnaireId: string, nameEn: string): string {
  const id = questionnaireId.toLowerCase();
  const name = nameEn.toLowerCase();

  if (id === "lw" || id === "01" || id === "1" || name.includes("locke-wallace")) return "01";
  if (id.startsWith("srh-") || id.startsWith("02") || name.includes("sound relationship house")) return "03";
  if (id.startsWith("19a-") || id === "3" || name.includes("19 areas checklist")) return "04";
  if (id === "chaos" || id === "meta" || id === "famhx" || id.startsWith("04") || name.includes("detour"))
    return "05";
  if (id === "eaq" || id === "5" || name.includes("emotional abuse questionnaire")) return "06";
  if (
    id === "ctrl" ||
    id === "fear" ||
    id === "suic" ||
    id === "phys" ||
    id.startsWith("06") ||
    name.includes("acts of physical aggression")
  ) {
    return "07";
  }
  if (id === "cage" || id === "bmast" || id.startsWith("07") || name.includes("cage") || name.includes("mast")) {
    return "09";
  }
  return "03";
}

function optionsForKind(kind: string, locale: Locale): Array<{ value: number; label: string }> {
  const k = kind.toLowerCase();
  if (k.includes("true") && k.includes("false")) {
    return locale === "lt"
      ? [
          { value: 1, label: "Tiesa" },
          { value: 2, label: "Netiesa" }
        ]
      : locale === "ua"
        ? [
            { value: 1, label: "Правда" },
            { value: 2, label: "Неправда" }
          ]
        : [
            { value: 1, label: "True" },
            { value: 2, label: "False" }
          ];
  }

  if (k.includes("yes") && k.includes("no")) {
    return locale === "lt"
      ? [
          { value: 1, label: "Taip" },
          { value: 2, label: "Ne" }
        ]
      : locale === "ua"
        ? [
            { value: 1, label: "Так" },
            { value: 2, label: "Ні" }
          ]
        : [
            { value: 1, label: "Yes" },
            { value: 2, label: "No" }
          ];
  }

  const letters = k.match(/\(([a-z](?:\/[a-z])+?)\)/i)?.[1];
  if (letters) {
    const count = letters.split("/").length;
    return Array.from({ length: count }, (_, i) => ({ value: i + 1, label: String.fromCharCode(65 + i) }));
  }

  if (k.includes("1-7") || k.includes("very unhappy") || k.includes("perfectly happy")) {
    return Array.from({ length: 7 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  }

  if (k.includes("6-point") || k.includes("always agree") || k.includes("always disagree")) {
    return Array.from({ length: 6 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  }

  if (k.includes("1-5") || k.includes("five-point") || k.includes("1 to 5") || k.includes("1–5")) {
    return Array.from({ length: 5 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  }

  return Array.from({ length: 6 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
}

function detectQuestionnaireSignature(data: QuestionnaireData): string {
  if (data.questionnaireId === "srh-house") {
    return data.items.map((item) => canonicalText(item.text.en)).join("|");
  }
  return data.items
    .map((item) => `${item.itemNumberRaw}:${canonicalText(item.text.en)}`)
    .join("|");
}

function makeUserInstruction(locale: Locale, pdfHint: string, responseHint: string) {
  if (locale === "lt") {
    return `Instrukcija: atidžiai perskaitykite kiekvieną teiginį ir pasirinkite vieną atsakymą. Šaltinis: ${pdfHint}. Formatas: ${responseHint || "pagal pateiktas pasirinktis"}.`;
  }
  if (locale === "ua") {
    return `Інструкція: уважно прочитайте кожне твердження та виберіть одну відповідь. Джерело: ${pdfHint}. Формат: ${responseHint || "за наданими варіантами"}.`;
  }
  return `Instruction: read each statement carefully and choose one answer. Source: ${pdfHint}. Format: ${responseHint || "as shown in options"}.`;
}

function makeConsultantInstruction(locale: Locale) {
  if (locale === "lt") {
    return "Konsultantui: peržiūrėkite bendrą normalizuotą balą (0-100), aptarkite aukščiausius punktus ir rizikos indikatorius su klientu.";
  }
  if (locale === "ua") {
    return "Для консультанта: перегляньте загальний нормалізований бал (0-100), обговоріть найвищі пункти та індикатори ризику з клієнтом.";
  }
  return "For consultant: review normalized overall score (0-100), then discuss top items and risk indicators with the client.";
}

function makeAdminInstruction(locale: Locale, pdfFile: string, source: SourceName) {
  if (locale === "lt") {
    return `Admin: klausimyno aprašas ir instrukcijos remiasi PDF (${pdfFile}); klausimų vertimai importuoti iš ${source}.`;
  }
  if (locale === "ua") {
    return `Адмін: опис та інструкції анкети базуються на PDF (${pdfFile}); переклади імпортовано з ${source}.`;
  }
  return `Admin: questionnaire description and instructions are based on PDF (${pdfFile}); translations imported from ${source}.`;
}

function enrich(data: QuestionnaireData, fallback?: QuestionnaireData): QuestionnaireData {
  const merged: QuestionnaireData = {
    ...data,
    names: {
      en: data.names.en || fallback?.names.en || data.questionnaireId,
      lt: data.names.lt || fallback?.names.lt || data.names.en,
      ua: data.names.ua || fallback?.names.ua || data.names.en
    },
    descriptions: {
      en: data.descriptions.en || fallback?.descriptions.en || "",
      lt: data.descriptions.lt || fallback?.descriptions.lt || data.descriptions.en,
      ua: data.descriptions.ua || fallback?.descriptions.ua || data.descriptions.en
    },
    responseFormats: {
      en: data.responseFormats.en || fallback?.responseFormats.en || data.itemResponseTypeRaw,
      lt: data.responseFormats.lt || fallback?.responseFormats.lt || data.responseFormats.en,
      ua: data.responseFormats.ua || fallback?.responseFormats.ua || data.responseFormats.en
    },
    itemResponseTypeRaw: data.itemResponseTypeRaw || fallback?.itemResponseTypeRaw || ""
  };

  merged.items = data.items.map((item, index) => {
    const fb =
      data.questionnaireId === "srh-house"
        ? fallback?.items[index]
        : fallback?.items.find((x) => x.itemNumberRaw === item.itemNumberRaw);
    return {
      ...item,
      text: {
        en: item.text.en || fb?.text.en || "",
        lt: item.text.lt || fb?.text.lt || item.text.en || fb?.text.en || "",
        ua: item.text.ua || fb?.text.ua || item.text.en || fb?.text.en || ""
      },
      responseTypeRaw: item.responseTypeRaw || fb?.responseTypeRaw || merged.itemResponseTypeRaw
    };
  });

  return merged;
}

function buildFixturesForVersion(args: {
  slug: string;
  version: number;
  data: QuestionnaireData;
  fallback?: QuestionnaireData;
}): Fixture[] {
  const merged = enrich(args.data, args.fallback);
  const nameEn = merged.names.en || merged.questionnaireId;
  const family = resolvePdfFamily(merged.questionnaireId, nameEn);
  const pdf = PDF_BY_FAMILY[family];

  const sortedItems = merged.items.slice().sort((a, b) => compareItemOrder(a.itemNumberRaw, b.itemNumberRaw));

  return (["en", "lt", "ua"] as const).map((language) => {
    const responseFormat = merged.responseFormats[language] || merged.responseFormats.en || merged.itemResponseTypeRaw;
    const responseOptionsByOrder: Record<number, Array<{ value: number; label: string }>> = {};

    const questions = sortedItems.map((item, index) => {
        const order = index + 1;
        const kind =
          item.responseTypeRaw ||
          merged.responseFormats[language] ||
          merged.responseFormats.en ||
          merged.itemResponseTypeRaw ||
          "";
        responseOptionsByOrder[order] = optionsForKind(kind, language);

        const text = item.text[language] || item.text.en || `[missing ${language}]`;
        return {
          order,
          text,
          dimension: args.slug,
          isReverse: false
        };
      });

    const description =
      merged.descriptions[language] ||
      merged.descriptions.en ||
      (language === "lt"
        ? `Klausimynas: ${merged.names.lt || merged.names.en}`
        : language === "ua"
          ? `Анкета: ${merged.names.ua || merged.names.en}`
          : `Questionnaire: ${merged.names.en}`);

    return {
      slug: args.slug,
      version: args.version,
      language,
      title: merged.names[language] || merged.names.en,
      description,
      scoringConfigJson: {
        type: "gottman_generic_v1",
        category: "GOTTMAN",
        source: {
          csvSource: merged.source,
          questionnaireId: merged.questionnaireId,
          questionnaireNameEn: nameEn,
          pdfFile: pdf.file
        },
        scale: {
          normalizedMin: 0,
          normalizedMax: 100
        },
        responseOptionsByOrder,
        instructions: {
          user: makeUserInstruction(language, pdf.title, responseFormat),
          consultant: makeConsultantInstruction(language),
          admin: makeAdminInstruction(language, pdf.file, merged.source)
        },
        responseFormat
      },
      questions
    };
  });
}

async function main() {
  const primaryRows = readRows("csv_primary");
  const secondaryRows = readRows("csv_secondary");

  const primaryGrouped = groupQuestionnaires(primaryRows);
  const secondaryGrouped = groupQuestionnaires(secondaryRows);

  const primaryByName = new Map<string, QuestionnaireData>();
  const secondaryByName = new Map<string, QuestionnaireData>();

  for (const q of primaryGrouped.values()) {
    if (q.questionnaireId.toLowerCase().startsWith("19a-")) continue;
    const key = canonicalQuestionnaireKey("csv_primary", q.questionnaireId, q.names.en);
    const normalized = normalizeForCanonicalKey(q, key);
    const existing = primaryByName.get(key);
    primaryByName.set(key, existing ? mergeQuestionnaireData(existing, normalized) : normalized);
  }
  for (const q of secondaryGrouped.values()) {
    const key = canonicalQuestionnaireKey("csv_secondary", q.questionnaireId, q.names.en);
    const normalized = normalizeForCanonicalKey(q, key);
    const existing = secondaryByName.get(key);
    secondaryByName.set(key, existing ? mergeQuestionnaireData(existing, normalized) : normalized);
  }

  const allKeys = new Set([...primaryByName.keys(), ...secondaryByName.keys()]);
  const fixtures: Fixture[] = [];
  const diffSummary: DiffSummary[] = [];
  const missingByLang = { en: 0, lt: 0, ua: 0 };

  for (const key of [...allKeys].sort()) {
    const p = primaryByName.get(key);
    const s = secondaryByName.get(key);

    const title = s?.names.en || p?.names.en || key;
    const slug = `gottman-${slugify(title)}`;

    if (p && s) {
      const same = detectQuestionnaireSignature(p) === detectQuestionnaireSignature(s);
      if (same) {
        fixtures.push(...buildFixturesForVersion({ slug, version: 1, data: s, fallback: p }));
      } else {
        fixtures.push(...buildFixturesForVersion({ slug, version: 1, data: s }));
        fixtures.push(...buildFixturesForVersion({ slug, version: 2, data: p }));
      }

      diffSummary.push({
        key,
        title,
        onlyInPrimary: false,
        onlyInSecondary: false,
        different: !same,
        primaryItems: p.items.length,
        secondaryItems: s.items.length
      });
      continue;
    }

    if (s) {
      fixtures.push(...buildFixturesForVersion({ slug, version: 1, data: s }));
      diffSummary.push({
        key,
        title,
        onlyInPrimary: false,
        onlyInSecondary: true,
        different: false,
        primaryItems: 0,
        secondaryItems: s.items.length
      });
      continue;
    }

    if (p) {
      fixtures.push(...buildFixturesForVersion({ slug, version: 1, data: p }));
      diffSummary.push({
        key,
        title,
        onlyInPrimary: true,
        onlyInSecondary: false,
        different: false,
        primaryItems: p.items.length,
        secondaryItems: 0
      });
    }
  }

  for (const f of fixtures) {
    for (const q of f.questions) {
      if (!q.text || q.text.startsWith("[missing")) {
        missingByLang[f.language] += 1;
      }
    }
  }

  await fs.mkdir(path.join(process.cwd(), "prisma", "fixtures"), { recursive: true });
  await fs.mkdir(path.join(process.cwd(), "docs"), { recursive: true });

  await fs.writeFile(
    path.join(process.cwd(), "prisma", "fixtures", "gottman-fixtures.json"),
    JSON.stringify(fixtures, null, 2),
    "utf8"
  );

  const onlyPrimary = diffSummary.filter((x) => x.onlyInPrimary).length;
  const onlySecondary = diffSummary.filter((x) => x.onlyInSecondary).length;
  const different = diffSummary.filter((x) => x.different).length;

  const md = [
    "# Gottman CSV palyginimo ataskaita",
    "",
    `- Pirminis failas: \`${SOURCE_FILES.csv_primary}\``,
    `- Antrinis failas: \`${SOURCE_FILES.csv_secondary}\``,
    `- Bendras sujungtų klausimynų kiekis: **${diffSummary.length}**`,
    `- Tik pirminiame: **${onlyPrimary}**`,
    `- Tik antriniame: **${onlySecondary}**`,
    `- Besiskiriantys tarp abiejų (sukurta atskira versija): **${different}**`,
    "",
    "## Trūkstami klausimų vertimai po sujungimo",
    `- EN: ${missingByLang.en}`,
    `- LT: ${missingByLang.lt}`,
    `- UA: ${missingByLang.ua}`,
    "",
    "## Klausimynų statusas",
    "| Questionnaire (EN) | Status | Primary items | Secondary items |",
    "|---|---:|---:|---:|",
    ...diffSummary
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((row) => {
        const status = row.different
          ? "DIFF -> atskira versija"
          : row.onlyInPrimary
            ? "Tik primary"
            : row.onlyInSecondary
              ? "Tik secondary"
              : "Sutampa";
        return `| ${row.title} | ${status} | ${row.primaryItems} | ${row.secondaryItems} |`;
      })
  ].join("\n");

  await fs.writeFile(path.join(process.cwd(), "docs", "gottman-csv-diff.md"), md, "utf8");

  console.log(
    `Paruošta ${fixtures.length} fixture įrašų (kiekvienas klausimynas * versijos * 3 kalbos). Diff failas: docs/gottman-csv-diff.md`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
