"use client";

import CreateWallet from "@/components/Wallet/CreateWallet";

export default function CreateWalletPage() {
  return (
    <main className="mt-14 flex h-[calc(100vh-56px)] flex-col">
      <div className="container mx-auto flex max-w-2xl flex-1 flex-col px-4 py-4">
        <div className="mb-4 text-center">
          <h1 className="bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-2xl font-bold text-transparent">
            Create New Wallet
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Set up your secure multi-signature wallet
          </p>
        </div>

        <div className="flex-1">
          <CreateWallet />
        </div>

        <div className="mt-4 text-center text-xs text-[#64748B]">
          Powered by Solana Blockchain
        </div>
      </div>
    </main>
  );
}
