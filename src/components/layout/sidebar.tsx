"use client";

// Icons
import { LayoutDashboard, History, Users, Info, Copy } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { cn } from "@/lib/utils";
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { usePathname } from "next/navigation";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
}

const NavItem = ({ href, icon, label, isActive }: NavItemProps) => (
  <Link
    href={href}
    className={cn(
      "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-400 transition-all hover:text-blue-400",
      isActive ? "bg-indigo-900/40 text-white" : "hover:bg-zinc-800/50",
    )}
  >
    <div className={cn(
      "flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800/80",
      isActive && "bg-indigo-500/30"
    )}>
      {icon}
    </div>
    <span>{label}</span>
  </Link>
);

const Sidebar = () => {
  const pathname = usePathname();
  const { multisigPDA, balance, walletName } = useWalletInfo();

  const handleCopyAddress = () => {
    if (multisigPDA) {
      navigator.clipboard.writeText(multisigPDA.toString());
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return "";
    const start = address.substring(0, 10);
    const end = address.substring(address.length - 6);
    return `${start}...${end}`;
  };

  // Format balance với 4 chữ số thập phân
  const formatBalance = (balanceInSol: number) => {
    return balanceInSol.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  };

  return (
    <div className="bg-[#080808] h-full flex flex-col border-r border-zinc-800/50">
      {/* Mobile Navigation */}
      <div className="flex h-14 items-center justify-around px-2 md:hidden">
        <Link href="/dashboard" className={cn(
          "flex flex-col items-center text-gray-400 hover:text-blue-400",
          pathname === "/dashboard" && "text-blue-400"
        )}>
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-xs">Dashboard</span>
        </Link>
        <Link href="/transactions" className={cn(
          "flex flex-col items-center text-gray-400 hover:text-blue-400",
          pathname === "/transactions" && "text-blue-400"
        )}>
          <History className="h-5 w-5" />
          <span className="text-xs">Transactions</span>
        </Link>
        <Link href="/owners" className={cn(
          "flex flex-col items-center text-gray-400 hover:text-blue-400",
          pathname === "/owners" && "text-blue-400"
        )}>
          <Users className="h-5 w-5" />
          <span className="text-xs">Owners</span>
        </Link>
        <Link href="/info" className={cn(
          "flex flex-col items-center text-gray-400 hover:text-blue-400",
          pathname === "/info" && "text-blue-400"
        )}>
          <Info className="h-5 w-5" />
          <span className="text-xs">Info</span>
        </Link>
      </div>

      {/* Desktop Wallet Info Card */}
      <div className="hidden md:block p-4">
        <Card className="bg-zinc-900/20 border-zinc-800/80 p-5 backdrop-blur-sm shadow-md rounded-xl">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-16 w-16 bg-blue-900/30 text-white ring-1 ring-blue-500/20">
                <AvatarFallback className="bg-blue-950 text-xl">
                  D
                </AvatarFallback>
              </Avatar>
              <div className="absolute -right-1 bottom-1 h-4 w-4 rounded-full bg-green-500 border-2 border-[#080808]"></div>
            </div>
            <div className="text-gray-200 text-md font-medium mt-1">
              {walletName || "Digital-X0lj3"}
            </div>
            <div className="text-blue-500 text-xl font-semibold">
              {balance ? formatBalance(balance) : "0.0000"} <span className="text-sm text-gray-400">SOL</span>
            </div>
            <div className="flex items-center mt-1 bg-zinc-900/60 rounded-lg py-2 px-3 border border-zinc-800/80 w-full justify-between">
              <div className="text-xs text-gray-400 font-mono truncate">
                {multisigPDA ? formatAddress(multisigPDA.toString()) : "EXDTV6KKM...PVMbj"}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyAddress}
                className="h-6 w-6 rounded-full bg-zinc-800/50 hover:bg-zinc-700/70 text-gray-400"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden md:block flex-1 px-4 py-5">
        <div className="space-y-2">
          <NavItem
            href="/dashboard"
            icon={<LayoutDashboard className="h-4 w-4" />}
            label="Dashboard"
            isActive={pathname === "/dashboard"}
          />
          <NavItem
            href="/transactions"
            icon={<History className="h-4 w-4" />}
            label="Transactions"
            isActive={pathname === "/transactions"}
          />
          <NavItem
            href="/owners"
            icon={<Users className="h-4 w-4" />}
            label="Owners"
            isActive={pathname === "/owners"}
          />
          <NavItem
            href="/info"
            icon={<Info className="h-4 w-4" />}
            label="Info"
            isActive={pathname === "/info"}
          />
        </div>
      </nav>
      
      {/* Bottom Logout Button */}
      <div className="hidden md:block mt-auto p-4">
        <Link href="/logout">
          <Button 
            variant="outline" 
            className="w-full bg-[#080808] border-zinc-800/80 hover:bg-zinc-900 text-white text-sm justify-start transition-all duration-200"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800/80 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </div>
            Logout
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
