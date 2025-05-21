"use client";

import { useState, useEffect } from "react";
import { ArrowDown, ArrowUp, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { TransferModal } from "@/components/Wallet/TransferModal";
import { toast } from "sonner";
import { getWalletByCredentialId } from "@/lib/firebase/webAuthnService";
import { connection } from "@/lib/solana";
import { TokenList } from './TokenList';
import { PublicKey } from '@solana/web3.js';
import Link from "next/link";

export function DashboardContent() {
  const { multisigPDA, balance, isLoading, error, fetchInfo, threshold, guardianCount } = useWalletInfo();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [guardianId, setGuardianId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  useEffect(() => {
    const loadCredentialInfo = async () => {
      const storedCredentialId = localStorage.getItem('current_credential_id');
      if (storedCredentialId) {
        setCredentialId(storedCredentialId);
        const guardianInfo = await getWalletByCredentialId(storedCredentialId);
        if (guardianInfo) {
          setGuardianId(guardianInfo.guardianId);
        } else {
          toast.error("Guardian info not found");
        }
      }
    };
    loadCredentialInfo();
  }, []); 

  const handleOpenTransferModal = () => {
    if (!credentialId) {
      toast.error("No credential found. Please set up a WebAuthn credential first.");
      return;
    }
    setShowTransferModal(true);
  };
  
  const handleCloseTransferModal = () => {
    setShowTransferModal(false);
  };
  
  const handleTransferSuccess = () => {
    toast.success("Transfer completed successfully!");
  };
  
  const handleTransferError = (error: Error) => {
    toast.error(`Transfer failed: ${error.message}`);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchInfo();
      toast.success("Wallet balance updated");
    } catch (error) {
      console.error("Error refreshing balance:", error);
      toast.error("Failed to update wallet balance");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-0">
          <h1 className="text-xl font-bold md:text-2xl">Dashboard</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex-1 md:flex-auto"
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Send
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled
              className="flex-1 md:flex-auto"
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Deposit
            </Button>
          </div>
        </div>
        <Card className="p-4">
          <div className="text-muted-foreground text-center">Loading...</div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-0">
          <h1 className="text-xl font-bold md:text-2xl">Dashboard</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex-1 md:flex-auto"
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Send
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled
              className="flex-1 md:flex-auto"
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Deposit
            </Button>
          </div>
        </div>
        <Card className="p-4">
          <div className="text-destructive text-center">{error.message}</div>
        </Card>
      </div>
    );
  }

  return (
    <>
      {showTransferModal && credentialId && guardianId !== null && (
        <TransferModal
          isOpen={showTransferModal}
          onClose={handleCloseTransferModal}
          credentialId={credentialId}
          guardianId={guardianId}
          connection={connection}
          walletBalance={balance}
          onTransferSuccess={handleTransferSuccess}
          onTransferError={handleTransferError}
        />
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-0">
          <h1 className="text-xl font-bold md:text-2xl">Dashboard</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 md:flex-auto"
              onClick={handleOpenTransferModal}
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Send
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 md:flex-auto"
              onClick={() => toast.success("Deposit feature will be available soon!")}
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Deposit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Left Column - Assets */}
          <Tabs defaultValue="assets" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="assets" className="flex-1">
                Assets
              </TabsTrigger>
              <TabsTrigger value="nft" className="flex-1">
                NFT
              </TabsTrigger>
            </TabsList>
            <TabsContent value="assets">
              <Card className="p-4">
                <div className="space-y-4">
                  
                  <div className="flex justify-between items-center pt-3">
                    <div className="text-muted-foreground text-sm">
                      Balance
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 rounded-full"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                    >
                      <RefreshCw 
                        className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} 
                      />
                    </Button>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div className="text-lg font-medium">
                      {balance.toFixed(4)}
                    </div>
                    <div className="text-muted-foreground">SOL</div>
                  </div>
                  
                  {multisigPDA && (
                    <div className="pt-4 mt-2 border-t">
                      <TokenList walletAddress={new PublicKey(multisigPDA)} />
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>
            <TabsContent value="nft">
              <Card className="p-8">
                <div className="text-center">
                  <p className="mb-2 text-lg font-medium">No NFTs Found</p>
                  <p className="text-muted-foreground text-sm">Your NFT collection will appear here</p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Right Column - Info Cards */}
          <div className="space-y-4">
            {/* Transactions Card */}
            <Link href="/transactions">
              <Card className="hover:bg-muted/50 p-4 transition-colors">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Transactions</h2>
                  <ChevronRight className="text-muted-foreground h-5 w-5" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span className="text-muted-foreground text-sm">Active</span>
                    <span className="text-lg font-medium">0</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                    <span className="text-muted-foreground text-sm">
                      Ready
                    </span>
                    <span className="text-lg font-medium">1</span>
                  </div>
                </div>
              </Card>
            </Link>

            {/* Info Card */}
            <Link href="/info">
              <Card className="hover:bg-muted/50 p-4 transition-colors">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Info</h2>
                  <ChevronRight className="text-muted-foreground h-5 w-5" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-blue-500">⚡</div>
                      <span className="text-muted-foreground text-sm">
                        Threshold
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {threshold}/{guardianCount || 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-amber-500">👥</div>
                      <span className="text-muted-foreground text-sm">
                        Owners
                      </span>
                    </div>
                    <span className="text-sm font-medium">{guardianCount || 1}</span>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
} 