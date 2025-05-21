"use client";

import Link from "next/link";

import LogoutButton from "@/components/Wallet/LogoutButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWalletInfo } from "@/hooks/useWalletInfo";

const Header = () => {
  const { multisigPDA } = useWalletInfo();

  return (
    <header className="bg-white/95 supports-[backdrop-filter]:bg-white/60 fixed top-0 right-0 left-0 z-50 h-14 border-b border-gray-200 shadow-sm backdrop-blur">
      <div className="flex h-full justify-center">
        <div className="flex h-full w-full px-3 md:w-[1064px] md:px-0">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/(app)/dashboard" className="flex items-center space-x-2">
              <span className="text-md font-bold text-gray-800 md:text-xl">
                🌙 Gokei Wallet
              </span>
            </Link>
          </div>

          {/* Right section - Aligned with content */}
          <div className="flex flex-1 items-center justify-end gap-2 px-2 md:gap-4 md:px-8">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="bg-gray-100 flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 md:gap-2 md:px-3 md:py-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-xs font-medium text-gray-700 md:text-sm">
                      Devnet
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Connected to Solana Devnet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {multisigPDA && <LogoutButton />}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
