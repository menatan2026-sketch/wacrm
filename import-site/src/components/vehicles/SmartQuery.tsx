"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import type { SearchCriteria } from "@/domain/types";
import { criteriaToParams } from "@/lib/search/filter";
import { parseQuery } from "@/lib/search/parse-query";
import { ArrowRight, Sparkle } from "@/components/ui/icons";
import s from "./SmartQuery.module.css";

const EXAMPLE = "2025 Mercedes-AMG G63\nblack\nunder 1.2M NIS\nlow mileage\nfull specification";

/**
 * "I know what I want." Free text in, structured criteria out — every
 * recognised phrase is echoed back as a chip, so the visitor can see
 * exactly how we read the request before searching.
 */
export function SmartQuery({
  initial = "",
  onSearch,
  compact = false,
}: {
  initial?: string;
  onSearch?: (criteria: Partial<SearchCriteria>, text: string) => void;
  compact?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const router = useRouter();
  const inputId = useId();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 180);
    return () => clearTimeout(t);
  }, [text]);

  const parsed = useMemo(() => parseQuery(debounced), [debounced]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const { criteria, remainder } = parseQuery(text);
    const full = { ...criteria, ...(remainder ? { text: remainder } : {}) };
    if (onSearch) onSearch(full, text);
    else router.push(`/vehicles?${criteriaToParams(full).toString()}&q=${encodeURIComponent(text)}`);
  };

  return (
    <form className={s.root} data-compact={compact} onSubmit={submit}>
      <div className={s.head}>
        <label htmlFor={inputId} className={s.kicker}>
          <Sparkle width={16} height={16} /> I know what I want
        </label>
        {!text && (
          <button type="button" className={s.example} onClick={() => setText(EXAMPLE.replace(/\n/g, ", "))}>
            Try an example
          </button>
        )}
      </div>

      <div className={s.field}>
        <textarea
          id={inputId}
          className={s.input}
          value={text}
          rows={compact ? 2 : 3}
          placeholder={"2025 Mercedes-AMG G63, black, under 1.2M NIS, low mileage, full specification"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          spellCheck={false}
        />
        <button type="submit" className={`btn btn-primary ${s.go}`} disabled={!text.trim()} data-cursor="open">
          Search <ArrowRight className="btn-arrow" />
        </button>
      </div>

      <div className={s.chips} aria-live="polite">
        {parsed.tokens.length === 0 ? (
          <p className="label">Make, model, year, colour, budget, mileage, spec — in your own words.</p>
        ) : (
          <>
            <p className="label">We read</p>
            <ul>
              {parsed.tokens.map((t, i) => (
                <li key={`${t.field}-${t.value}`} style={{ "--i": i } as React.CSSProperties}>
                  <span className={s.chipKey}>{t.label}</span>
                  <span className={s.chipVal}>{t.value}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </form>
  );
}
