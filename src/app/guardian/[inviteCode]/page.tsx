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

  // Fix hydration mismatch by only rendering component on client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render content until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-background via-background/50 to-muted">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background/50 to-muted">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 -right-[50%] h-[100%] w-[100%] rounded-full bg-blue-500/5 blur-[128px]" />
        <div className="absolute -bottom-[50%] -left-[50%] h-[100%] w-[100%] rounded-full bg-cyan-500/5 blur-[128px]" />
      </div>
      
      <div className="container relative z-10 mx-auto px-4 py-8 flex flex-col items-center">
        <motion.div
          className="w-full max-w-md mb-6 mt-10"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Alert className="border border-blue-800/30 bg-white/10 backdrop-blur-sm">
            <InfoIcon className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-foreground">Information</AlertTitle>
            <AlertDescription className="text-muted-foreground text-sm">
              <p className="mb-1">
                The system will automatically check confirmation status every 5 seconds.
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
