import dns from "dns/promises";
import net from "net";

/**
 * SSRF guard for every server-side fetch of a URL a user typed (SEO crawlers,
 * audits). Without it, "analyze this URL" could be pointed at
 * http://127.0.0.1:3000/api/..., the cloud metadata service or any other
 * private address, and the response would be reflected back as an "audit".
 *
 * Checks the scheme, the hostname, EVERY address the name resolves to (so a
 * public-looking name that resolves to 10.x is caught), and re-checks each
 * redirect hop, since a public page can 302 to an internal address.
 */
export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKS.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
  }
  return true; // not an IP at all: refuse rather than guess
}

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp"];

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnsafeUrlError("invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new UnsafeUrlError("only http(s) URLs are allowed");
  if (u.username || u.password) throw new UnsafeUrlError("credentials in URL are not allowed");

  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) throw new UnsafeUrlError("host not allowed");

  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError("address not allowed");
    return u;
  }
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError("host could not be resolved");
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new UnsafeUrlError("address not allowed");
  return u;
}

/** fetch() that validates the target and every redirect hop. */
export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 4): Promise<Response> {
  let url = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const checked = await assertPublicHttpUrl(url);
    const res = await fetch(checked, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, checked);
      // Never carry credentials (e.g. a WordPress app password) to a different origin.
      if (next.origin !== checked.origin && init.headers) {
        const h = new Headers(init.headers);
        h.delete("authorization");
        init = { ...init, headers: h };
      }
      url = next.toString();
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError("too many redirects");
}
