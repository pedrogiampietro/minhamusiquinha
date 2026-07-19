export function getBaseUrl(req) {
  if (req?.url) {
    try {
      return new URL(req.url).origin;
    } catch {}
  }

  return process.env.BASE_URL || "http://127.0.0.1:8888";
}