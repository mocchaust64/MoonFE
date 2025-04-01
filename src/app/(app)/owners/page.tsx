"use client";

import { PublicKey } from "@solana/web3.js";
import { Pencil, Clipboard, Plus, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";

import { InviteGuardianModal } from "@/components/Wallet/InviteGuardianModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletStore } from "@/store/walletStore";

export default function OwnersPage() {
  const { multisigAddress, guardianPDA, guardians, fetchGuardians } =
    useWalletStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if store is hydrated
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Fetch guardians when component mounts
  useEffect(() => {
    const loadGuardians = async () => {
      if (!isHydrated) return;

      setIsLoading(true);
      setError("");

      try {
        console.log("=== Đang tải danh sách guardians ===");
        console.log("Current multisigAddress:", multisigAddress?.toString());
        console.log("Current guardianPDA:", guardianPDA?.toString());

        if (!multisigAddress) {
          setError("Chưa có ví được tạo");
          setIsLoading(false);
          return;
        }

        // Check if multisigAddress is a PublicKey
        if (!(multisigAddress instanceof PublicKey)) {
          console.log("Converting multisigAddress from string to PublicKey");
          // Conversion will happen in fetchGuardians function
        }

        // Fetch guardians from blockchain
        console.log("Calling fetchGuardians()...");
        await fetchGuardians();
        console.log(`Loaded ${guardians.length} guardians`);
      } catch (error) {
        console.error("Error fetching guardians:", error);
        setError(
          `Không thể tải thông tin guardians: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadGuardians();
  }, [
    multisigAddress,
    guardianPDA,
    isHydrated,
    fetchGuardians,
    guardians.length,
  ]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log("Manual refresh: Fetching guardians...");
      await fetchGuardians();
      console.log(`After refresh: Loaded ${guardians.length} guardians`);
    } catch (error) {
      console.error("Error refreshing guardians:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Guardians</h1>
          <Skeleton className="h-10 w-28" />
        </div>
        <Card className="overflow-hidden">
          <div className="divide-border divide-y rounded-lg">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Guardians</h1>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
          <Button onClick={() => setShowInviteModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Owner
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="divide-border divide-y rounded-lg">
          {guardians.length > 0 ? (
            guardians.map((guardian) => (
              <div
                key={guardian.id}
                className="hover:bg-muted/50 flex items-center justify-between p-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      className={`bg-gradient-to-br ${guardian.isOwner ? "from-amber-400 to-orange-500" : "from-cyan-400 to-blue-500"}`}
                    >
                      {guardian.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center">
                      <span className="font-medium">{guardian.name}</span>
                      {guardian.isOwner && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                          Owner
                        </span>
                      )}
                      {!guardian.isActive && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground font-mono text-sm">
                      {guardian.address.substring(0, 8)}...
                      {guardian.address.substring(guardian.address.length - 8)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyAddress(guardian.address)}
                  >
                    <Clipboard className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground flex min-h-[120px] items-center justify-center p-4 text-center">
              No guardians found. Add your first guardian.
            </div>
          )}
        </div>
      </Card>

      <InviteGuardianModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
      />
    </div>
  );
}
