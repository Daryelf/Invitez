import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.invitez.xyz"),
  title: "Invitez | Digital Invitation",
  description: "A private digital invitation and RSVP experience.",
  openGraph: {
    title: "You Have Mail",
    description: "Open your invitation and RSVP.",
    url: "https://www.invitez.xyz/rsvp",
    siteName: "Invitez",
    images: [{ url: "/og-rsvp.jpg", width: 1200, height: 630, alt: "A premium floral envelope marked Special Invitation" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "You Have Mail",
    description: "Open your invitation and RSVP.",
    images: ["/og-rsvp.jpg"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141414",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
