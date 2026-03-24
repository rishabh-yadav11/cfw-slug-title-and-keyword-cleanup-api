import { describe, expect, it } from "vitest";
import { checkSSRF } from "../src/utils/ssrf";

describe("SSRF Protection", () => {
  it("allows safe public domains", async () => {
    expect(await checkSSRF("https://example.com")).toBe(true);
    expect(await checkSSRF("http://google.com/path")).toBe(true);
  });

  it("blocks localhost and private IPs", async () => {
    expect(await checkSSRF("http://localhost:8080")).toBe(false);
    expect(await checkSSRF("http://127.0.0.1")).toBe(false);
    expect(await checkSSRF("http://192.168.1.100")).toBe(false);
    expect(await checkSSRF("http://10.0.0.5")).toBe(false);
    expect(await checkSSRF("http://172.16.0.1")).toBe(false);
    expect(await checkSSRF("http://[::1]")).toBe(false);
    expect(await checkSSRF("http://[fe80::1]")).toBe(false);
  });

  it("blocks non-http schemes", async () => {
    expect(await checkSSRF("ftp://server.com")).toBe(false);
    expect(await checkSSRF("file:///etc/passwd")).toBe(false);
    expect(await checkSSRF("gopher://test.com")).toBe(false);
  });
});
