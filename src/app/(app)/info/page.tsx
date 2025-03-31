"use client";

import { PublicKey } from "@solana/web3.js";
import { Calendar, Copy } from "lucide-react";
import { useState, useEffect } from "react";

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
import { connection } from "@/lib/solana/connection";
import { useWalletStore } from "@/store/walletStore";

export default function InfoPage() {
  const { multisigAddress, pdaBalance, guardianPDA } = useWalletStore();
  const [threshold, setThreshold] = useState(1);
  const [memberCount, setMemberCount] = useState(1);
  const [createdDate, setCreatedDate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchWalletInfo = async () => {
      if (!multisigAddress) return;

      try {
        // Fetch account info to get creation date and other details
        const accountInfo = await connection.getAccountInfo(
          new PublicKey(multisigAddress),
        );
        if (accountInfo) {
          // Lấy thông tin từ account data
          const dataView = new DataView(accountInfo.data.buffer);
          // Byte đầu tiên là threshold
          setThreshold(dataView.getUint8(8));
          setCreatedDate(new Date());

          // Số lượng guardian là 1 (owner) + số guardian khác
          const guardianCount = 1; // Tạm thời set là 1, sau này sẽ đọc từ data
          setMemberCount(guardianCount);
        }
      } catch (error) {
        console.error("Error fetching wallet info:", error);
      }
    };

    fetchWalletInfo();
  }, [multisigAddress]);

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatBalance = (bal: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(bal * 72.45);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Info</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Vault Info Card */}
        <Card className="bg-card/30 p-4">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500" />
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between">
                  <div className="pr-2 font-mono text-sm break-all">
                    {multisigAddress?.toString() || "N/A"}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      handleCopyAddress(multisigAddress?.toString() || "")
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-muted-foreground text-sm">Moon Wallet</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-muted-foreground text-sm">
                  Vault balance
                </div>
                <div className="text-2xl font-bold">
                  {formatBalance(pdaBalance)}
                </div>
                <div className="text-muted-foreground text-sm">
                  {pdaBalance.toFixed(4)} SOL
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-sm">Created on</div>
                <div className="bg-muted/50 flex items-center justify-between rounded-md p-2">
                  <span className="text-sm">{formatDate(createdDate)}</span>
                  <Calendar className="h-4 w-4" />
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-sm">
                  Guardian Address
                </div>
                <div className="bg-muted/50 flex items-center justify-between rounded-md p-2">
                  <span className="font-mono text-sm">
                    {guardianPDA?.toString() || "N/A"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleCopyAddress(guardianPDA?.toString() || "")
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Right Column Cards */}
        <div className="grid grid-cols-1 gap-4">
          {/* Threshold Card */}
          <Card className="bg-card/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#1E3A8A]/20 p-1.5">
                <svg
                  className="text-primary h-5 w-5"
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
                  {threshold}/{memberCount}
                </span>
                <span className="text-muted-foreground text-sm">Threshold</span>
              </div>
            </div>
          </Card>

          {/* Members Card */}
          <Card className="bg-card/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 p-1.5">
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
                <span className="text-xl font-bold">{memberCount}</span>
                <span className="text-muted-foreground text-sm">Members</span>
              </div>
            </div>
          </Card>

          {/* Settings Card */}
          <Card className="bg-card/30 p-4">
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
        </div>
      </div>
    </div>
  );
}
