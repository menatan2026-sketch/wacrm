/**
 * Catalog CI check (LOCALIZATION_GLOSSARY §1): every key exists in every locale, ICU syntax
 * parses, placeholders match English, and plural messages cover each locale's categories.
 */
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { locales } from "../src/config";
import { messages, type MessageTree } from "../src/messages";

const REQUIRED_PLURALS: Record<string, string[]> = {
  en: ["one", "other"],
  he: ["one", "two", "other"],
  ru: ["one", "few", "many", "other"],
};

function flatten(tree: MessageTree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [ck, cv] of flatten(v, key)) out.set(ck, cv);
  }
  return out;
}

function inspect(ast: MessageFormatElement[], args = new Set<string>(), plurals: string[][] = []) {
  for (const el of ast) {
    if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) {
      args.add(el.value);
    }
    if (el.type === TYPE.plural || el.type === TYPE.select) {
      args.add(el.value);
      if (el.type === TYPE.plural) plurals.push(Object.keys(el.options).filter((o) => !o.startsWith("=")));
      for (const opt of Object.values(el.options)) inspect(opt.value, args, plurals);
    }
    if (el.type === TYPE.tag) {
      args.add(el.value);
      inspect(el.children, args, plurals);
    }
  }
  return { args, plurals };
}

export function checkCatalogs(): string[] {
  const problems: string[] = [];
  const flat = Object.fromEntries(locales.map((l) => [l, flatten(messages[l] as MessageTree)])) as Record<
    string,
    Map<string, string>
  >;
  const reference = flat.en!;
  for (const locale of locales) {
    const current = flat[locale]!;
    for (const key of reference.keys()) if (!current.has(key)) problems.push(`${locale}: missing ${key}`);
    for (const key of current.keys()) if (!reference.has(key)) problems.push(`${locale}: extra key ${key}`);
    for (const [key, text] of current) {
      let info;
      try {
        info = inspect(parse(text));
      } catch (e) {
        problems.push(`${locale}: ${key} has invalid ICU syntax (${(e as Error).message})`);
        continue;
      }
      const refText = reference.get(key);
      if (refText && locale !== "en") {
        const refArgs = inspect(parse(refText)).args;
        const missing = [...refArgs].filter((a) => !info.args.has(a));
        const extra = [...info.args].filter((a) => !refArgs.has(a));
        if (missing.length || extra.length) {
          problems.push(`${locale}: ${key} placeholders differ (missing [${missing}], extra [${extra}])`);
        }
      }
      for (const cats of info.plurals) {
        const lacking = REQUIRED_PLURALS[locale]!.filter((c) => !cats.includes(c));
        if (lacking.length) problems.push(`${locale}: ${key} plural lacks ${lacking.join(",")}`);
      }
    }
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkCatalogs();
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error(`\n${problems.length} catalog problem(s)`);
    process.exit(1);
  }
  console.log("catalogs OK");
}
