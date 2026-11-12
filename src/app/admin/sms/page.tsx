export const dynamic = "force-dynamic";

/**
 * The SMS admin page lives in the new design (/admin/sms is in the v2 admin list),
 * which the proxy serves to signed-in admins. This classic page exists so the
 * admin layout's sign-in check runs here too: a signed-out visitor is sent to
 * login, as on every other admin page, instead of getting a 404.
 */
export default function Page() {
  return (
    <div className="p-6 text-sm" style={{ color: "var(--text-secondary)" }}>
      مدیریت پیامک در طرح جدید پنل است. برای دیدن آن، طرح جدید را از تنظیمات ظاهر روشن کنید.
      <br />
      SMS management is part of the new design. Switch to the new design to open it.
    </div>
  );
}
