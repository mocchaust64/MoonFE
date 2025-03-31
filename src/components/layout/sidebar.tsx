"use client";

// Icons
import { LayoutDashboard, History, Users, Info, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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
import { useWalletStore } from "@/store/walletStore";

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
  const { multisigAddress, pdaBalance } = useWalletStore();
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (typeof pdaBalance === "number" && !isNaN(pdaBalance)) {
      setBalance(pdaBalance);
    }
  }, [pdaBalance]);

  const shortenAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleCopyAddress = () => {
    if (multisigAddress) {
      navigator.clipboard.writeText(multisigAddress.toString());
    }
  };

  return (
    <div className="bg-background fixed top-14 bottom-0 flex w-64 flex-col border-r">
      {/* Wallet Info Card */}
      <div className="p-3">
        <Card className="p-3">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500" />
            </Avatar>
            <div className="text-muted-foreground text-sm">
              {multisigAddress
                ? shortenAddress(multisigAddress.toString())
                : "-"}
            </div>
            <div className="text-base font-bold">
              ${(balance * 72.45).toFixed(2)}
            </div>
            <div className="text-muted-foreground text-sm">
              {balance.toFixed(4)} SOL
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
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
};

export default Sidebar;
