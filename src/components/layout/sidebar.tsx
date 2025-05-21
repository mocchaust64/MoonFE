"use client";

// Icons
import { LayoutDashboard, History, Users, Info, Copy } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWalletInfo } from "@/hooks/useWalletInfo";

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
      "hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
      isActive && "bg-accent",
    )}
  >
    {icon}
    <span>{label}</span>
  </Link>
);

const Sidebar = () => {
  // Lấy thông tin cần thiết từ store
  const { multisigPDA, balance, walletName } = useWalletInfo();

  const handleCopyAddress = () => {
    if (multisigPDA) {
      navigator.clipboard.writeText(multisigPDA.toString());
    }
  };

  return (
    <div className="w-full flex-col md:fixed md:top-14 md:bottom-0 md:flex md:w-64 md:border-r">
      {/* Mobile Navigation */}
      <div className="flex h-14 items-center justify-around px-2 md:hidden">
        <Link href="/dashboard" className="flex flex-col items-center">
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-xs">Dashboard</span>
        </Link>
        <Link href="/transactions" className="flex flex-col items-center">
          <History className="h-5 w-5" />
          <span className="text-xs">Transactions</span>
        </Link>
        <Link href="/owners" className="flex flex-col items-center">
          <Users className="h-5 w-5" />
          <span className="text-xs">Owners</span>
        </Link>
        <Link href="/info" className="flex flex-col items-center">
          <Info className="h-5 w-5" />
          <span className="text-xs">Info</span>
        </Link>
      </div>

      {/* Desktop Wallet Info Card */}
      <div className="hidden md:block md:p-3">
        <Card className="p-3">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500" />
            </Avatar>
            <div className="text-muted-foreground text-sm font-medium">
              {walletName || "Unnamed Wallet"}
            </div>
            <div className="text-muted-foreground text-sm">
              {balance.toLocaleString(undefined, {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4
              })} SOL
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyAddress}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy Address</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </Card>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden md:block md:flex-1 md:px-3 md:py-2">
        <div className="space-y-1">
          <NavItem
            href="/dashboard"
            icon={<LayoutDashboard className="h-4 w-4" />}
            label="Dashboard"
          />
          <NavItem
            href="/transactions"
            icon={<History className="h-4 w-4" />}
            label="Transactions"
          />
          <NavItem
            href="/owners"
            icon={<Users className="h-4 w-4" />}
            label="Owners"
          />
          <NavItem
            href="/info"
            icon={<Info className="h-4 w-4" />}
            label="Info"
          />
        </div>
      </nav>
    </div>
  );
}

export default Sidebar;
