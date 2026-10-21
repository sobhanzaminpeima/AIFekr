/**
 * Feature switches for the SEO area.
 *
 * GSC_ENABLED: the Google Search Console integration (connection card, real
 * ranking data, weekly rank snapshots). Switched OFF for now because the Google
 * OAuth app cannot be published yet, so no customer could complete the connection.
 * Everything is kept in place -- flip this to true (and set NEXT_PUBLIC_GSC_ENABLED
 * for the browser bundle) once the app is published and the API is enabled.
 */
export const GSC_ENABLED = process.env.NEXT_PUBLIC_GSC_ENABLED === "true";
