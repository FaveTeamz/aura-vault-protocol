import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import FAQPage from "@/components/FAQPage";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faq" });
  return {
    title: `${t("heading")} — Aura Vault Protocol`,
    description: t("subheading"),
  };
}

export default function FAQ() {
  return <FAQPage />;
}
