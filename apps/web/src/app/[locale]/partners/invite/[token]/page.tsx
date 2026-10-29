import { getTranslations } from "next-intl/server";
import { auth } from "@mfg/core";
import { Banner, Card } from "@mfg/ui";
import { SignInForm } from "@/components/SignInForm";
import { resolveLocale } from "@/lib/i18n";
import { deps } from "@/lib/platform";

/** Invitation landing: sign in with the invited email; verification attaches the supplier role. */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const locale = await resolveLocale(params);
  const { token } = await params;
  const t = await getTranslations("auth.invite");
  const e = await getTranslations("errors");
  const invitation = /^[A-Za-z0-9_-]{16,128}$/.test(token)
    ? await auth.findInvitation(deps(), token)
    : null;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-14">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      {invitation ? (
        <>
          <p className="text-text-secondary">
            {t("body", { email: invitation.invitation.email, supplier: invitation.supplierName })}
          </p>
          <Card>
            <SignInForm
              surface="supplier"
              locale={locale}
              inviteToken={token}
              defaultEmail={invitation.invitation.email}
              next={`/${locale}/partners/profile`}
            />
          </Card>
        </>
      ) : (
        <Banner tone="danger">{e("auth.invitation_invalid")}</Banner>
      )}
    </div>
  );
}
