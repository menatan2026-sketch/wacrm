"use server";
import { cookies } from "next/headers";
import { schema, eq } from "@mfg/db";
import { isLocale } from "@mfg/i18n";
import { deps } from "@/lib/platform";
import { getActor } from "@/lib/session";

const YEAR = 365 * 24 * 3600;

/** Persist an explicit language choice (cookie for everyone, account preference when signed in). */
export async function setLocaleAction(locale: string, surface: "customer" | "supplier" | "admin") {
  if (!isLocale(locale)) return;
  (await cookies()).set("NEXT_LOCALE", locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const actor = await getActor(surface);
  if (actor)
    await deps()
      .db.update(schema.users)
      .set({ preferredLocale: locale })
      .where(eq(schema.users.id, actor.userId));
}

export async function setMotionAction(preference: "system" | "reduced" | "full") {
  const jar = await cookies();
  if (preference === "system") jar.delete("mfg_motion");
  else jar.set("mfg_motion", preference, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const actor = await getActor("customer");
  if (actor)
    await deps()
      .db.update(schema.users)
      .set({ reducedMotion: preference })
      .where(eq(schema.users.id, actor.userId));
}
