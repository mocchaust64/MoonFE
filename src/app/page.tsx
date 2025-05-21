"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

// Import LoginWallet component với dynamic để tránh lỗi SSR
const LoginWallet = dynamic(
  () => import("@/components/Wallet/LoginWallet"),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="from-background via-background/50 to-muted absolute inset-0 flex items-center justify-center bg-gradient-to-b">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 -right-[50%] h-[100%] w-[100%] rounded-full bg-blue-500/5 blur-[128px]" />
        <div className="absolute -bottom-[50%] -left-[50%] h-[100%] w-[100%] rounded-full bg-cyan-500/5 blur-[128px]" />
      </div>

      {/* Main content */}
      <div className="relative container flex min-h-screen items-center justify-center px-4 py-10 md:py-20">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-center gap-8 text-center md:gap-12">
          {/* Hero section */}
          <div className="space-y-4 md:space-y-6">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-6xl">
              Your Gateway to{" "}
              <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                Web3
              </span>
            </h1>

            <p className="text-muted-foreground mx-auto max-w-2xl text-base md:text-lg lg:text-xl">
              Experience the future of digital asset management with our secure,
              simple, and powerful multisig wallet
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex w-full max-w-md flex-col gap-3 px-4 sm:flex-row sm:gap-4 sm:px-0">
            <Link href="/create-wallet" className="w-full sm:w-auto">
              <Button
                className="group w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:from-blue-600 hover:to-cyan-500"
                size="lg"
              >
                Create Wallet
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <div className="w-full sm:w-auto">
              <LoginWallet />
            </div>
          </div>
          
          {/* Recovery link - giữ lại từ phiên bản mới */}
          <div className="text-center">
            <Link 
              href="/recover-access" 
              className="text-sm text-gray-500 hover:text-blue-500 flex items-center justify-center gap-1 group transition-colors duration-300"
            >
              <svg className="h-4 w-4 text-gray-500 group-hover:text-blue-500 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Lost access? Recover your wallet here
            </Link>
          </div>

          {/* Features section */}
          <div className="grid w-full max-w-4xl grid-cols-1 gap-4 px-4 sm:grid-cols-3 md:gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10 md:p-6">
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-full bg-blue-500/10 p-2">
                  <svg
                    className="h-5 w-5 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">Secure</h3>
              </div>
              <p className="text-muted-foreground text-sm">
                Multi-signature security for your digital assets
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10 md:p-6">
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-full bg-green-500/10 p-2">
                  <svg
                    className="h-5 w-5 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">Simple</h3>
              </div>
              <p className="text-muted-foreground text-sm">
                User-friendly interface for easy management
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10 md:p-6">
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-full bg-purple-500/10 p-2">
                  <svg
                    className="h-5 w-5 text-purple-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">Powerful</h3>
              </div>
              <p className="text-muted-foreground text-sm">
                Advanced features for complete control
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
