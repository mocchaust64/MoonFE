"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

import CreateWallet from "@/components/Wallet/CreateWallet";

export default function CreateWalletPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0c1220] w-full">
      {/* Particle background overlay */}
      <div className="fixed inset-0 z-0 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(rgba(66, 109, 251, 0.1) 2px, transparent 2px)`,
          backgroundSize: '40px 40px',
        }} />
      </div>

      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 -right-[40%] h-[100%] w-[100%] rounded-full bg-blue-500/5 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[40%] -left-[40%] h-[100%] w-[100%] rounded-full bg-indigo-500/5 blur-[120px] animate-pulse" style={{animationDelay: "1s"}} />
        <div className="absolute top-[20%] left-[50%] h-[40%] w-[30%] rounded-full bg-purple-500/3 blur-[100px] animate-pulse" style={{animationDelay: "2s"}} />
      </div>

      {/* Navigation bar */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full bg-gradient-to-r from-indigo-600 via-blue-500 to-blue-600 py-3 px-6 md:px-8 flex items-center justify-between z-10 sticky top-0 backdrop-blur-sm shadow-md"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white text-blue-600 font-bold text-lg shadow-lg shadow-indigo-500/20">
            G
          </div>
          <span className="text-white font-medium text-lg">Gokei Wallet</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center text-white/90 text-sm hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>
        </div>
      </motion.div>

      <motion.main
        className="flex-1 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="container mx-auto flex max-w-2xl flex-1 flex-col px-4 py-16">
          <motion.div
            className="mb-8 text-center"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-4xl font-bold tracking-tight text-white mb-4">
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent block animate-gradient-x">
                Create New Wallet
              </span>
            </h1>
            <p className="text-gray-300 mx-auto max-w-lg text-base">
              Set up your secure multi-signature wallet with biometric authentication
            </p>
          </motion.div>

          <motion.div
            className="w-full"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <CreateWallet />
          </motion.div>

          <motion.div
            className="mt-8 text-center text-sm text-gray-400"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Powered by Solana Blockchain
          </motion.div>
        </div>
      </motion.main>
      
      {/* Footer */}
      <div className="w-full mt-auto border-t border-gray-800/50 pt-6 pb-8 text-center text-gray-500 text-sm z-10">
        <p>© 2025 Gokei Wallet. All rights reserved.</p>
      </div>
    </div>
  );
}
