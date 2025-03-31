"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWalletStore } from "@/store/walletStore";

const Header = () => {
  const { isLoggedIn, reset } = useWalletStore();
  const router = useRouter();

  const handleLogout = () => {
    reset();
    router.push("/");
  };

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 fixed top-0 right-0 left-0 z-50 h-14 border-b backdrop-blur">
      <div className="flex h-full justify-center">
        <div className="flex h-full w-[1064px]">
          {/* Logo Section - Aligned with sidebar */}
          <div className="flex w-64 items-center px-3">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <span className="text-xl font-bold">🌙 Moon Wallet</span>
            </Link>
          </div>

          {/* Right section - Aligned with content */}
          <div className="flex flex-1 items-center justify-end gap-4 px-8">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="bg-background/50 flex items-center gap-2 rounded-md border px-3 py-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium">Localnet</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Connected to Solana Mainnet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isLoggedIn && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
