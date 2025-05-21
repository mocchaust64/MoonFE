"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

// Import LoginWallet component với dynamic để tránh lỗi SSR
const LoginWallet = dynamic(
  () => import("@/components/Wallet/LoginWallet"),
  { ssr: false }
);

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0c1220] w-full">
      {/* Particle background overlay */}
      <div className="fixed inset-0 z-0 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(rgba(66, 109, 251, 0.1) 2px, transparent 2px)`,
          backgroundSize: '40px 40px',
        }} />
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
          <div className="text-white/90 text-sm flex items-center">
            <span className="bg-green-400 rounded-full h-2 w-2 mr-2 animate-pulse"></span>
            Sắp ra mắt Q2 2025
          </div>
          <div className="text-white text-sm bg-white/10 px-4 py-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer border border-white/10 backdrop-blur-sm">
            Tham gia danh sách chờ ↗
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 relative w-full flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-16 md:py-24 z-10">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 -right-[40%] h-[100%] w-[100%] rounded-full bg-blue-500/5 blur-[120px] animate-pulse" />
          <div className="absolute -bottom-[40%] -left-[40%] h-[100%] w-[100%] rounded-full bg-indigo-500/5 blur-[120px] animate-pulse" style={{animationDelay: "1s"}} />
          <div className="absolute top-[20%] left-[50%] h-[40%] w-[30%] rounded-full bg-purple-500/3 blur-[100px] animate-pulse" style={{animationDelay: "2s"}} />
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center z-10 w-full max-w-4xl mx-auto mb-16"
        >
          {/* Beta tag */}
          <motion.div 
            variants={itemVariants}
            className="mb-8 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 text-blue-400 text-sm px-5 py-1.5 rounded-full border border-blue-700/30 flex items-center shadow-lg shadow-blue-900/10 backdrop-blur-md"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-2">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
            </svg>
            Beta Access Available
          </motion.div>

          {/* Hero section */}
          <motion.h1 
            variants={itemVariants}
            className="text-4xl font-bold tracking-tight md:text-5xl lg:text-7xl text-white mb-6 leading-tight"
          >
            Your Gateway to{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent block mt-2 animate-gradient-x">
              Self-Custodial Security
            </span>
          </motion.h1>

          <motion.p 
            variants={itemVariants}
            className="text-gray-300 mx-auto max-w-3xl text-base md:text-lg mb-12 leading-relaxed"
          >
            Experience the future of digital asset management with our secure, multi-signature wallet featuring enhanced security and easy access recovery.
          </motion.p>

          {/* Action buttons */}
          <motion.div 
            variants={itemVariants}
            className="flex w-full max-w-md flex-col gap-4 sm:flex-row sm:gap-5 sm:px-0 mb-6 mx-auto"
          >
            <Link href="/create-wallet" className="w-full sm:w-auto group">
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 rounded-md py-3 h-13 px-8 flex items-center justify-center font-medium text-base shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-600/25 border border-blue-500/20"
                size="lg"
              >
                Create Wallet
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
            <div className="w-full sm:w-auto relative z-10">
              <LoginWallet />
            </div>
          </motion.div>
          
          {/* Recovery link */}
          <motion.div 
            variants={itemVariants}
            className="text-center"
          >
            <Link 
              href="/recover-access" 
              className="text-sm text-gray-400 hover:text-blue-300 flex items-center justify-center gap-1 group transition-colors duration-300"
            >
              <svg className="h-4 w-4 text-gray-500 group-hover:text-blue-400 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Mất quyền truy cập? Khôi phục dễ dàng tại đây
            </Link>
          </motion.div>
        </motion.div>

        {/* Features section */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="w-full max-w-7xl mx-auto mt-10 z-10 px-4 sm:px-6 md:px-8"
        >
          <h2 className="text-2xl font-bold text-white text-center mb-16 relative">
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Why Choose Gokei Wallet?</span>
            <span className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <motion.div 
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="bg-gradient-to-b from-[#121b2e] to-[#1a2541] rounded-2xl border border-blue-900/30 p-6 md:p-8 shadow-lg shadow-blue-900/5 backdrop-blur-sm hover:border-blue-700/40 transition-all duration-300"
            >
              <div className="mb-6 bg-blue-900/30 w-14 h-14 flex items-center justify-center rounded-xl shadow-inner shadow-blue-900/20 border border-blue-800/20">
                <svg
                  className="h-6 w-6 text-blue-400"
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
              <h3 className="text-xl font-semibold text-white mb-3">Secure</h3>
              <p className="text-gray-400 leading-relaxed">
                Multi-signature security with biometric authentication for your digital assets
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="bg-gradient-to-b from-[#121b2e] to-[#1a2541] rounded-2xl border border-purple-900/30 p-6 md:p-8 shadow-lg shadow-purple-900/5 backdrop-blur-sm hover:border-purple-700/40 transition-all duration-300"
            >
              <div className="mb-6 bg-purple-900/30 w-14 h-14 flex items-center justify-center rounded-xl shadow-inner shadow-purple-900/20 border border-purple-800/20">
                <svg
                  className="h-6 w-6 text-purple-400"
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
              <h3 className="text-xl font-semibold text-white mb-3">Simple</h3>
              <p className="text-gray-400 leading-relaxed">
                User-friendly interface designed for both beginners and experienced users
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="bg-gradient-to-b from-[#121b2e] to-[#1a2541] rounded-2xl border border-cyan-900/30 p-6 md:p-8 shadow-lg shadow-cyan-900/5 backdrop-blur-sm hover:border-cyan-700/40 transition-all duration-300"
            >
              <div className="mb-6 bg-cyan-900/30 w-14 h-14 flex items-center justify-center rounded-xl shadow-inner shadow-cyan-900/20 border border-cyan-800/20">
                <svg
                  className="h-6 w-6 text-cyan-400"
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
              <h3 className="text-xl font-semibold text-white mb-3">Powerful</h3>
              <p className="text-gray-400 leading-relaxed">
                Advanced features with complete control over your digital assets
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="w-full mt-24 border-t border-gray-800/50 pt-6 pb-8 text-center text-gray-500 text-sm">
          <p>© 2025 Gokei Wallet. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
