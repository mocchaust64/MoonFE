"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/store/walletStore";

const LogoutButton = () => {
  const { reset, multisigPDA } = useWalletStore();
  const router = useRouter();

  useEffect(() => {
    console.log("Current user in store:", {
      multisigPDA: multisigPDA?.toString(),
    });
  }, [multisigPDA]);

  const handleLogout = () => {
    reset();
    router.push("/");
  };

  if (!multisigPDA) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1 px-2 md:gap-2 md:px-3 border-gray-300 hover:bg-gray-100 text-gray-700"
      onClick={handleLogout}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden md:inline">Logout</span>
    </Button>
  );
};

export default LogoutButton;
