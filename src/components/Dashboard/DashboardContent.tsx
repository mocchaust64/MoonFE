"use client";

import { useState, useEffect } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-zinc-800 flex items-center justify-center relative overflow-hidden">
            <div className="absolute h-full w-full animate-pulse bg-gradient-to-r from-blue-500/20 via-blue-600/20 to-indigo-600/20"></div>
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
          </div>
          <div className="mt-4 text-center text-sm text-gray-400">
            Loading wallet data...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="bg-zinc-900/20 border-zinc-800/60 p-6 max-w-md backdrop-blur-sm shadow-xl">
          <div className="flex flex-col items-center mb-4">
            <div className="h-16 w-16 rounded-full bg-red-900/20 flex items-center justify-center text-red-400 mb-4 border border-red-900/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">Connection Error</h3>
            <div className="text-red-400 text-center text-sm">
              {error.message}
            </div>
          </div>
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={fetchInfo}
              className="bg-zinc-900/80 border-zinc-800/80 hover:bg-zinc-800/80 text-white transition-all duration-200 flex items-center gap-2"
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
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">Dashboard</h1>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="bg-zinc-900/60 backdrop-blur-md border-zinc-800/60 hover:bg-zinc-800/80 text-white transition-all duration-300 shadow-lg hover:shadow-blue-500/20 flex-1 sm:flex-none"
            onClick={handleOpenTransferModal}
          >
            <ArrowUp className="mr-2 h-4 w-4 text-blue-400" />
            Send
          </Button>
          <Button
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 transition-all duration-300 shadow-lg hover:shadow-blue-500/40 flex-1 sm:flex-none"
            onClick={handleDepositClick}
          >
            <ArrowDown className="mr-2 h-4 w-4" />
            Deposit
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        {/* Left Column - Wallet Info */}
        <div className="w-full lg:w-2/3">
          <Tabs defaultValue="assets" className="w-full">
            <TabsList className="w-full bg-transparent border-b border-zinc-800/40 rounded-t-md h-12 p-1 shadow-sm">
              <TabsTrigger 
                value="assets" 
                className="flex-1 rounded-md data-[state=active]:bg-blue-500/10 text-gray-400 h-10 transition-all duration-200 font-medium border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 hover:text-white data-[state=active]:shadow-[0_0_10px_rgba(59,130,246,0.2)]"
              >
                Assets
              </TabsTrigger>
              <TabsTrigger 
                value="nft" 
                className="flex-1 rounded-md data-[state=active]:bg-blue-500/10 text-gray-400 h-10 transition-all duration-200 font-medium border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 hover:text-white data-[state=active]:shadow-[0_0_10px_rgba(59,130,246,0.2)]"
              >
                NFT
              </TabsTrigger>
            </TabsList>
            <TabsContent value="assets">
              <Card className="bg-zinc-900/20 border-zinc-800/60 rounded-b-md shadow-xl backdrop-blur-sm">
                <div className="p-6 space-y-6">
                  <div className="flex flex-col space-y-1">
                    <div className="text-gray-400 text-sm font-medium">
                      Wallet Address
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center bg-zinc-900/60 rounded-lg px-3 sm:px-4 py-2 border border-zinc-800/60 w-full justify-between shadow-inner">
                        {multisigPDA ? (
                          <>
                            <div className="text-xs sm:text-sm text-blue-100 font-mono truncate pr-2">
                              {`EXDTV ... ZPVMbj`}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 rounded-md hover:bg-zinc-800 ml-1 sm:ml-2 px-2 sm:px-3 transition-all duration-200 hover:text-blue-400"
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
                    <div className="text-gray-400 text-sm font-medium">
                      Balance
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                        {balance ? balance.toLocaleString(undefined, {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4
                        }) : '0.0000'}
                      </div>
                      <div className="text-base sm:text-lg text-gray-400">SOL</div>
                    </div>
                  </div>
                  
                  {multisigPDA && (
                    <div className="pt-4 mt-2 border-t border-zinc-800/40">
                      <h3 className="text-sm font-medium text-gray-400 mb-3">Token Balances</h3>
                      <TokenList walletAddress={new PublicKey(multisigPDA)} />
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>
            <TabsContent value="nft">
              <Card className="bg-zinc-900/20 border-zinc-800/60 rounded-b-md shadow-xl backdrop-blur-sm">
                <div className="p-8 flex flex-col items-center justify-center min-h-[240px]">
                  <div className="w-16 h-16 rounded-full bg-zinc-800/60 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                      <path d="M7 2h10"></path>
                      <path d="M5 6h14"></path>
                      <rect width="18" height="12" x="3" y="10" rx="2"></rect>
                    </svg>
                  </div>
                  <div className="text-gray-300 text-center">
                    <p className="mb-2 text-lg font-medium">No NFTs Found</p>
                    <p className="text-gray-400 text-sm">Your NFT collection will appear here</p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Transactions and Info */}
        <div className="w-full lg:w-1/3 flex flex-col space-y-6">
          {/* Transactions Section */}
          <Card className="bg-zinc-900/20 border-zinc-800/60 rounded-md overflow-hidden shadow-xl backdrop-blur-sm hover:shadow-blue-900/10 transition-all duration-300">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/60">
              <h3 className="text-white font-medium flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                Transactions
              </h3>
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0 rounded-full hover:bg-zinc-800/60 transition-all duration-200" 
                  onClick={handleViewAllTransactions}
                >
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/60 rounded-lg p-3 border border-zinc-800/60 shadow-inner transition-all duration-300 hover:border-blue-900/40 hover:shadow-blue-900/10">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                      <div className="text-xs text-gray-400">Active</div>
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-white">0</div>
                  </div>
                </div>
                <div className="bg-zinc-900/60 rounded-lg p-3 border border-zinc-800/60 shadow-inner transition-all duration-300 hover:border-yellow-900/40 hover:shadow-yellow-900/10">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                      <div className="text-xs text-gray-400">Ready</div>
                    </div>
                    <div className="text-xl font-bold text-white">1</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Info Section */}
          <Card className="bg-zinc-900/20 border-zinc-800/60 rounded-md overflow-hidden shadow-xl backdrop-blur-sm hover:shadow-blue-900/10 transition-all duration-300">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/60">
              <h3 className="text-white font-medium flex items-center">
                <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
                Info
              </h3>
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0 rounded-full hover:bg-zinc-800/60 transition-all duration-200"
                  onClick={() => router.push('/info')}
                >
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between bg-zinc-900/60 rounded-lg p-3 border border-zinc-800/60 shadow-inner transition-all duration-300 hover:border-blue-900/40 hover:shadow-blue-900/10">
                <div className="flex items-center">
                  <div className="mr-2 sm:mr-3 p-1.5 sm:p-2 bg-blue-900/40 rounded-md">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                  </div>
                  <div className="text-xs sm:text-sm text-white">Threshold</div>
                </div>
                <div className="text-xs sm:text-sm font-medium bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">
                  1/1
                </div>
              </div>
              <div className="flex items-center justify-between bg-zinc-900/60 rounded-lg p-3 border border-zinc-800/60 shadow-inner transition-all duration-300 hover:border-amber-900/40 hover:shadow-amber-900/10">
                <div className="flex items-center">
                  <div className="mr-2 sm:mr-3 p-1.5 sm:p-2 bg-amber-900/40 rounded-md">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <div className="text-xs sm:text-sm text-white">Owners</div>
                </div>
                <div className="text-xs sm:text-sm font-medium bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded">
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