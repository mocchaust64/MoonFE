"use client";

import { useParams, useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { GuardianSignup } from "@/components/Wallet/Guardian/GuardianSignup";

export default function GuardianPage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params.inviteCode as string;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GuardianSignup
        inviteCode={inviteCode}
        onComplete={() => {
          toast.success("Registration successful!");
          router.push("/");
        }}
      />
    </div>
  );
}
