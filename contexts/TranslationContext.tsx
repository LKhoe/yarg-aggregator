"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

const translations = {
  en: () => import("../messages/en.json").then((m) => m.default),
  es: () => import("../messages/es.json").then((m) => m.default),
  fr: () => import("../messages/fr.json").then((m) => m.default),
  de: () => import("../messages/de.json").then((m) => m.default),
  ja: () => import("../messages/ja.json").then((m) => m.default),
  zh: () => import("../messages/zh.json").then((m) => m.default),
  "pt-BR": () => import("../messages/pt-BR.json").then((m) => m.default),
};

type TranslationValues = Record<string, string | number>;

interface TranslationContextType {
  t: (key: string, values?: TranslationValues) => string;
  locale: string;
  changeLanguage: (locale: string) => void;
  loading: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(
  undefined,
);

interface TranslationProviderProps {
  children: ReactNode;
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  const [locale, setLocale] = useState("en");
  const [messages, setMessages] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const loadTranslations = useCallback(async (targetLocale: string) => {
    setLoading(true);
    try {
      if (targetLocale in translations) {
        const translationsData =
          await translations[targetLocale as keyof typeof translations]();
        setMessages(translationsData);
        setLocale(targetLocale);
        // Only set localStorage on client side
        if (typeof window !== "undefined") {
          localStorage.setItem("preferred-locale", targetLocale);
        }
      } else {
        // Fallback to English if locale not found
        const fallbackTranslations = await translations.en();
        setMessages(fallbackTranslations);
        setLocale("en");
      }
    } catch (error) {
      console.error("Failed to load translations:", error);
      // Fallback to English
      const fallbackTranslations = await translations.en();
      setMessages(fallbackTranslations);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Start loading immediately, but don't await
    const savedLocale =
      typeof window !== "undefined"
        ? localStorage.getItem("preferred-locale")
        : null;
    const browserLocale =
      typeof window !== "undefined" ? navigator.language.split("-")[0] : "en";
    const finalLocale =
      savedLocale || (browserLocale in translations ? browserLocale : "en");

    // Don't block on translation loading
    loadTranslations(finalLocale);
  }, [loadTranslations]);

  const t = (key: string, values?: TranslationValues): string => {
    const keys = key.split(".");
    let value: unknown = messages;

    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
    }

    if (typeof value !== "string") {
      return key;
    }

    // Handle ICU message format placeholders like {count}, {name}, etc.
    if (values) {
      return value.replace(/\{(\w+)\}/g, (_, placeholder: string) => {
        return placeholder in values
          ? String(values[placeholder])
          : `{${placeholder}}`;
      });
    }

    return value;
  };

  const changeLanguage = (newLocale: string) => {
    loadTranslations(newLocale);
  };

  const value = { t, locale, changeLanguage, loading };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslations() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error(
      "useTranslations must be used within a TranslationProvider",
    );
  }
  return context;
}
