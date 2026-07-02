import BusinessGate from "@/components/business/BusinessGate";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <BusinessGate>{children}</BusinessGate>;
}