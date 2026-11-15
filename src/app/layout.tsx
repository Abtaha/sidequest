import "@/styles/globals.css";

import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "SideQuest",
  description: "Your personal AI agent for plans that actually happen.",
  icons: [{ rel: "icon", url: "/icon.svg" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f5f6f1] text-[#17211b] antialiased">
        {children}
      </body>
    </html>
  );
}
