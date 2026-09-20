/**
 * Renders schema.org structured data. `<` is escaped so a value containing
 * "</script>" cannot break out of the tag (the data is ours, but this keeps the
 * component safe to reuse with database content).
 */
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
