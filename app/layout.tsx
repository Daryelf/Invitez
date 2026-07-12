import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "After Hours Invitation",
  description: "Open the After Hours invitation.",
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
