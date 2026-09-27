"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SUPPORTED_LANGS } from "@/lib/i18n";
import AddressBook from "@/components/AddressBook";
import "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Currency = "USD" | "EUR" | "BTC";
export type LanguageCode = "en" | "es" | "fr" | "de" | "zh" | "ar";

interface Settings {
  // Display preferences
  currency: Currency;
  language: LanguageCode;

  // Notification preferences
  notifyDeposits: boolean;
  notifyWithdrawals: boolean;
  notifyVaultEvents: boolean;
  emailNotifications: boolean;
  email: string;
  pushNotifications: boolean; // browser push for harvest events

  // Vault preferences
  slippageTolerance: number;

  // Security
  twoFactorEnabled: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  currency: "USD",
  language: "en",
  notifyDeposits: true,
  notifyWithdrawals: true,
  notifyVaultEvents: false,
  emailNotifications: false,
  email: "",
  pushNotifications: false,
  slippageTolerance: 0.5,
  twoFactorEnabled: false,
};

const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: "USD", label: "US Dollar",  symbol: "$"   },
  { value: "EUR", label: "Euro",       symbol: "€"   },
  { value: "BTC", label: "Bitcoin",    symbol: "₿"   },
];

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0, 3.0];

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = "aura_settings";

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ── Push notification helpers ─────────────────────────────────────────────────

async function requestPushPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function getPushPermissionState(): "granted" | "denied" | "default" | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [pushPermission, setPushPermission] = useState<ReturnType<typeof getPushPermissionState>>("default");

  // Hydrate from localStorage on mount
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setPushPermission(getPushPermissionState());
    // Apply saved language to i18n
    if (loaded.language && i18n.language !== loaded.language) {
      void i18n.changeLanguage(loaded.language);
    }
  }, [i18n]);

  /** Update a single field, persist, and show the saved indicator. */
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      persistSettings(next);
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  /** Handle language change: update i18n + persist. */
  function handleLanguageChange(lang: LanguageCode) {
    void i18n.changeLanguage(lang);
    // Also persist the chosen language in i18n's own localStorage key
    localStorage.setItem("aura_lang", lang);
    update("language", lang);
  }

  /** Handle currency change. */
  function handleCurrencyChange(currency: Currency) {
    update("currency", currency);
  }

  /** Handle push notification toggle. */
  async function handlePushToggle(enabled: boolean) {
    if (enabled) {
      const granted = await requestPushPermission();
      if (!granted) {
        setPushPermission(getPushPermissionState());
        return; // User denied, do not flip the toggle
      }
    }
    setPushPermission(getPushPermissionState());
    update("pushNotifications", enabled);
  }

  /** Reset all settings to defaults. */
  function resetToDefaults() {
    persistSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
    void i18n.changeLanguage(DEFAULT_SETTINGS.language);
    localStorage.setItem("aura_lang", DEFAULT_SETTINGS.language);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
          <button
            onClick={resetToDefaults}
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2"
            aria-label="Reset all settings to defaults"
          >
            {t("settings.reset_defaults")}
          </button>
        </div>

        {/* Saved confirmation */}
        {saved && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400"
          >
            {t("settings.saved")}
          </div>
        )}

        {/* ── Appearance ───────────────────────────────────────────────────── */}
        <section className="mb-8" aria-labelledby="section-appearance">
          <h2 id="section-appearance" className="text-lg font-medium mb-3">
            {t("settings.appearance.title")}
          </h2>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
              {t("settings.appearance.description")}
            </p>
            <ThemeToggle />
          </div>
        </section>

        {/* ── Language ─────────────────────────────────────────────────────── */}
        <section className="mb-8" aria-labelledby="section-language">
          <h2 id="section-language" className="text-lg font-medium mb-3">
            {t("settings.language.title")}
          </h2>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {t("settings.language.description")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SUPPORTED_LANGS.map(({ code, label, flag }) => (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code as LanguageCode)}
                  aria-pressed={settings.language === code}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    settings.language === code
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-indigo-400"
                  }`}
                >
                  <span aria-hidden="true">{flag}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Currency Display ─────────────────────────────────────────────── */}
        <section className="mb-8" aria-labelledby="section-currency">
          <h2 id="section-currency" className="text-lg font-medium mb-3">
            {t("settings.currency.title")}
          </h2>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {t("settings.currency.description")}
            </p>
            <div className="flex flex-wrap gap-2">
              {CURRENCY_OPTIONS.map(({ value, label, symbol }) => (
                <button
                  key={value}
                  onClick={() => handleCurrencyChange(value)}
                  aria-pressed={settings.currency === value}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    settings.currency === value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-indigo-400"
                  }`}
                >
                  <span className="font-mono text-base" aria-hidden="true">{symbol}</span>
                  {value} — {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
              {t("settings.currency.note")}
            </p>
          </div>
        </section>

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <section className="mb-8" aria-labelledby="section-notifications">
          <h2 id="section-notifications" className="text-lg font-medium mb-3">
            {t("settings.notifications.title")}
          </h2>
          <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">

            {/* Standard notification toggles */}
            {(
              [
                ["notifyDeposits",   t("settings.notifications.deposits")],
                ["notifyWithdrawals", t("settings.notifications.withdrawals")],
                ["notifyVaultEvents", t("settings.notifications.vault_events")],
                ["emailNotifications", t("settings.notifications.email")],
              ] as [keyof Settings, string][]
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">{label}</span>
                <input
                  type="checkbox"
                  checked={settings[key] as boolean}
                  onChange={(e) => update(key, e.target.checked as Settings[typeof key])}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            ))}

            {/* Email field (shown when emailNotifications is on) */}
            {settings.emailNotifications && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label htmlFor="settings-email" className="text-xs text-zinc-500 block mb-1">
                  {t("settings.notifications.email_address")}
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder={t("settings.notifications.email_placeholder")}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Browser push notifications for harvest events */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <label className="flex items-start justify-between cursor-pointer gap-3">
                <div>
                  <span className="text-sm font-medium block">
                    {t("settings.notifications.push_title")}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 block">
                    {t("settings.notifications.push_description")}
                  </span>
                  {pushPermission === "denied" && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 mt-1 block">
                      {t("settings.notifications.push_blocked")}
                    </span>
                  )}
                  {pushPermission === "unsupported" && (
                    <span className="text-xs text-zinc-400 mt-1 block">
                      {t("settings.notifications.push_unsupported")}
                    </span>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  disabled={pushPermission === "denied" || pushPermission === "unsupported"}
                  onChange={(e) => void handlePushToggle(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                />
              </label>
            </div>
          </div>
        </section>

        {/* ── Wallet ───────────────────────────────────────────────────────── */}
        <section className="mb-8" aria-labelledby="section-wallet">
          <h2 id="section-wallet" className="text-lg font-medium mb-3">
            {t("settings.wallet.title")}
          </h2>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">{t("settings.wallet.no_wallet")}</p>
            <button className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              {t("settings.wallet.connect")}
            </button>
          </div>
        </section>

        {/* ── Slippage ─────────────────────────────────────────────────────── */}
        <section className="mb-8" aria-labelledby="section-slippage">
          <h2 id="section-slippage" className="text-lg font-medium mb-3">
            {t("settings.slippage.title")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {SLIPPAGE_OPTIONS.map((val) => (
              <button
                key={val}
                onClick={() => update("slippageTolerance", val)}
                aria-pressed={settings.slippageTolerance === val}
                className={`w-full rounded-lg px-4 py-2 text-sm font-medium border transition-colors sm:w-auto ${
                  settings.slippageTolerance === val
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-indigo-400"
                }`}
              >
                {val}%
              </button>
            ))}
          </div>
          {settings.slippageTolerance >= 3 && (
            <p className="mt-2 text-xs text-amber-600" role="alert">
              {t("settings.slippage.high_warning")}
            </p>
          )}
        </section>

        {/* ── Security ─────────────────────────────────────────────────────── */}
        <section className="mb-8" aria-labelledby="section-security">
          <h2 id="section-security" className="text-lg font-medium mb-3">
            {t("settings.security.title")}
          </h2>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium">{t("settings.security.two_factor")}</span>
                <p className="text-xs text-zinc-500 mt-0.5">{t("settings.security.two_factor_desc")}</p>
              </div>
              <input
                type="checkbox"
                checked={settings.twoFactorEnabled}
                onChange={(e) => update("twoFactorEnabled", e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        </section>

        {/* ── Danger Zone ──────────────────────────────────────────────────── */}
        <section aria-labelledby="section-danger">
          <h2 id="section-danger" className="text-lg font-medium mb-3 text-red-600">
            {t("settings.danger.title")}
        {/* Address Book — Issue #258 */}
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">Address Book</h2>
              Save and label frequently used Stellar addresses for quick access during withdrawals.
            <AddressBook />
        {/* Danger Zone */}
        <section>
          <h2 className="text-lg font-medium mb-3 text-red-600">{t("settings.danger.title")}</h2>
          <div className="rounded-xl border border-red-200 dark:border-red-900/30 p-4 bg-red-50 dark:bg-red-950/20">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
              {t("settings.danger.description")}
            </p>
            <button
              onClick={() => setShowDeactivate(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              {t("settings.danger.deactivate")}
            </button>
            {showDeactivate && (
              <div className="mt-3 p-3 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-zinc-900">
                <p className="text-sm text-red-600 font-medium mb-2">
                  {t("settings.danger.confirm_message")}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeactivate(false)}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {t("settings.danger.cancel")}
                  </button>
                  <button className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">
                    {t("settings.danger.confirm")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
