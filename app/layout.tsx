import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kushagra — Photography",
  description: "Selected photographs by Kushagra, a BDes student in Communication Design.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
