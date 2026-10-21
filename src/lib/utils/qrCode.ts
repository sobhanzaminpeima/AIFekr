import QRCode from "qrcode";

/** Renders a QR code as a PNG data URL — used for the invite card's referral-link QR. */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 240,
    color: { dark: "#0B0B0C", light: "#FFFFFF" },
  });
}
