import { IntlMessageFormat } from "intl-messageformat";
import type { AppLocale } from "./config";
import { messages, type Messages } from "./messages";

function lookup(tree: Messages, key: string): string | undefined {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}

export function hasMessage(locale: AppLocale, key: string): boolean {
  return lookup(messages[locale], key) !== undefined;
}

/**
 * Server-side translation (emails, notifications, documents). UI code uses next-intl instead.
 * Missing keys throw: a silent fallback would ship untranslated text.
 */
export function translate(locale: AppLocale, key: string, values?: Record<string, string | number>): string {
  const source = lookup(messages[locale], key);
  if (source === undefined) throw new Error(`missing message ${locale}:${key}`);
  return String(new IntlMessageFormat(source, locale).format(values));
}
