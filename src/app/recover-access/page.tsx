"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RecoveryForm } from "./components/RecoveryForm";

export default function RecoverAccessPage() {
  const [step, setStep] = useState<"search" | "verify" | "create" | "confirm">("search");
  
  return (
    <motion.div
      className="flex min-h-screen flex-col items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="mb-6 w-full max-w-md"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Khôi phục quyền truy cập</AlertTitle>
          <AlertDescription>
            <p>
              Nhập tên guardian của bạn để tìm kiếm và khôi phục quyền truy cập vào ví.
              Đây là tên bạn đã đặt khi đăng ký làm guardian.
            </p>
            <p className="mt-1">
              Đảm bảo rằng bạn có mã khôi phục (recovery phrase) đã được cung cấp khi tạo guardian.
            </p>
          </AlertDescription>
        </Alert>
      </motion.div>

      <RecoveryForm currentStep={step} onStepChange={setStep} />
    </motion.div>
  );
} 