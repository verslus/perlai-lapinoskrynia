const dict = {
  lt: {
    appName: "Testų platforma",
    consentTitle: "Sutikimas prieš testą",
    startTest: "Pradėti testą",
    saveNext: "Išsaugoti ir toliau",
    back: "Atgal",
    skip: "Praleisti",
    finish: "Baigti testą",
    feedbackTitle: "Trumpas įvertinimas"
  },
  en: {
    appName: "Assessment platform",
    consentTitle: "Consent before test",
    startTest: "Start test",
    saveNext: "Save and continue",
    back: "Back",
    skip: "Skip",
    finish: "Finish test",
    feedbackTitle: "Quick feedback"
  },
  ua: {
    appName: "Платформа тестів",
    consentTitle: "Згода перед тестом",
    startTest: "Почати тест",
    saveNext: "Зберегти та далі",
    back: "Назад",
    skip: "Пропустити",
    finish: "Завершити тест",
    feedbackTitle: "Короткий відгук"
  }
} as const;

export type Locale = keyof typeof dict;

export function t(locale: string | undefined, key: keyof (typeof dict)["lt"]) {
  const safe = (locale as Locale) || "lt";
  return dict[safe]?.[key] ?? dict.lt[key];
}
