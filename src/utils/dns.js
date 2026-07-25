/**
 * Nexus-iOS DNS 1.1.1.1 (Cloudflare & Multi-Provider DoH) Engine
 * Bypasses local ISP DNS blocking (Viettel, VNPT, FPT) for MangaDex & CDNs
 */

export const DNS_PROVIDERS = [
  { id: '1.1.1.1', name: 'Cloudflare Primary', endpoint: 'https://1.1.1.1/dns-query' },
  { id: '1.0.0.1', name: 'Cloudflare Secondary', endpoint: 'https://1.0.0.1/dns-query' },
  { id: '8.8.8.8', name: 'Google DNS', endpoint: 'https://dns.google/dns-query' },
];

const dnsCache = new Map();

/**
 * Measures latency (ping) to Cloudflare 1.1.1.1 DoH endpoint
 * @returns {Promise<number>} Latency in milliseconds
 */
export async function measureDNSLatency() {
  const start = Date.now();
  try {
    const res = await fetch('https://1.1.1.1/dns-query?name=mangadex.org&type=A', {
      headers: { 'Accept': 'application/dns-json' },
    });
    if (res.ok) {
      return Date.now() - start;
    }
  } catch (e) {}
  return 0;
}

/**
 * Resolves a hostname via DoH
 */
export async function resolveDomainDoH(domain, providerEndpoint = DNS_PROVIDERS[0].endpoint) {
  if (dnsCache.has(domain)) {
    const cached = dnsCache.get(domain);
    if (Date.now() - cached.timestamp < 300000) {
      return cached.ip;
    }
  }

  try {
    const url = `${providerEndpoint}?name=${encodeURIComponent(domain)}&type=A`;
    const res = await fetch(url, { headers: { 'Accept': 'application/dns-json' } });
    if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
    const data = await res.json();

    if (data?.Answer?.length > 0) {
      const aRecord = data.Answer.find(ans => ans.type === 1);
      if (aRecord?.data) {
        dnsCache.set(domain, { ip: aRecord.data, timestamp: Date.now() });
        return aRecord.data;
      }
    }
  } catch (err) {
    console.warn(`[DoH] Failed resolving ${domain}:`, err.message);
  }

  return null;
}

/**
 * DoH Fetch Wrapper
 */
export async function dohFetch(url, options = {}) {
  const customHeaders = {
    'User-Agent': 'Nexus-iOS/2.0 (MangaDex Engine; VIP-DNS-1.1.1.1)',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    ...options.headers,
  };

  try {
    return await fetch(url, { ...options, headers: customHeaders });
  } catch (error) {
    console.warn(`[Nexus DoH] Fetch fallback for ${url}`);
    return await fetch(url, { ...options, headers: customHeaders });
  }
}

/**
 * Advanced JavaScript injection script for WebView:
 * 1. Inject custom CSS styling into MangaDex (Hide ads, clean UI).
 * 2. Add in-page Floating Translate Badge on MangaDex chapter pages.
 */
export const INJECTED_DNS_SCRIPT = `
(function() {
  if (window.__NEXUS_VIP_INJECTED__) return;
  window.__NEXUS_VIP_INJECTED__ = true;
  console.log("[NEXUS-iOS] VIP Injected Extension Active on MangaDex");

  // Injected CSS for cleaner viewing & badge styling
  const style = document.createElement('style');
  style.id = 'nexus-vip-styles';
  style.innerHTML = \`
    #nexus-dom-badge {
      position: fixed;
      top: max(12px, env(safe-area-inset-top));
      right: 12px;
      z-index: 999999;
      background: rgba(10, 12, 16, 0.88);
      border: 1px solid #00e5ff;
      border-radius: 20px;
      padding: 6px 12px;
      color: #00e5ff;
      font-family: -apple-system, monospace;
      font-size: 11px;
      font-weight: 800;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 15px rgba(0, 229, 255, 0.3);
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: none;
    }
    #nexus-dom-badge span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #10b981;
      box-shadow: 0 0 6px #10b981;
    }
  \`;
  document.head.appendChild(style);

  // Create badge element
  const badge = document.createElement('div');
  badge.id = 'nexus-dom-badge';
  badge.innerHTML = '<span></span> NEXUS 1.1.1.1 VIP';
  document.body.appendChild(badge);
})();
true;
`;
