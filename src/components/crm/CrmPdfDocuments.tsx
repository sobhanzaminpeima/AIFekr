import { Document, Page, Text, View, Image, StyleSheet, Font, pdf } from "@react-pdf/renderer";

/**
 * Real PDF export for CRM invoices/contracts, replacing the browser's
 * print-to-PDF dialog (still used as a secondary "چاپ" option). Vazirmatn
 * is registered from a CDN because the app doesn't ship a local font file
 * for react-pdf to read from disk -- @react-pdf/renderer's font engine
 * (fontkit) does its own Arabic/Persian glyph shaping, so Persian text
 * renders correctly joined without any extra reshaping library (verified
 * empirically before building this, not assumed).
 */
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "Vazirmatn",
    fonts: [
      { src: "https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/ttf/Vazirmatn-Regular.ttf", fontWeight: "normal" },
      { src: "https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/ttf/Vazirmatn-Bold.ttf", fontWeight: "bold" },
    ],
  });
  fontsRegistered = true;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

const styles = StyleSheet.create({
  page: { fontFamily: "Vazirmatn", fontSize: 11, padding: 36, color: "#111", direction: "rtl" },
  pageLtr: { fontFamily: "Helvetica", fontSize: 11, padding: 36, color: "#111" },
  logo: { height: 32, objectFit: "contain", marginBottom: 12, alignSelf: "flex-end" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "bold" },
  muted: { fontSize: 9, color: "#666" },
  billTo: { fontSize: 11, marginBottom: 12 },
  table: { borderTopWidth: 1, borderColor: "#ddd" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#eee", paddingVertical: 4 },
  trHead: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#ddd", paddingVertical: 4, fontWeight: "bold" },
  cellDesc: { flex: 3 },
  cellNum: { flex: 1, textAlign: "right" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", gap: 8, marginBottom: 2 },
  grandTotal: { fontSize: 13, fontWeight: "bold", marginTop: 4 },
  contractBody: { fontSize: 11, lineHeight: 1.8, marginTop: 12 },
});

interface InvoiceItemRow { description: string; quantity: number; unitPrice: number; }
export interface InvoicePdfData {
  invoiceNumber: string; issueDate: string; contactName: string;
  items: InvoiceItemRow[]; subtotal: number; taxTotal: number; discount: number; total: number; currency: string;
  logoUrl?: string | null;
}

export interface InvoicePdfLabels {
  invoiceTitle: string; billTo: string; description: string; qty: string; unit: string;
  subtotal: string; tax: string; discount: string; grandTotal: string;
}

function InvoicePdfDocument({ data, labels, isRtl, dateStr }: { data: InvoicePdfData; labels: InvoicePdfLabels; isRtl: boolean; dateStr: string }) {
  ensureFonts();
  return (
    <Document>
      <Page size="A4" style={isRtl ? styles.page : styles.pageLtr}>
        {data.logoUrl && <Image src={data.logoUrl} style={styles.logo} />}
        <View style={styles.headerRow}>
          <Text style={styles.title}>{labels.invoiceTitle} {data.invoiceNumber}</Text>
          <Text style={styles.muted}>{dateStr}</Text>
        </View>
        <Text style={styles.billTo}>{labels.billTo} {data.contactName}</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={styles.cellDesc}>{labels.description}</Text>
            <Text style={styles.cellNum}>{labels.qty}</Text>
            <Text style={styles.cellNum}>{labels.unit}</Text>
          </View>
          {data.items.map((it, i) => (
            <View key={i} style={styles.tr}>
              <Text style={styles.cellDesc}>{it.description}</Text>
              <Text style={styles.cellNum}>{it.quantity}</Text>
              <Text style={styles.cellNum}>{fmtMoney(it.unitPrice)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.totals}>
          <View style={styles.totalRow}><Text>{labels.subtotal}</Text><Text>{fmtMoney(data.subtotal)}</Text></View>
          <View style={styles.totalRow}><Text>{labels.tax}</Text><Text>{fmtMoney(data.taxTotal)}</Text></View>
          {data.discount > 0 && <View style={styles.totalRow}><Text>{labels.discount}</Text><Text>-{fmtMoney(data.discount)}</Text></View>}
          <Text style={styles.grandTotal}>{labels.grandTotal} {fmtMoney(data.total)} {data.currency}</Text>
        </View>
      </Page>
    </Document>
  );
}

export interface ContractPdfData {
  title: string; contactName: string; content: string; logoUrl?: string | null;
}
export interface ContractPdfLabels { contact: string }

function ContractPdfDocument({ data, labels, isRtl }: { data: ContractPdfData; labels: ContractPdfLabels; isRtl: boolean }) {
  ensureFonts();
  return (
    <Document>
      <Page size="A4" style={isRtl ? styles.page : styles.pageLtr}>
        {data.logoUrl && <Image src={data.logoUrl} style={styles.logo} />}
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.muted}>{labels.contact} {data.contactName}</Text>
        <Text style={styles.contractBody}>{data.content}</Text>
      </Page>
    </Document>
  );
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadInvoicePdf(data: InvoicePdfData, labels: InvoicePdfLabels, isRtl: boolean, dateStr: string) {
  const blob = await pdf(<InvoicePdfDocument data={data} labels={labels} isRtl={isRtl} dateStr={dateStr} />).toBlob();
  await downloadBlob(blob, `invoice-${data.invoiceNumber}.pdf`);
}

export async function downloadContractPdf(data: ContractPdfData, labels: ContractPdfLabels, isRtl: boolean) {
  const blob = await pdf(<ContractPdfDocument data={data} labels={labels} isRtl={isRtl} />).toBlob();
  await downloadBlob(blob, `contract-${data.title.replace(/[^\w-]+/g, "_")}.pdf`);
}
