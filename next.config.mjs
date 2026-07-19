/** @type {import('next').NextConfig} */
const nextConfig = {
  // Capas de álbum vêm do CDN do Spotify; usamos <img> normal no widget,
  // então não precisamos configurar next/image aqui.
  reactStrictMode: true,
};

export default nextConfig;
