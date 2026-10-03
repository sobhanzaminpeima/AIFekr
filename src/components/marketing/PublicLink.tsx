"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useTranslation } from "@/lib/i18n";
import { localizedPublicPath } from "@/lib/seo/locales";

/** Public links keep a crawlable language URL; account/workspace links stay unchanged. */
export default function PublicLink(props: ComponentProps<typeof Link>) {
  const { lang } = useTranslation();
  const href = typeof props.href === "string" ? localizedPublicPath(props.href, lang) : props.href;
  return <Link {...props} href={href}/>;
}
