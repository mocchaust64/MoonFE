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
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
      <motion.div
        className="mb-8 w-full max-w-md"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Alert className="border-blue-100 bg-blue-50">
          <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
          <AlertTitle className="text-lg font-semibold text-blue-700">Recover Access</AlertTitle>
          <AlertDescription className="text-gray-600">
            <p className="mb-2">
              Enter your information to search and recover access to your wallet.
            </p>
            <p className="text-sm text-blue-600">
              The process consists of 2 simple steps:
            </p>
            <ul className="text-sm text-gray-500 mt-1 space-y-1 list-disc pl-5">
              <li>Step 1: Search and verify your account</li>
              <li>Step 2: Create new credentials to recover access</li>
            </ul>
          </AlertDescription>
        </Alert>
      </motion.div>

      <motion.div
        className="w-full max-w-md"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <RecoveryForm currentStep={step} onStepChange={setStep} />
      </motion.div>
      
      <motion.div
        className="mt-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Link 
          href="/" 
          className="text-sm text-blue-600 transition-colors hover:text-blue-500 hover:underline"
        >
          ← Back to Home
        </Link>
      </motion.div>
    </div>
  );
} 