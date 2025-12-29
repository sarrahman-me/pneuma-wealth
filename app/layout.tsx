import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "PNEUMA",
  description: "Pelacak keuangan lokal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <div className="app-shell">
          <nav className="nav">
            <Link href="/">Beranda</Link>
            <Link href="/history">Riwayat</Link>
            <Link href="/rules">Aturan</Link>
            <Link href="/fixed-costs">Biaya Tetap</Link>
            <Link href="/pools">Ringkasan Dana</Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
