import "@/styles/globals.css";

import { TRPCReactProvider } from "@/trpc/react";
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
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
