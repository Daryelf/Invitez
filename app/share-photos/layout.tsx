import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Share a Photo | Invitez",
  description: "Add a photo to the event gallery.",
  robots: { index: false, follow: false },
};

export default function SharePhotosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
