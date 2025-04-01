"use client";

import {
  ChevronDown,
  ChevronUp,
  Users,
  ExternalLink,
  UserPlus,
} from "lucide-react";
import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { GuardianConfirm } from "@/components/Wallet/Guardian/GuardianConfirm";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  getPendingInvites,
  getGuardianData,
} from "@/lib/firebase/guardianService";
import { cn } from "@/lib/utils";
import { useWalletStore } from "@/store/walletStore";

// Interface cho GuardianData
export interface GuardianData {
  inviteCode: string;
  guardianId: number;
  multisigAddress: string;
  guardianName: string;
  hashedRecoveryBytes: number[];
  webauthnCredentialId: string;
  webauthnPublicKey: number[];
  status: "pending" | "ready" | "completed";
}

interface Transaction {
  id: string;
  type: string;
  icon: React.ReactNode;
  address: string;
  label: string;
  time: string;
  status: string;
  statusColor: string;
  // Additional details for expanded view
  details: {
    author: string;
    createdOn: string;
    executedOn: string;
    transactionLink: string;
    results: {
      confirmed: number;
      rejected: number;
      threshold: string;
    };
  };
}

const transactions: Transaction[] = [
  {
    id: "1",
    type: "Remove Owner",
    icon: <Users className="h-5 w-5 text-red-500" />,
    address: "9oEc...iPyN",
    label: "Owner",
    time: "11:54 AM",
    status: "Executed",
    statusColor: "text-green-500",
    details: {
      author: "9kcd...hw29",
      createdOn: "Mar 25, 2025, 11:53 AM",
      executedOn: "Mar 25, 2025, 11:54 AM",
      transactionLink: "5TnBx3QDxQC1...j2zeRAjjbW3K",
      results: {
        confirmed: 2,
        rejected: 0,
        threshold: "2/3",
      },
    },
  },
];

export default function TransactionsPage() {
  const { multisigAddress } = useWalletStore();
  const [expandedTransactions, setExpandedTransactions] = useState<
    Record<string, boolean>
  >({});
  const [pendingGuardians, setPendingGuardians] = useState<GuardianData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const toggleTransaction = (id: string) => {
    setExpandedTransactions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Load pending guardians từ Firebase
  const loadPendingGuardians = useCallback(async () => {
    if (!multisigAddress) {
      console.log("No multisig address found");
      setPendingGuardians([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Lấy danh sách mã mời đang chờ cho địa chỉ ví hiện tại
      console.log(
        "Fetching pending invites for multisig:",
        multisigAddress.toString(),
      );
      const pendingInvites = await getPendingInvites(
        multisigAddress.toString(),
      );
      console.log("Pending invites for current multisig:", pendingInvites);

      if (!pendingInvites || pendingInvites.length === 0) {
        setPendingGuardians([]);
        setIsLoading(false);
        return;
      }

      // 2. Lấy thông tin chi tiết của từng guardian
      const guardianDetails = await Promise.all(
        pendingInvites.map(async (inviteCode) => {
          const guardianData = await getGuardianData(inviteCode);
          return guardianData;
        }),
      );

      // 3. Lọc các guardian có dữ liệu hợp lệ
      const validGuardians = guardianDetails.filter(Boolean) as GuardianData[];
      console.log("Valid guardians:", validGuardians);

      setPendingGuardians(validGuardians);
    } catch (error) {
      console.error("Error loading pending guardians:", error);
      toast.error("Failed to load pending guardians");
    } finally {
      setIsLoading(false);
    }
  }, [multisigAddress]);

  // Auto refresh danh sách pending guardians mỗi 10 giây
  useEffect(() => {
    if (!multisigAddress) return;

    // Tải dữ liệu ngay lập tức khi component mount
    loadPendingGuardians();

    // Thiết lập interval để tự động refresh
    const refreshInterval = setInterval(() => {
      console.log("Auto refreshing pending guardians...");
      loadPendingGuardians();
    }, 10000); // 10 giây

    // Dọn dẹp interval khi component unmount
    return () => clearInterval(refreshInterval);
  }, [multisigAddress, loadPendingGuardians]);

  // Load data khi component mount hoặc multisigAddress thay đổi
  useEffect(() => {
    loadPendingGuardians();
  }, [multisigAddress, loadPendingGuardians]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <Button onClick={loadPendingGuardians} disabled={isLoading}>
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* Pending Guardians Section */}
      {pendingGuardians.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Pending Guardian Confirmations
          </h2>

          {pendingGuardians.map((guardian) => (
            <Card key={guardian.inviteCode} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg">
                      Guardian Confirmation
                    </CardTitle>
                  </div>
                  <div className="text-sm font-medium text-yellow-500">
                    Waiting for confirmation
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="font-medium">Guardian Details</h3>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span>{guardian.guardianName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ID:</span>
                        <span>{guardian.guardianId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Invite Code:
                        </span>
                        <span className="font-mono">{guardian.inviteCode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-center">
                    <GuardianConfirm
                      inviteCode={guardian.inviteCode}
                      onSuccess={() => {
                        toast.success("Guardian confirmed successfully");
                        loadPendingGuardians();
                      }}
                      onError={(error) => {
                        toast.error(error.message);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Hiển thị thông báo khi không có pending guardians */}
      {pendingGuardians.length === 0 && !isLoading && (
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center space-y-2 py-8 text-center">
            <UserPlus className="text-muted-foreground/50 h-12 w-12" />
            <h3 className="text-lg font-medium">
              No pending guardian confirmations
            </h3>
            <p className="text-muted-foreground">
              When someone registers as a guardian, you&apos;ll see them here
              for confirmation.
            </p>
          </div>
        </Card>
      )}

      {/* Existing Transactions Section */}
      <div className="mt-8 space-y-2">
        <div className="text-muted-foreground text-sm">Recent Transactions</div>

        {transactions.map((transaction) => (
          <div key={transaction.id} className="transition-all duration-200">
            <Card
              className={cn(
                "hover:bg-accent/50 cursor-pointer p-4 transition-colors",
                expandedTransactions[transaction.id] && "rounded-b-none",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">{transaction.icon}</div>
                  <div>
                    <div className="font-medium">{transaction.type}</div>
                    <div className="text-muted-foreground text-sm">
                      {transaction.label}
                    </div>
                  </div>
                  <div className="text-sm">{transaction.address}</div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-sm">{transaction.time}</div>
                    <div className="text-muted-foreground text-xs">Time</div>
                  </div>

                  <div className="text-right">
                    <div className={`text-sm ${transaction.statusColor}`}>
                      {transaction.status}
                    </div>
                    <div className="text-muted-foreground text-xs">Status</div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleTransaction(transaction.id)}
                    aria-label={
                      expandedTransactions[transaction.id]
                        ? "Collapse details"
                        : "Expand details"
                    }
                  >
                    {expandedTransactions[transaction.id] ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {expandedTransactions[transaction.id] && (
              <Card className="bg-muted/50 rounded-t-none border-t-0 p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Info</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Author</span>
                        <span>{transaction.details.author}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Created on
                        </span>
                        <span>{transaction.details.createdOn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Executed on
                        </span>
                        <span>{transaction.details.executedOn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Transaction link
                        </span>
                        <a
                          href={`#${transaction.details.transactionLink}`}
                          className="flex items-center text-blue-500 hover:underline"
                        >
                          {transaction.details.transactionLink.substring(0, 15)}
                          ...
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Results</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-background rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-500">
                          {transaction.details.results.confirmed}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Confirmed
                        </div>
                      </div>
                      <div className="bg-background rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-500">
                          {transaction.details.results.rejected}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Rejected
                        </div>
                      </div>
                      <div className="bg-background rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold">
                          {transaction.details.results.threshold}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Threshold
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
