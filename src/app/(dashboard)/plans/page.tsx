"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DynamicPlans from "@/components/billing/DynamicPlans";

/** `?category=FITNESS` (or another package category) shows only that section's packages, e.g. from a module's activation prompt. */
function Plans() {
  const category = useSearchParams().get("category")?.toUpperCase() || undefined;
  return <DynamicPlans category={category} />;
}

export default function Page() {
  return <main className="fit-page"><Suspense fallback={null}><Plans /></Suspense></main>;
}
