"use client";

import { motion } from "framer-motion";
import { InfoIcon } from "lucide-react";
import { useParams } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { GuardianSignup } from "@/components/Guardian/GuardianSignup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function GuardianPage() {
  const params = useParams();
  const inviteCode = params.inviteCode as string;

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
          <AlertTitle>Information</AlertTitle>
          <AlertDescription>
            <p>
              The system will automatically check confirmation status every 5
              seconds.
            </p>
            <p>Once confirmed, you will be redirected to the dashboard.</p>
          </AlertDescription>
        </Alert>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="w-full max-w-md">
          <CardHeader className="pb-2">
            <CardTitle>Guardian Registration</CardTitle>
            <CardDescription>
              Complete your registration as a guardian for this wallet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuardianSignup
              inviteCode={inviteCode}
              onComplete={() => {
                toast.success(
                  "Registration submitted! Please wait for owner confirmation.",
                );
              }}
            />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
