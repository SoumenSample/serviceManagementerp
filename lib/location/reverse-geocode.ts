// Centralized reverse-geocode helper — provider-agnostic, server-only
// Uses OpenStreetMap Nominatim by default (no API key). If REVERSE_GEOCODING_API_KEY is set, can be extended to Google/Mapbox.

export type ReverseGeocodeResult = {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
};

function buildAddressFromNominatim(data: Record<string, unknown>): ReverseGeocodeResult {
  const address = (data as { display_name?: string })?.display_name;
  const addr = (data as { address?: Record<string, string> })?.address || {};
  return {
    address: address || undefined,
    city: addr.city || addr.town || addr.village || addr.hamlet || undefined,
    state: addr.state || undefined,
    country: addr.country || undefined,
    postalCode: addr.postcode || undefined,
  };
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const providers: (() => Promise<ReverseGeocodeResult | null>)[] = [
    // Primary: OSM Nominatim
    async () => {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "ESPSoln-AMC/1.0 (contact: admin@espsoln.local)", Accept: "application/json", "Accept-Language": "en" },
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const data = (await res.json()) as Record<string, unknown>;
        const r = buildAddressFromNominatim(data);
        return r.address ? r : null;
      } catch { clearTimeout(timeout); return null; }
    },
    // Fallback 1: BigDataCloud (no key, free)
    async () => {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const d = (await res.json()) as Record<string, string>;
        const parts = [d.locality, d.city, d.principalSubdivision, d.countryName].filter(Boolean);
        if (!parts.length) return null;
        return { address: parts.join(", "), city: d.city || d.locality, state: d.principalSubdivision, country: d.countryName, postalCode: d.postcode };
      } catch { clearTimeout(timeout); return null; }
    },
  ];

  for (const fn of providers) {
    const r = await fn();
    if (r?.address) return r;
  }
  return null;
}
