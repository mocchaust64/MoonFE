"use client";

import { motion } from "framer-motion";

import CreateWallet from "@/components/Wallet/CreateWallet";

export default function CreateWalletPage() {
  return (
    <motion.main
      className="mt-14 flex h-[calc(100vh-56px)] flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto flex max-w-2xl flex-1 flex-col px-4 py-4">
        <motion.div
          className="mb-4 text-center"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className="bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-2xl font-bold text-transparent">
            Create New Wallet
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Set up your secure multi-signature wallet
          </p>
        </motion.div>

        <motion.div
          className="flex-1"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <CreateWallet />
        </motion.div>

        <motion.div
          className="mt-4 text-center text-xs text-[#64748B]"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          Powered by Solana Blockchain
        </motion.div>
      </div>
    </motion.main>
  );
}
