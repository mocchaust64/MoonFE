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
    <header className="bg-[#0A0A0A] fixed top-0 right-0 left-0 z-50 h-14 border-b border-zinc-800/50 backdrop-blur-sm">
      <div className="flex h-full items-center justify-around px-10 md:px-14">
        {/* Logo Section */}
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-lg">
              G
            </div>
            <span className="text-md font-bold md:text-xl text-white">
              Gokei Wallet
            </span>
          </Link>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2 md:gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="bg-zinc-900 flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 md:gap-2 md:px-3 md:py-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-xs font-medium text-gray-300 md:text-sm">
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
    </header>
  );
};

export default Header;
