"use client";

import { motion } from "framer-motion";
import { Copy } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { toast } from "sonner";

export function InfoContent() {
  const { formatAddress, multisigPDA, guardians, threshold, guardianCount, walletName, balance } = useWalletInfo();

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied to clipboard");
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        initial={{ y: -10 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold">Info</h1>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Vault Info Card */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white" />
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="text-base font-medium">
                    {walletName || "Unnamed Wallet"}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Moon Wallet
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-muted-foreground text-sm">
                    Vault balance
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {balance.toFixed(4)} SOL
                  </div>
                </div>

                <div>
                  <div className="text-muted-foreground text-sm">
                    Multisig Address
                  </div>
                  <div className="bg-muted/50 flex items-center justify-between rounded-md p-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-sm">
                        {multisigPDA
                          ? formatAddress(multisigPDA.toString())
                          : "N/A"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {multisigPDA?.toString()}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleCopyAddress(multisigPDA?.toString() || "")
                      }
                      className="transition-transform hover:scale-110"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Right Column Cards */}
        <motion.div
          className="grid grid-cols-1 gap-4"
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {/* Threshold Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 p-1.5">
                  <svg
                    className="text-blue-500 h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">
                    {threshold}/{guardianCount}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    Threshold
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Members Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-100 p-1.5">
                  <svg
                    className="h-5 w-5 text-amber-500"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{guardians.length}</span>
                  <span className="text-muted-foreground text-sm">Members</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Settings Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-4">
              <div className="space-y-3">
                <h2 className="text-base font-semibold">Settings</h2>
                <div>
                  <div className="text-muted-foreground text-sm">Explorer</div>
                  <Select defaultValue="solana-fm">
                    <SelectTrigger className="bg-muted/50 hover:bg-muted w-full border-0">
                      <SelectValue placeholder="Select explorer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solana-fm">Solana FM</SelectItem>
                      <SelectItem value="solscan">Solscan</SelectItem>
                      <SelectItem value="solana-explorer">
                        Solana Explorer
                      </SelectItem>
                      <SelectItem value="xray">XRAY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
} 