// Icons
import {
  LayoutDashboard,
  History,
  Users,
  Vault,
  Info,
  QrCode,
  Copy,
} from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/modal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  hasSubmenu?: boolean;
}

const NavItem = ({ href, icon, label, isActive, hasSubmenu }: NavItemProps) => (
  <Link
    href={href}
    className={cn(
      "hover:bg-accent flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
      isActive && "bg-accent",
      hasSubmenu && "justify-between",
    )}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span>{label}</span>
    </div>
    {hasSubmenu && (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    )}
  </Link>
);

const Sidebar = () => {
  return (
    <div className="bg-background fixed top-14 bottom-0 w-64 overflow-y-auto border-r pl-6">
      {/* Wallet Info Card */}
      <div className="p-4">
        <Card className="p-4">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500" />
            </Avatar>
            <div className="text-muted-foreground text-sm">5byCFmkb9B...</div>
            <div className="text-lg font-bold">$0.00</div>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Modal>
                      <ModalTrigger asChild>
                        <Button variant="outline" size="icon">
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </ModalTrigger>
                      <ModalContent className="max-w-[400px]">
                        <ModalHeader>
                          <ModalTitle>Receive assets</ModalTitle>
                        </ModalHeader>
                        <div className="space-y-6 p-6">
                          <div className="bg-accent/50 space-y-4 rounded-lg p-4">
                            <h3 className="font-semibold">
                              Share your Squad&apos;s address or scan the QR
                            </h3>
                            <p className="text-muted-foreground text-sm">
                              This is the address of your Squad. Deposit funds
                              by scanning the QR code or copying the address
                              below
                            </p>
                          </div>
                          <div className="flex justify-center">
                            <div className="rounded-lg bg-white p-3">
                              <QrCode className="h-40 w-40" />
                            </div>
                          </div>
                        </div>
                      </ModalContent>
                    </Modal>
                  </TooltipTrigger>
                  <TooltipContent>Show QR Code</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy Address</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </Card>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 p-4">
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
          href="/vault"
          icon={<Vault className="h-4 w-4" />}
          label="Vault"
        />
        <NavItem
          href="/info"
          icon={<Info className="h-4 w-4" />}
          label="Info"
        />
      </nav>
    </div>
  );
};

export default Sidebar;
