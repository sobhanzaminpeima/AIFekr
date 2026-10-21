import { describe, it, expect, vi, afterEach } from "vitest";
import dns from "dns/promises";
import { Agent, fetch } from "undici";
import { isPrivateIp, assertPublicHttpUrl, UnsafeUrlError, safeFetch } from "./safeUrl";

vi.mock("undici", () => ({ Agent: vi.fn(function () { return { close: vi.fn().mockResolvedValue(undefined) }; }), fetch: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "0:0:0:0:0:ffff:a00:1", "::127.0.0.1", "2002:7f00:1::", "2001:db8::1", "198.51.100.10"])(
    "blocks %s", (ip) => expect(isPrivateIp(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111"])(
    "allows public %s", (ip) => expect(isPrivateIp(ip)).toBe(false));
});

describe("safeFetch transport", () => {
  it("pins the validated DNS answer instead of resolving again on connect", async () => {
    const lookup = vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    vi.mocked(fetch).mockResolvedValue(new Response("hello") as never);
    expect(await (await safeFetch("https://example.com")).text()).toBe("hello");
    const options = vi.mocked(Agent).mock.calls.at(-1)![0]!;
    const callback = vi.fn();
    (options.connect as { lookup: (host: string, options: { family: number }, cb: (error: Error | null, address: string, family: number) => void) => void }).lookup("example.com", { family: 4 }, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it("rejects redirects to private networks before another request", async () => {
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1" } }) as never);
    await expect(safeFetch("https://93.184.216.34")).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("strips credentials on cross-origin redirects", async () => {
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://1.1.1.1" } }) as never).mockResolvedValueOnce(new Response("ok") as never);
    await safeFetch("https://93.184.216.34", { headers: { authorization: "private", cookie: "session=private" } });
    const headers = new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers as HeadersInit);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
  });
  it("bounds downloaded body bytes", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("x".repeat(5_000_001)) as never);
    await expect(safeFetch("https://93.184.216.34")).rejects.toThrow("response too large");
  });
});

describe("assertPublicHttpUrl", () => {
  it.each([
    "http://127.0.0.1:3000/api/admin", "http://localhost/", "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/", "file:///etc/passwd", "ftp://example.com/", "http://user:pw@example.com/", "http://db.internal/", "not a url",
  ])("rejects %s", async (u) => {
    await expect(assertPublicHttpUrl(u)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("accepts a public IP literal", async () => {
    await expect(assertPublicHttpUrl("https://93.184.216.34/page")).resolves.toBeInstanceOf(URL);
  });
});
