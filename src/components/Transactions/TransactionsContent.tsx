"use client";

import { Timestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, UserPlus } from "lucide-react";
import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { GuardianConfirm } from "@/components/Guardian/GuardianConfirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getPendingInvites,
  getGuardianData,
  getInvitation,
} from "@/lib/firebase/guardianService";
import { cn } from "@/lib/utils";
import { GuardianData } from "@/types/guardian";
import { useWalletInfo } from "@/hooks/useWalletInfo";

interface Transaction {
  id: string;
  type: string;
  icon: React.ReactNode;
  status: string;
  statusColor: string;
  details: {
    author: string;
    createdOn: string;
    executedOn: string;
    results: {
      confirmed: number;
      rejected: number;
      threshold: string;
    };
  };
  guardianData?: GuardianData;
  isPendingGuardian?: boolean;
}

export function TransactionsContent() {
  const { threshold, guardianCount, multisigPDA } = useWalletInfo();
  const [expandedTransactions, setExpandedTransactions] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianData | null>(
    null,
  );
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  const toggleTransaction = (id: string) => {
    setExpandedTransactions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const loadPendingGuardians = useCallback(async () => {
    if (!multisigPDA) {
      console.log("No multisig address found");
      setAllTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const pendingInvites = await getPendingInvites(multisigPDA.toString());

      if (!pendingInvites || pendingInvites.length === 0) {
        setAllTransactions([]);
        setIsLoading(false);
        return;
      }

      const guardianTransactions = await Promise.all(
        pendingInvites.map(async (inviteCode) => {
          const guardianData = await getGuardianData(inviteCode);
          const inviteData = await getInvitation(inviteCode);

          if (!guardianData || !inviteData) return null;

          return {
            id: inviteCode,
            type: "Add Guardian",
            icon: <UserPlus className="h-5 w-5 text-purple-500" />,
            status: "Ready for execution",
            statusColor: "text-yellow-500",
            details: {
              author: ` ${guardianData.guardianId}`,
              createdOn:
                guardianData.createdAt instanceof Timestamp
                  ? guardianData.createdAt.toDate().toLocaleString()
                  : new Date(guardianData.createdAt).toLocaleString(),
              executedOn: ` ${inviteCode}`,
              results: {
                confirmed: 0,
                rejected: 0,
                threshold: `${threshold}/${guardianCount}`,
              },
            },
            guardianData,
            isPendingGuardian: true,
          };
        }),
      );

      const validTransactions = guardianTransactions.filter(
        (tx): tx is NonNullable<typeof tx> => tx !== null,
      );
      setAllTransactions(validTransactions);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setIsLoading(false);
    }
  }, [multisigPDA, threshold, guardianCount]);

  useEffect(() => {
    loadPendingGuardians();
  }, [loadPendingGuardians]);

  const handleConfirmGuardian = (guardian: GuardianData) => {
    setSelectedGuardian(guardian);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSuccess = () => {
    toast.success("Guardian confirmed successfully");
    loadPendingGuardians();
    setIsConfirmModalOpen(false);
    setSelectedGuardian(null);
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex items-center justify-between"
        initial={{ y: -10 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold">Transactions</h1>
        <Button
          onClick={loadPendingGuardians}
          disabled={isLoading}
          className="transition-transform hover:scale-105"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
      </motion.div>

      {/* All Transactions Section */}
      <motion.div
        className="mt-8 space-y-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="text-muted-foreground text-sm">All Transactions</div>

        {isLoading && (
          <Card className="p-6">
            <div className="flex flex-col items-center justify-center space-y-2 py-8 text-center">
              <div className="text-muted-foreground">
                Loading transactions...
              </div>
            </div>
          </Card>
        )}

        {!isLoading && allTransactions.length === 0 && (
          <Card className="p-6">
            <div className="flex flex-col items-center justify-center space-y-2 py-8 text-center">
              <UserPlus className="text-muted-foreground/50 h-12 w-12" />
              <h3 className="text-lg font-medium">No transactions found</h3>
              <p className="text-muted-foreground">
                When you add guardians or make transfers, they will appear here.
              </p>
            </div>
          </Card>
        )}

        <AnimatePresence>
          {allTransactions.map((transaction, index) => (
            <motion.div
              key={transaction.id}
              className="transition-all duration-200"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.01 }}
            >
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
                      <div className="font-medium">Add Guardian</div>
                      <div className="text-muted-foreground text-sm">
                        New owner
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className={`text-sm ${transaction.statusColor}`}>
                        Ready for execution
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Status
                      </div>
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
                      className="transition-transform hover:scale-110"
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

              <AnimatePresence>
                {expandedTransactions[transaction.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="bg-muted/50 rounded-t-none border-t-0 p-6">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Info</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Guardian ID
                              </span>
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
                                Invite Code
                              </span>
                              <span>{transaction.details.executedOn}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Results</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <motion.div
                              className="bg-background rounded-lg p-4 text-center"
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="text-2xl font-bold text-green-500">
                                {transaction.details.results.confirmed}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                Confirmed
                              </div>
                            </motion.div>
                            <motion.div
                              className="bg-background rounded-lg p-4 text-center"
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="text-2xl font-bold text-red-500">
                                {transaction.details.results.rejected}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                Rejected
                              </div>
                            </motion.div>
                            <motion.div
                              className="bg-background rounded-lg p-4 text-center"
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="text-2xl font-bold">
                                {transaction.details.results.threshold}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                Threshold
                              </div>
                            </motion.div>
                          </div>

                          {transaction.isPendingGuardian && (
                            <div className="mt-4 flex justify-end">
                              <Button
                                onClick={() =>
                                  handleConfirmGuardian(
                                    transaction.guardianData!,
                                  )
                                }
                                className="transition-transform hover:scale-105"
                              >
                                Confirm
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Guardian Confirm Modal */}
      {isConfirmModalOpen && selectedGuardian && (
        <GuardianConfirm
          isOpen={isConfirmModalOpen}
          onClose={() => {
            setIsConfirmModalOpen(false);
            setSelectedGuardian(null);
          }}
          onConfirm={handleConfirmSuccess}
          guardian={selectedGuardian}
        />
      )}
    </motion.div>
  );
} 