import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Supported locales
  locales: ["en", "es"],
  // Default locale used when no locale prefix matches
  defaultLocale: "en",
  // Detect the locale from the Accept-Language header and redirect automatically
  localeDetection: true,
});
