import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalTitle, 
  ModalDescription,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, AlertCircle, CircleDollarSign } from "lucide-react";
import { LAMPORTS_PER_SOL, PublicKey, Connection, Keypair } from '@solana/web3.js';
import { getWebAuthnAssertion } from '@/utils/webauthnUtils';
import { getGuardianPDA } from '@/utils/credentialUtils';
import { getWalletByCredentialId } from '@/lib/firebase/webAuthnService';
import { Buffer } from 'buffer';
import BN from 'bn.js';
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { createProposal as saveProposalToFirebase } from '@/lib/firebase/proposalService';
import { createSolTransferProposal, createTokenTransferProposal } from '@/utils/transferUtils';
import { getTokenAccounts } from '@/utils/tokenListUtils';
import { convertToTokenAmount } from '@/utils/tokenUtils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentialId: string;
  guardianId: number;
  connection: Connection;
  walletBalance: number;
  onTransferSuccess?: () => void;
  onTransferError?: (error: Error) => void;
}

interface AssetOption {
  type: 'sol' | 'token';
  symbol: string;
  balance: number;
  decimals: number;
  mint?: string;
}

export function TransferModal({ 
  isOpen, 
  onClose,
  credentialId,
  guardianId,
  connection,
  walletBalance,
  onTransferSuccess,
  onTransferError
}: Readonly<TransferModalProps>) {
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { multisigPDA, threshold } = useWalletInfo();
  const proposalIdTimestamp = useRef<number>(0);

  // State for token list and selected token
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>('sol');

  // Load token list when modal opens
  useEffect(() => {
    if (isOpen && multisigPDA) {
      loadTokens();
      // Set timestamp for proposal ID when modal opens
      proposalIdTimestamp.current = Date.now();
    }
  }, [isOpen, multisigPDA]);

  // Function to load tokens
  const loadTokens = async () => {
    try {
      if (!multisigPDA) {
        throw new Error('Wallet address not found');
      }
      const multisigPublicKey = new PublicKey(multisigPDA);
      const tokens = await getTokenAccounts(connection, multisigPublicKey);
      
      const assetOptions: AssetOption[] = [
        {
          type: 'sol',
          symbol: 'SOL',
          balance: walletBalance,
          decimals: 9
        },
        ...tokens.map(token => ({
          type: 'token' as const,
          symbol: token.symbol || token.mint.slice(0, 4),
          balance: token.balance,
          decimals: token.decimals,
          mint: token.mint
        }))
      ];
      
      setAssets(assetOptions);
    } catch (error) {
      console.error('Error loading tokens:', error);
      setError('Unable to load token list');
    }
  };

  const handleAssetChange = (value: string) => {
    setSelectedAsset(value);
    setAmount('');
    setError(null);
  };

  const getSelectedAssetInfo = (): AssetOption | undefined => {
    return assets.find(asset => 
      asset.type === 'sol' ? selectedAsset === 'sol' : asset.mint === selectedAsset
    );
  };

  const validateAmount = (value: string, assetInfo?: AssetOption) => {
    if (!value || !assetInfo) return false;
    const numValue = parseFloat(value);
    
    // Basic check: positive number and less than or equal to balance
    if (numValue <= 0 || numValue > assetInfo.balance) {
      return false;
    }
    
    // Additional check for valid decimal places
    if (assetInfo.type === 'token') {
      // Decimal places must not exceed token decimals
      const parts = value.split('.');
      if (parts.length > 1 && parts[1].length > assetInfo.decimals) {
        return false;
      }
    }
    
    return true;
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setError(null);
    
    const assetInfo = getSelectedAssetInfo();
    if (!assetInfo) return;
    
    const numValue = parseFloat(value);
    
    if (isNaN(numValue) || numValue <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    
    if (numValue > assetInfo.balance) {
      setError(`Amount exceeds current balance: ${assetInfo.balance} ${assetInfo.symbol}`);
      return;
    }
    
    if (assetInfo.type === 'token') {
      // Check decimal precision
      const parts = value.split('.');
      if (parts.length > 1 && parts[1].length > assetInfo.decimals) {
        setError(`${assetInfo.symbol} supports maximum ${assetInfo.decimals} decimal places`);
        return;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate inputs
      if (!destinationAddress || !amount || !multisigPDA || !credentialId || !description) {
        throw new Error('Please fill in all required fields');
      }

      // Validate destination address
      try {
        new PublicKey(destinationAddress);
      } catch (err) {
        throw new Error(`Invalid wallet address: ${err instanceof Error ? err.message : 'Invalid public key'}`);
      }

      const destinationPublicKey = new PublicKey(destinationAddress);
      const multisigPublicKey = new PublicKey(multisigPDA);
      const guardianPDA = getGuardianPDA(multisigPublicKey, guardianId);
      // Sử dụng giá trị timestamp đã được lưu trong useRef
      const proposalId = new BN(proposalIdTimestamp.current);
  
      // Get WebAuthn public key
      const webAuthnPubKey = await getWebAuthnPublicKey(credentialId);
      if (!webAuthnPubKey) {
        throw new Error('Unable to retrieve WebAuthn authentication information');
      }

      // Get selected asset info
      const assetInfo = getSelectedAssetInfo();
      if (!assetInfo) {
        throw new Error('Asset information not found');
      }

      // Validate amount
      if (!validateAmount(amount, assetInfo)) {
        throw new Error(`Invalid amount. Current balance: ${assetInfo.balance} ${assetInfo.symbol}`);
      }

      // Create message and get assertion
      const messageString = assetInfo.type === 'sol'
        ? `create:proposal_transfer_${amount}_SOL_to_${destinationAddress}`
        : `create:proposal_token_transfer_${amount}_${assetInfo.symbol}_to_${destinationAddress}`;
    
      const assertion = await getWebAuthnAssertion(credentialId, messageString, true);
      if (!assertion) {
        throw new Error('Unable to get WebAuthn signature');
      }

      // Create fee payer
      const feePayerSecretKeyStr = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY ?? '';
      const feePayerSecretKey = feePayerSecretKeyStr.split(',').map(s => parseInt(s.trim()));
      const feePayerKeypair = Keypair.fromSecretKey(new Uint8Array(feePayerSecretKey));
    
      if (assetInfo.type === 'sol') {
        // Transfer SOL
        const amountLamports = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);
        const tx = await createSolTransferProposal({
          multisigPubkey: multisigPublicKey,
          payerPublicKey: feePayerKeypair.publicKey,
          guardianPubkey: guardianPDA,
          guardianId,
          destinationPubkey: destinationPublicKey,
          amountLamports,
          description,
          proposalId,
          webauthnSignature: assertion.signature,
          authenticatorData: assertion.authenticatorData,
          clientDataJSON: assertion.clientDataJSON,
          webAuthnPubKey
        });
    
        // Set up and send transaction
        tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
        tx.feePayer = feePayerKeypair.publicKey;
        tx.sign(feePayerKeypair);
    
        const txId = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
          preflightCommitment: 'confirmed'
        });
        console.log('Transaction sent:', txId);

        // Wait for transaction confirmation
        const confirmation = await connection.confirmTransaction({
          signature: txId,
          blockhash: tx.recentBlockhash,
          lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
        });
        
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

      } else {
        // Transfer Token
        const tokenMintPubkey = new PublicKey(assetInfo.mint!);
        console.log('Token Mint:', assetInfo.mint);
        console.log('Token Amount:', amount);
        console.log('Token Decimals:', assetInfo.decimals);
        
        const tokenAmount = convertToTokenAmount(parseFloat(amount), assetInfo.decimals);
        console.log('Raw Token Amount:', tokenAmount.toString());

        try {
          // Create token transfer proposal
          const tx = await createTokenTransferProposal({
            multisigPubkey: multisigPublicKey,
            payerPublicKey: feePayerKeypair.publicKey,
            guardianPubkey: guardianPDA,
            guardianId,
            destinationPubkey: destinationPublicKey,
            tokenMintPubkey,
            tokenAmount,
            description,
            proposalId,
            webauthnSignature: assertion.signature,
            authenticatorData: assertion.authenticatorData,
            clientDataJSON: assertion.clientDataJSON,
            webAuthnPubKey
          });

          // Set up and send transaction
          tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
          tx.feePayer = feePayerKeypair.publicKey;
          tx.sign(feePayerKeypair);

          const txId = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
            preflightCommitment: 'confirmed'
          });
          console.log('Transaction sent:', txId);

          // Wait for transaction confirmation
          const confirmation = await connection.confirmTransaction({
            signature: txId,
            blockhash: tx.recentBlockhash,
            lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
          });
          
          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
          }

        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Error creating token transfer proposal: ${error.message}`);
          }
          throw error;
        }
      }

      // Save proposal to Firebase after transaction is confirmed
      await saveProposalToFirebase({
        proposalId: proposalId.toNumber(),
        multisigAddress: multisigPDA,
        description,
        action: assetInfo.type === 'sol' ? 'transfer' : 'transfer_token',
        status: 'pending',
        creator: guardianPDA.toString(),
        signers: [],
        requiredSignatures: threshold ?? 2,
        destination: destinationPublicKey.toString(),
        amount: parseFloat(amount),
        tokenMint: assetInfo.type === 'token' ? assetInfo.mint : null,
        params: assetInfo.type === 'token' ? {
          token_mint: assetInfo.mint,
          token_amount: parseFloat(amount),
          destination: destinationPublicKey.toString()
        } : {
          amount: parseFloat(amount) * LAMPORTS_PER_SOL,
          destination: destinationPublicKey.toString()
        }
      });

      onTransferSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      
      // Handle specific error types
      let errorMessage = 'An unknown error occurred';
      
      if (err instanceof Error) {
        // Categorize errors by group for clearer messaging
        
        // Group 1: Account-related errors
        if (err.message.includes('TokenOwnerOffCurveError')) {
          errorMessage = 'Cannot create token account for multisig wallet. Please contact admin.';
        }
        // Token account errors
        else if (err.message.includes('Token account not found') || err.message.includes('initialize')) {
          errorMessage = 'Wallet does not have a token account. Need to deposit tokens before transaction.';
        }
        // Not an Associated Token Account error
        else if (err.message.includes('not an Associated Token Account')) {
          errorMessage = 'Invalid token account. Please use an Associated Token Account.';
        }
        
        // Group 2: Balance-related errors
        else if (err.message.includes('insufficient funds') || err.message.includes('balance')) {
          errorMessage = 'Insufficient token balance to complete transaction.';
        }
        
        // Group 3: Input data errors
        else if (err.message.includes('address') || err.message.includes('PublicKey')) {
          errorMessage = 'Invalid wallet address. Please check again.';
        }
        else if (err.message.includes('token mint') || err.message.includes('tokenMint')) {
          errorMessage = 'Invalid token mint. Please select a different token.';
        }
        else if (err.message.includes('amount')) {
          errorMessage = 'Invalid amount. Please check again.';
        }
        
        // Group 4: Authentication errors
        else if (err.message.includes('WebAuthn')) {
          errorMessage = 'WebAuthn authentication error. Please try again.';
        }
        
        // Group 5: Transaction creation or sending errors
        else if (err.message.includes('Transaction failed') || err.message.includes('rejected')) {
          errorMessage = 'Transaction rejected by blockchain. Please try again later.';
        }
        else if (err.message.includes('timeout') || err.message.includes('timed out')) {
          errorMessage = 'Transaction timed out. Network may be slow, please try again later.';
        }
        // Other errors
        else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      onTransferError?.(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get WebAuthn public key
  const getWebAuthnPublicKey = async (credentialId: string): Promise<Buffer> => {
    const credentialMapping = await getWalletByCredentialId(credentialId);
    if (credentialMapping?.guardianPublicKey?.length) {
      return Buffer.from(new Uint8Array(credentialMapping.guardianPublicKey));
    }
    throw new Error('WebAuthn public key not found');
  };

  // Format balance with 4 decimal places
  const formatBalance = (balance: number): string => {
    return balance.toLocaleString(undefined, { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
  };

  // Truncate address for display
  const truncateAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get asset color based on symbol
  const getAssetColor = (symbol: string): string => {
    const colorMap: Record<string, string> = {
      'SOL': 'bg-purple-500',
      'USDC': 'bg-blue-500',
      'BTC': 'bg-orange-500',
      'ETH': 'bg-indigo-500',
    };
    
    return colorMap[symbol] || 'bg-green-500';
  };

  const hasValidInputs = () => {
    const assetInfo = getSelectedAssetInfo();
    return (
      !!destinationAddress && 
      validateAmount(amount, assetInfo) && 
      !!description
    );
  };

  return (
    <Modal open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <ModalContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <ModalHeader className="border-b pb-4 bg-gradient-to-r from-primary/10 to-transparent flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-full bg-primary/10">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <ModalTitle className="text-xl sm:text-2xl font-bold">Create Transfer Proposal</ModalTitle>
              <ModalDescription className="text-sm text-muted-foreground mt-1 max-w-lg">
                Request approval to transfer assets from your multisig wallet. This will require {threshold} 
                {threshold && threshold > 1 ? ' signatures' : ' signature'} before execution.
              </ModalDescription>
            </div>
          </div>
        </ModalHeader>
      
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
            {/* Asset Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-medium flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                  <span>Select Asset</span>
                </h3>
                
                {getSelectedAssetInfo() && (
                  <Badge variant="outline" className="font-normal">
                    Balance: {formatBalance(getSelectedAssetInfo()!.balance)} {getSelectedAssetInfo()!.symbol}
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assets.length === 0 ? (
                  <Card className="border border-dashed bg-muted/40 col-span-full">
                    <CardContent className="flex items-center justify-center p-4">
                      <div className="text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Loading your assets...</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  assets.map((asset) => (
                    <Card 
                      key={asset.type === 'sol' ? 'sol' : asset.mint}
                      className={cn(
                        "relative overflow-hidden transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-sm",
                        selectedAsset === (asset.type === 'sol' ? 'sol' : asset.mint) 
                          ? "border-primary/70 shadow-sm bg-primary/5" 
                          : "border bg-card"
                      )}
                      onClick={() => handleAssetChange(asset.type === 'sol' ? 'sol' : asset.mint!)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <Avatar className={cn("h-8 w-8", getAssetColor(asset.symbol))}>
                          <AvatarFallback className="text-white font-medium">
                            {asset.symbol.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                          <div className="font-medium flex items-center gap-1">
                            {asset.symbol}
                            {asset.type === 'token' && (
                              <Badge variant="outline" className="text-xs font-normal py-0">token</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatBalance(asset.balance)} available
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Transfer Details */}
            <div className="space-y-4 pt-2">
              <h3 className="text-base font-medium flex items-center gap-2 mb-3">
                <Send className="h-4 w-4 text-primary" />
                <span>Transfer Details</span>
              </h3>

              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="destination" className="text-sm font-medium">Recipient Address</Label>
                    {destinationAddress && (
                      <Badge variant="outline" className="text-xs">
                        {truncateAddress(destinationAddress)}
                      </Badge>
                    )}
                  </div>
                  <Input
                    id="destination"
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    placeholder="Enter Solana wallet address"
                    className="font-mono text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="amount" className="text-sm font-medium">Amount</Label>
                    {getSelectedAssetInfo() && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => handleAmountChange(getSelectedAssetInfo()!.balance.toString())}
                      >
                        Use Max
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0.00"
                      step="any"
                      min="0"
                      className="pr-16"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-muted px-2 py-0.5 rounded text-xs font-medium">
                      {getSelectedAssetInfo()?.symbol || 'SOL'}
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-center gap-1.5 text-destructive mt-1.5">
                      <AlertCircle className="h-4 w-4" />
                      <p className="text-xs">{error}</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter a description for this transaction"
                  />
                  <p className="text-xs text-muted-foreground">
                    A clear description helps other signers understand the purpose of this transaction
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction Summary - Chỉ hiển thị trên màn hình lớn */}
            {hasValidInputs() && getSelectedAssetInfo() && (
              <div className="pt-2 hidden md:block">
                <Card className="border bg-muted/30">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-medium flex justify-between items-center">
                      <span>Transaction Summary</span>
                      <Badge variant="outline">Pending Approval</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 text-sm space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-muted-foreground">Asset</span>
                      <div className="flex items-center gap-2">
                        <Avatar className={cn("h-5 w-5", getAssetColor(getSelectedAssetInfo()!.symbol))}>
                          <AvatarFallback className="text-white text-xs font-medium">
                            {getSelectedAssetInfo()!.symbol.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{getSelectedAssetInfo()!.symbol}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">
                        {amount} {getSelectedAssetInfo()!.symbol}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-muted-foreground">To</span>
                      <span className="font-mono text-xs">{truncateAddress(destinationAddress)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Required Approvals</span>
                      <span className="font-medium">{threshold} signature{threshold && threshold > 1 ? 's' : ''}</span>
                    </div>
                    
                    <div className="mt-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-md border border-dashed border-amber-200 dark:border-amber-900/50">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300/90">
                        This proposal requires {threshold} signature{threshold && threshold > 1 ? 's' : ''} before execution
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t mt-auto">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isLoading}
              size="sm"
              className="sm:size-default"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !hasValidInputs()}
              size="sm"
              className="gap-1 sm:gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                  Create Proposal
                </>
              )}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}


