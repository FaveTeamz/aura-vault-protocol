"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";
import zh from "@/locales/zh.json";
import ar from "@/locales/ar.json";

export const RTL_LANGS = new Set(["ar"]);

export const SUPPORTED_LANGS = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
] as const;

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        es: { translation: es },
        fr: { translation: fr },
        de: { translation: de },
        zh: { translation: zh },
        ar: { translation: ar },
      },
      fallbackLng: "en",
      supportedLngs: ["en", "es", "fr", "de", "zh", "ar"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "aura_lang",
      },
    });
}

export default i18n;
