import { getServerLang } from "@/lib/i18n/server";
import { prisma } from "@/lib/db/prisma";
import { parseFields } from "@/lib/leadgen/fields";
import { notFound } from "next/navigation";
import LeadFormClient from "./LeadFormClient";

export const dynamic = "force-dynamic";

/**
 * Public, no-login lead-capture page for a tenant's LeadForm. Shared as a
 * link or loaded inside the embed iframe. Trilingual (fa/en/de) via the
 * visitor's own language cookie, falling back to the form's Persian copy.
 */
export default async function PublicLeadFormPage({ params }: { params: { slug: string } }) {
  const lang = await getServerLang();
  const form = await prisma.leadForm.findUnique({ where: { slug: params.slug } });
  if (!form || !form.isActive) notFound();

  return (
    <LeadFormClient
      lang={lang}
      slug={form.slug}
      title={form.title}
      titleEn={form.titleEn}
      titleDe={form.titleDe}
      description={form.description}
      descriptionEn={form.descriptionEn}
      descriptionDe={form.descriptionDe}
      fields={parseFields(form.fields)}
      accentColor={form.accentColor}
      logoUrl={form.logoUrl}
      submitLabel={form.submitLabel}
      successMessage={form.successMessage}
    />
  );
}
