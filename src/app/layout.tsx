import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

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
  title: "Gokei Wallet - Your Secure Crypto Wallet",
  description:
    "A secure and user-friendly cryptocurrency wallet for managing your digital assets",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0c1220",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-[#0c1220] h-full">
      <body
        className={cn(
          "min-h-screen w-full font-sans antialiased overflow-x-hidden",
          geistSans.variable,
          geistMono.variable,
        )}
        suppressHydrationWarning
      >
        <ProtectedRoute>
          <div className="flex min-h-screen w-full flex-col">
            <main className="relative flex-1 w-full">{children}</main>
          </div>
          <Toaster />
        </ProtectedRoute>
      </body>
    </html>
  );
}
