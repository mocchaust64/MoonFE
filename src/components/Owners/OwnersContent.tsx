"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Clipboard, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import { InviteGuardianModal } from "@/components/Guardian/InviteGuardianModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { Guardian } from "@/utils/guardianUtils";


export function OwnersContent() {
  const { guardians, isLoading, error, fetchInfo } = useWalletInfo();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchInfo();
    } catch (error) {
      console.error("Error refreshing guardians:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  if (isLoading) {
    return (
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Guardians</h1>
          <Skeleton className="h-10 w-28" />
        </div>
        <Card className="overflow-hidden">
          <div className="p-4 text-center text-sm text-gray-500">
            Loading guardians...
          </div>
        </Card>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="flex min-h-[200px] flex-col items-center justify-center space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-destructive">{error.message}</div>
        <Button onClick={() => fetchInfo()}>Retry Loading</Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-4"
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
        <h1 className="text-2xl font-bold">Guardians</h1>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="transition-transform hover:scale-105"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
          <Button
            onClick={() => setShowInviteModal(true)}
            className="transition-transform hover:scale-105"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Guardian
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="overflow-hidden">
          <div className="divide-border divide-y rounded-lg">
            <AnimatePresence>
              {guardians && guardians.length > 0 ? (
                guardians.map((guardian: Guardian, index) => (
                  <motion.div
                    key={guardian.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    exit={{ opacity: 0, y: -10 }}
                    whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.03)" }}
                    className="hover:bg-muted/50 flex items-center justify-between p-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500">
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center">
                          <span className="font-medium">
                            Guardian {guardian.id}
                          </span>
                        </div>
                        <div className="text-muted-foreground font-mono text-sm">
                          {guardian.address.substring(0, 8)}...
                          {guardian.address.substring(
                            guardian.address.length - 8,
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyAddress(guardian.address)}
                        className="transition-transform hover:scale-110"
                      >
                        <Clipboard className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  className="text-muted-foreground flex min-h-[120px] items-center justify-center p-4 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  No guardians found. Add your first guardian.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      <InviteGuardianModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
      />
    </motion.div>
  );
} 