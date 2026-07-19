import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Rotas que exigem login no Clerk.
// Tudo o que NÃO está aqui é público — importante para o widget do OBS:
//   /widget/:id, /api/now-playing/:id e GET /api/config/:id ficam abertos.
const isProtected = createRouteMatcher([
  "/", // painel
  "/api/connections(.*)",
  "/api/connection(.*)",
  "/api/metrics(.*)",
  "/api/spotify(.*)", // login + callback do Spotify
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Roda em tudo menos arquivos estáticos e _next
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|gif|png|svg|ico|webp|woff2?|ttf|map)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
