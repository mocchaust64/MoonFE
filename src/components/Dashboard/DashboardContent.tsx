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
import { useRouter } from "next/navigation";
import { TokenList } from './TokenList';
import { PublicKey } from '@solana/web3.js';

export function DashboardContent() {
  const { multisigPDA, balance, isLoading, error, fetchInfo } = useWalletInfo();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [guardianId, setGuardianId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  
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

  const handleCopyAddress = () => {
    if (multisigPDA) {
      navigator.clipboard.writeText(multisigPDA.toString());
      toast.success("Address copied to clipboard");
    }
  };

  const handleDepositClick = () => {
    toast.success("Deposit feature will be available soon!");
  };

  const handleViewAllTransactions = () => {
    router.push('/transactions');
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
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <div className="mt-4 text-gray-500">
            Loading wallet data...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="p-6 max-w-md">
          <div className="flex flex-col items-center mb-4">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-1">Connection Error</h3>
            <div className="text-red-500 text-center text-sm">
              {error.message}
            </div>
          </div>
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={fetchInfo}
              className="hover:bg-gray-100 transition-all duration-200 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                <path d="M21 3v5h-5"></path>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                <path d="M8 16H3v5"></path>
              </svg>
              Try Again
            </Button>
          </div>
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

      <div className="flex items-center justify-between mb-6 flex-col sm:flex-row gap-4 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none"
            onClick={handleOpenTransferModal}
          >
            <ArrowUp className="mr-2 h-4 w-4" />
            Send
          </Button>
          <Button
            className="bg-blue-500 hover:bg-blue-600 text-white flex-1 sm:flex-none"
            onClick={handleDepositClick}
          >
            <ArrowDown className="mr-2 h-4 w-4" />
            Deposit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        {/* Left Column - Wallet Info */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="assets" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger 
                value="assets" 
                className="flex-1"
              >
                Assets
              </TabsTrigger>
              <TabsTrigger 
                value="nft" 
                className="flex-1"
              >
                NFT
              </TabsTrigger>
            </TabsList>
            <TabsContent value="assets">
              <Card className="p-6 space-y-6">
                <div className="flex flex-col space-y-1">
                  <div className="text-gray-500 text-sm font-medium">
                    Wallet Address
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center bg-gray-100 rounded-lg px-3 sm:px-4 py-2 w-full justify-between">
                      {multisigPDA ? (
                        <>
                          <div className="text-xs sm:text-sm font-mono truncate pr-2">
                            {`${multisigPDA.toString().substring(0, 6)}...${multisigPDA.toString().substring(multisigPDA.toString().length - 6)}`}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-md hover:bg-gray-200 ml-1 sm:ml-2 px-2 sm:px-3"
                            onClick={handleCopyAddress}
                          >
                            <span className="text-xs text-blue-500 font-medium">Copy</span>
                          </Button>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400">Not available</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-gray-500 text-sm font-medium flex justify-between items-center">
                    <span>Balance</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 rounded-full hover:bg-gray-100"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                    >
                      <RefreshCw 
                        className={`h-3.5 w-3.5 text-gray-400 hover:text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`} 
                      />
                    </Button>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div className="text-4xl sm:text-5xl font-bold text-gray-900">
                      {balance ? balance.toLocaleString(undefined, {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4
                      }) : '0.0000'}
                    </div>
                    <div className="text-base sm:text-lg text-gray-500">SOL</div>
                  </div>
                </div>
                
                {multisigPDA && (
                  <div className="pt-4 mt-2 border-t border-gray-200">
                    <TokenList walletAddress={new PublicKey(multisigPDA)} />
                  </div>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="nft">
              <Card className="p-8 flex flex-col items-center justify-center min-h-[240px]">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                    <path d="M7 2h10"></path>
                    <path d="M5 6h14"></path>
                    <rect width="18" height="12" x="3" y="10" rx="2"></rect>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="mb-2 text-lg font-medium">No NFTs Found</p>
                  <p className="text-gray-500 text-sm">Your NFT collection will appear here</p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Transactions and Info */}
        <div className="flex flex-col space-y-6">
          {/* Transactions Section */}
          <Card className="hover:bg-gray-50 transition-all duration-300">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium">
                Transactions
              </h3>
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0 rounded-full hover:bg-gray-100" 
                  onClick={handleViewAllTransactions}
                >
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                      <div className="text-xs text-gray-500">Active</div>
                    </div>
                    <div className="text-lg font-bold">0</div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                      <div className="text-xs text-gray-500">Ready</div>
                    </div>
                    <div className="text-lg font-bold">1</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Info Section */}
          <Card className="hover:bg-gray-50 transition-all duration-300">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium">
                Info
              </h3>
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                  onClick={() => router.push('/info')}
                >
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center">
                  <div className="mr-3 text-blue-500">⚡</div>
                  <div className="text-sm">Threshold</div>
                </div>
                <div className="text-sm font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  1/1
                </div>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center">
                  <div className="mr-3 text-amber-500">👥</div>
                  <div className="text-sm">Owners</div>
                </div>
                <div className="text-sm font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                  1
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
} 