"use client";

import { useState, useEffect } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { TransferModal } from "@/components/Wallet/TransferModal";
import { connection } from "@/lib/solana";
import { toast } from "sonner";
import { getWalletByCredentialId } from "@/lib/firebase/webAuthnService";


export function DashboardContent() {
  const { multisigPDA, balance, threshold, guardianCount, isLoading, error } = useWalletInfo();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [guardianId, setGuardianId] = useState<number | null>(null);
  
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
          <Button variant="default" size="sm" className="flex-1 md:flex-auto">
            <ArrowDown className="mr-2 h-4 w-4" />
            Deposit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground text-sm">
                    Địa chỉ ví
                  </div>
                  <div className="text-sm font-medium flex items-center">
                    {multisigPDA ? (
                      <>
                        <span className="mr-2">{multisigPDA.toString().slice(0, 6)}...{multisigPDA.toString().slice(-6)}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(multisigPDA.toString());
                            toast.success("Đã sao chép địa chỉ ví");
                          }}
                          className="text-xs px-2 py-0.5 bg-muted rounded hover:bg-muted/80"
                        >
                          Sao chép
                        </button>
                      </>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground text-sm">
                    Số dư ví
                  </div>
                  <div className="text-xl font-medium">
                    {balance.toFixed(4)} SOL
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
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
                    Ready for execution
                  </span>
                  <span className="text-lg font-medium">1</span>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/info">
            <Card className="hover:bg-muted/50 p-4 transition-colors">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Info</h2>
                <ChevronRight className="text-muted-foreground h-5 w-5" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-cyan-500">⚡</div>
                    <span className="text-muted-foreground text-sm">
                      Threshold
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {threshold}/{guardianCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-yellow-500">👥</div>
                    <span className="text-muted-foreground text-sm">
                      Owners
                    </span>
                  </div>
                  <span className="text-sm font-medium">{guardianCount}</span>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {multisigPDA && credentialId && guardianId !== null && (
        <TransferModal
          isOpen={showTransferModal}
          onClose={handleCloseTransferModal}
          walletAddress={multisigPDA}
          credentialId={credentialId}
          guardianId={guardianId}
          connection={connection}
          walletBalance={balance}
          onTransferSuccess={handleTransferSuccess}
          onTransferError={handleTransferError}
        />
      )}
    </div>
  );
} 