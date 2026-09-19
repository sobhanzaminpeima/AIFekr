import { describe, it, expect } from "vitest";
import { isPrivateIp, assertPublicHttpUrl, UnsafeUrlError } from "./safeUrl";

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s", (ip) => expect(isPrivateIp(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111"])(
    "allows public %s", (ip) => expect(isPrivateIp(ip)).toBe(false));
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
