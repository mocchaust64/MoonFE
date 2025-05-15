"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RecoveryForm } from "./components/RecoveryForm";

export default function RecoverAccessPage() {
  const [step, setStep] = useState<"search" | "create">("search");
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#0c1220] relative overflow-hidden">
      {/* Hiệu ứng background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 -right-[40%] h-[100%] w-[100%] rounded-full bg-blue-500/5 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[40%] -left-[40%] h-[100%] w-[100%] rounded-full bg-indigo-500/5 blur-[120px] animate-pulse" style={{animationDelay: "1s"}} />
        <div className="absolute top-[20%] left-[50%] h-[40%] w-[30%] rounded-full bg-purple-500/3 blur-[100px] animate-pulse" style={{animationDelay: "2s"}} />
      </div>

      <motion.div
        className="mb-8 w-full max-w-md z-10"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Alert className="glass-premium border-zinc-700/50 shadow-xl text-blue-100">
          <ShieldCheckIcon className="h-5 w-5 text-blue-400" />
          <AlertTitle className="text-lg font-semibold text-blue-300">Khôi phục quyền truy cập</AlertTitle>
          <AlertDescription className="text-gray-300">
            <p className="mb-2">
              Nhập thông tin của bạn để tìm kiếm và khôi phục quyền truy cập vào ví.
            </p>
            <p className="text-sm text-blue-300/80">
              Quy trình chỉ gồm 2 bước đơn giản:
            </p>
            <ul className="text-sm text-gray-400 mt-1 space-y-1 list-disc pl-5">
              <li>Bước 1: Tìm kiếm và xác thực tài khoản của bạn</li>
              <li>Bước 2: Tạo thông tin xác thực mới để khôi phục quyền truy cập</li>
            </ul>
          </AlertDescription>
        </Alert>
      </motion.div>

      <motion.div
        className="w-full max-w-md z-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
      <RecoveryForm currentStep={step} onStepChange={setStep} />
    </motion.div>
      
      {/* Nút quay lại trang chủ */}
      <motion.div
        className="mt-6 text-center z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Link 
          href="/" 
          className="text-sm text-blue-400 transition-colors hover:text-blue-300 hover:underline"
        >
          ← Quay lại trang chủ
        </Link>
      </motion.div>
    </div>
  );
} 