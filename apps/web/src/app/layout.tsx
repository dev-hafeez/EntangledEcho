import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Entangled Echo — AI Social Media Content & Schedule Optimization",
  description:
    "Intelligent content strategy, automated post scheduling, and quantum-inspired QUBO combinatorial optimization for Instagram and Facebook creators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
