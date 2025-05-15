"use client";

import { motion } from "framer-motion";
import { InfoIcon } from "lucide-react";
import { useParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";

import { GuardianSignup } from "@/components/Guardian/GuardianSignup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function GuardianPage() {
  const params = useParams();
  const inviteCode = params.inviteCode as string;
  const [isClient, setIsClient] = useState(false);

  // Fix hydration mismatch bằng cách chỉ render component khi đã ở client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Không render nội dung cho đến khi client-side hydration hoàn tất
  if (!isClient) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-zinc-900 to-black">
      <div className="container mx-auto px-4 py-8 flex flex-col items-center">
        <motion.div
          className="w-full max-w-md mb-6 mt-4"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Alert className="border border-blue-800/40 bg-blue-950/30">
            <InfoIcon className="h-4 w-4 text-blue-400" />
            <AlertTitle className="text-blue-200">Information</AlertTitle>
            <AlertDescription className="text-blue-300/80 text-sm">
              <p className="mb-1">
                The system will automatically check confirmation status every 5
                seconds.
              </p>
              <p>Once confirmed, you will be redirected to the dashboard.</p>
            </AlertDescription>
          </Alert>
        </motion.div>

        <motion.div
          className="w-full max-w-md"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <GuardianSignup
            inviteCode={inviteCode}
            onComplete={() => {
              toast.success(
                "Registration submitted! Please wait for owner confirmation.",
              );
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
