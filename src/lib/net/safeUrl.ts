import dns from "dns/promises";
import net from "net";
import { Agent, fetch as pinnedFetch } from "undici";

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
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
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
    // URL canonicalization expands compressed/mapped forms consistently,
    // including ::ffff:127.0.0.1 -> ::ffff:7f00:1.
    const v = new URL(`http://[${ip}]/`).hostname.slice(1, -1).toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    const hexMapped = v.match(/^::ffff:([a-f0-9]+):([a-f0-9]+)$/);
    if (hexMapped) {
      const n = (parseInt(hexMapped[1], 16) * 65536 + parseInt(hexMapped[2], 16)) >>> 0;
      return isPrivateIp([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
    }
    // Only global unicast 2000::/3; reject compatible/translated/transition
    // addresses that can tunnel to otherwise blocked IPv4 destinations.
    return !/^[23]/.test(v) || v.startsWith("2001:db8:") || v.startsWith("2002:") || v.startsWith("2001:0:") || v.startsWith("2001::");
  }
  return true; // not an IP at all: refuse rather than guess
}

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp"];

async function resolvePublicTarget(raw: string): Promise<{ url: URL; addresses: { address: string; family: number }[] }> {
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
    return { url: u, addresses: [{ address: host, family: net.isIP(host) }] };
  }
  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError("host could not be resolved");
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new UnsafeUrlError("address not allowed");
  return { url: u, addresses: addrs };
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  return (await resolvePublicTarget(raw)).url;
}

/** Validates once per hop and pins that exact answer into the connection.
 * The deadline includes DNS, headers and body; decompressed bytes are bounded. */
export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 4): Promise<Response> {
  let url = raw;
  const deadline = AbortSignal.timeout(20_000);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const { url: checked, addresses } = await Promise.race([
      resolvePublicTarget(url),
      new Promise<never>((_, reject) => {
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    ]);
    const agent = new Agent({ connect: { lookup: (_host, options, callback) => {
      const family = typeof options === "object" ? options.family : 0;
      const candidates = addresses.filter(a => !family || a.family === family);
      const chosen = candidates[0];
      if (!chosen) { callback(new Error("No validated address for address family"), "", 0); return; }
      // Node/Undici may request all addresses for automatic family selection.
      if (typeof options === "object" && "all" in options && options.all) {
        (callback as unknown as (err: null, values: typeof candidates) => void)(null, candidates);
      } else callback(null, chosen.address, chosen.family);
    } } });
    try {
    const res = await pinnedFetch(checked, { ...init, signal, redirect: "manual", dispatcher: agent } as Parameters<typeof pinnedFetch>[1]);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, checked);
      // Never carry credentials (e.g. a WordPress app password) to a different origin.
      if (next.origin !== checked.origin && init.headers) {
        const h = new Headers(init.headers);
        h.delete("authorization");
        h.delete("cookie");
        h.delete("proxy-authorization");
        init = { ...init, headers: h };
      }
      await res.body?.cancel();
      url = next.toString();
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader) {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > 5_000_000) { await reader.cancel(); throw new UnsafeUrlError("response too large"); }
        chunks.push(next.value);
      }
    }
    const result = new Response([204, 205, 304].includes(res.status) || init.method === "HEAD" ? null : Buffer.concat(chunks), { status: res.status, statusText: res.statusText, headers: Array.from(res.headers.entries()) });
    Object.defineProperty(result, "url", { value: res.url });
    return result;
    } finally { await agent.close(); }
  }
  throw new UnsafeUrlError("too many redirects");
}
