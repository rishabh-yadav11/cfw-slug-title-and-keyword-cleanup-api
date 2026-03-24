import { Address4, Address6 } from "ip-address";

// Allowed schemes
const ALLOWED_SCHEMES = ["http:", "https:"];

export const checkSSRF = async (urlStr: string): Promise<boolean> => {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return false; // Invalid URL
  }

  if (!ALLOWED_SCHEMES.includes(url.protocol)) {
    return false;
  }

  // Resolve hostname
  // For Cloudflare Workers, we might not easily resolve DNS sync,
  // But we can check if it's an explicit IP in the hostname and block private IPs.
  const hostname = url.hostname.replace(/^\[/, "").replace(/\]$/, ""); // Remove brackets for IPv6

  if (hostname === "localhost") return false;

  // Simple IP check
  const isIpv4 = Address4.isValid(hostname);
  const isIpv6 = Address6.isValid(hostname);

  if (isIpv4) {
    const ip = new Address4(hostname);
    if (isPrivateIPv4(ip)) return false;
  }

  if (isIpv6) {
    const ip = new Address6(hostname);
    if (isPrivateIPv6(ip)) return false;
  }

  return true;
};

function isPrivateIPv4(ip: Address4): boolean {
  // 10.0.0.0/8
  // 172.16.0.0/12
  // 192.168.0.0/16
  // 127.0.0.0/8
  // 169.254.0.0/16 (Link-local)
  const addr = ip.address;
  if (addr.startsWith("10.")) return true;
  if (addr.startsWith("127.")) return true;
  if (addr.startsWith("169.254.")) return true;
  if (addr.startsWith("192.168.")) return true;

  const parts = addr.split(".");
  if (parts[0] === "172") {
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}

function isPrivateIPv6(ip: Address6): boolean {
  // Try to normalize first
  const addr = ip.correctForm().toLowerCase();

  // Loopback
  if (addr === "::1" || addr === "0:0:0:0:0:0:0:1") return true;
  // Unspecified
  if (addr === "::" || addr === "0:0:0:0:0:0:0:0") return true;

  // Link-local (fe80::/10)
  if (
    addr.startsWith("fe8") ||
    addr.startsWith("fe9") ||
    addr.startsWith("fea") ||
    addr.startsWith("feb")
  )
    return true;
  // Unique local (fc00::/7)
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true;

  return false;
}
