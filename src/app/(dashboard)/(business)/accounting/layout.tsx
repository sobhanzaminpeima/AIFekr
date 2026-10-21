import AccountingNav from "@/components/accounting/AccountingNav";

/**
 * Shared shell for every /accounting/* page. AccountingNav used to be
 * rendered individually at the top of each of the nine pages, stacked
 * above their own content -- fine for the horizontal mobile pill row, but
 * it meant the nav couldn't become a real sidebar (a sidebar sits BESIDE
 * content, not above it, which needs a shared flex-row ancestor). Moving
 * it here to one layout does that, and each page keeps its own inner
 * max-width/spacing wrapper unchanged -- only the outer padding moved here
 * so it isn't doubled.
 */
export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 p-4 md:p-6">
      <AccountingNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
