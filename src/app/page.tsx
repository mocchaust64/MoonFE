"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import LoginWallet from "@/components/Wallet/LoginWallet";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="from-background via-background/50 to-muted absolute inset-0 flex items-center justify-center bg-gradient-to-b">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 -right-[50%] h-[100%] w-[100%] rounded-full bg-blue-500/5 blur-[128px]" />
        <div className="absolute -bottom-[50%] -left-[50%] h-[100%] w-[100%] rounded-full bg-cyan-500/5 blur-[128px]" />
      </div>

      {/* Main content */}
      <div className="relative container flex min-h-screen items-center justify-center py-20">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-center gap-12 text-center">
          {/* Hero section */}
          <div className="space-y-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Your Gateway to{" "}
              <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                Web3
              </span>
            </h1>

            <p className="text-muted-foreground mx-auto max-w-2xl text-lg sm:text-xl">
              Experience the future of digital asset management with our secure,
              simple, and powerful multisig wallet
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex w-full max-w-md flex-col justify-center gap-4 sm:flex-row">
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

          {/* Features section */}
          <div className="grid w-full max-w-4xl grid-cols-1 gap-6 px-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors hover:bg-white/10">
              <h3 className="mb-2 text-lg font-semibold">Secure</h3>
              <p className="text-muted-foreground text-sm">
                Multi-signature security for your digital assets
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors hover:bg-white/10">
              <h3 className="mb-2 text-lg font-semibold">Simple</h3>
              <p className="text-muted-foreground text-sm">
                User-friendly interface for easy management
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors hover:bg-white/10">
              <h3 className="mb-2 text-lg font-semibold">Powerful</h3>
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
