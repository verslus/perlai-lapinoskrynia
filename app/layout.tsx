import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Testų platforma",
  description: "Psichologinių testų platforma konsultantams ir klientams"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt">
      <body>{children}</body>
    </html>
  );
}
