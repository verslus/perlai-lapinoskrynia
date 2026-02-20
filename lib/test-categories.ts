export const TEST_CATEGORIES = ["GOTTMAN", "SCHEMA_THERAPY", "OTHER"] as const;

export type TestCategory = (typeof TEST_CATEGORIES)[number];

export function normalizeCategory(value: string | null | undefined): TestCategory {
  if (!value) return "OTHER";
  const upper = value.trim().toUpperCase();
  if (upper === "GOTTMAN") return "GOTTMAN";
  if (upper === "SCHEMA_THERAPY") return "SCHEMA_THERAPY";
  return "OTHER";
}

export function getCategoryLabel(category: TestCategory): string {
  if (category === "GOTTMAN") return "Gottman";
  if (category === "SCHEMA_THERAPY") return "Schema terapija";
  return "Kita";
}

export function resolveTestCategory(scoringConfig: unknown, slug?: string): TestCategory {
  if (scoringConfig && typeof scoringConfig === "object") {
    const cfg = scoringConfig as { type?: string; category?: string };
    if (typeof cfg.category === "string") {
      return normalizeCategory(cfg.category);
    }

    if (cfg.type === "gottman_generic_v1") return "GOTTMAN";
    if (cfg.type === "ysq_r_v43") return "SCHEMA_THERAPY";
  }

  if (slug?.startsWith("gottman-")) return "GOTTMAN";
  if (slug?.startsWith("ysq-")) return "SCHEMA_THERAPY";
  return "OTHER";
}
