import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Google Replica",
  description: "A simple Google homepage replica",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}