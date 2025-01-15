import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatGenius",
  description: "Real-time chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
        <main className="h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}