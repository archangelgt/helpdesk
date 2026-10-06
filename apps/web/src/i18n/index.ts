import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./locales/es.json";
import en from "./locales/en.json";
import pt from "./locales/pt.json";

export const LANGUAGES = ["es", "en", "pt"] as const;
export type Language = (typeof LANGUAGES)[number];

const stored = localStorage.getItem("hd2-lang");
const initial: Language = (LANGUAGES as readonly string[]).includes(stored ?? "") ? (stored as Language) : "es";

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en }, pt: { translation: pt } },
  lng: initial,
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("hd2-lang", lng);
  document.documentElement.lang = lng;
});
document.documentElement.lang = initial;

export default i18n;
