const TRACKING_PARAMETER_NAMES = new Set([
  "gclid",
  "fbclid",
  "msclkid",
]);

function isTrackingParameter(name: string): boolean {
  return name.toLowerCase().startsWith("utm_") ||
    TRACKING_PARAMETER_NAMES.has(name.toLowerCase());
}

function removeTrackingParameters(url: URL): void {
  const search = url.search;

  if (search === "") {
    return;
  }

  const query = search.slice(1);

  const retainedParts = query
    .split("&")
    .filter((part) => {
      const separatorIndex = part.indexOf("=");

      const rawName =
        separatorIndex === -1
          ? part
          : part.slice(0, separatorIndex);

      let decodedName: string;

      try {
        decodedName = decodeURIComponent(
          rawName.replace(/\+/g, " "),
        );
      } catch {
        decodedName = rawName;
      }

      return !isTrackingParameter(decodedName);
    });

  if (retainedParts.length === 0) {
    url.search = "";
    return;
  }

  url.search = `?${retainedParts.join("&")}`;
}

export function normalizeDiscoveryUrl(
  input: string,
): string | null {
  const value = input.trim();

  if (value === "") {
    return null;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  url.hostname = url.hostname.toLowerCase();

  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  url.hash = "";

  removeTrackingParameters(url);

  if (
    url.pathname.length > 1 &&
    url.pathname.endsWith("/")
  ) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}