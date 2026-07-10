import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Night Shift / After Hours",
  description: "A night for good people, loud music, and staying a little longer.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
