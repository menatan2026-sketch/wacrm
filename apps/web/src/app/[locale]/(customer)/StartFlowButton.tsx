"use client";
import { useTransition } from "react";
import { Button } from "@mfg/ui";
import { startDraftAction } from "@/app/actions/wizard";

export function StartFlowButton({
  flow,
  locale,
  label,
  primary,
}: {
  flow: "file" | "object" | "idea";
  locale: string;
  label: string;
  primary?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      variant={primary ? "primary" : "secondary"}
      loading={pending}
      onClick={() => start(() => startDraftAction(flow, locale))}
    >
      {label}
    </Button>
  );
}
