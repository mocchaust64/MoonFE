import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import Header from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Moon Wallet - Your Secure Crypto Wallet",
  description:
    "A secure and user-friendly cryptocurrency wallet for managing your digital assets",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-background h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="relative flex-1">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
