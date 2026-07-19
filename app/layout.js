import "./globals.css";

export const metadata = {
  title: "Now Playing · Spotify Widget",
  description: "Widget 'Now Playing' do Spotify para OBS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body>{children}</body>
    </html>
  );
}
