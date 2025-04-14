import React, { useState } from 'react';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalTitle, 
  ModalDescription,
  ModalFooter
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2} from "lucide-react";
import { PublicKey, Connection } from '@solana/web3.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getWebAuthnAssertion } from '@/utils/webauthnUtils';
import { getGuardianPDA } from '@/utils/credentialUtils';
import { getWalletByCredentialId } from '@/lib/firebase/webAuthnService';
import { Buffer } from 'buffer';
import BN from 'bn.js';
import { sha256 } from "@noble/hashes/sha256";
import { normalizeSignatureToLowS } from '@/lib/solana/secp356r1';
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { readMultisigNonce } from '@/lib/solana/transactions';

// Helper function to format numbers like Rust - format!("{}", f64)
function formatLikeRust(num: number): string {
  const str = num.toString();
  return str.replace(/\.?0+$/, '');
}



interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  credentialId: string;
  guardianId: number;
  connection: Connection;
  walletBalance: number;
  onTransferSuccess?: () => void;
  onTransferError?: (error: Error) => void;
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
}: TransferModalProps) {
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txId, setTxId] = useState<string>('');
  const { multisigPDA } = useWalletInfo();

  
  const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDestinationAddress(e.target.value);
    setError(null);
    setSuccess(null);
    setTxId('');
  };
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
      setSuccess(null);
      setTxId('');
    }
  };

  // Convert DER signature to raw format
  const derToRaw = (derSignature: Uint8Array): Uint8Array => {
    try {
      if (derSignature[0] !== 0x30) {
        throw new Error('Signature not in DER format: first byte is not 0x30');
      }
      
      const rLength = derSignature[3];
      const rStart = 4;
      const rEnd = rStart + rLength;
      
      const sLength = derSignature[rEnd + 1];
      const sStart = rEnd + 2;
      const sEnd = sStart + sLength;
      
      let r = derSignature.slice(rStart, rEnd);
      let s = derSignature.slice(sStart, sEnd);
      
      const rPadded = new Uint8Array(32);
      const sPadded = new Uint8Array(32);
      
      if (r.length <= 32) {
        rPadded.set(r, 32 - r.length);
      } else {
        rPadded.set(r.slice(r.length - 32));
      }
      
      if (s.length <= 32) {
        sPadded.set(s, 32 - s.length);
      } else {
        sPadded.set(s.slice(s.length - 32));
      }
      
      const rawSignature = new Uint8Array(64);
      rawSignature.set(rPadded);
      rawSignature.set(sPadded, 32);
      
      return rawSignature;
    } catch (e) {
      throw e;
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setTxId('');
    
    try {
      if (!destinationAddress || !amount || !multisigPDA || !credentialId) {
        const missingFields = [];
        if (!destinationAddress) missingFields.push('destinationAddress');
        if (!amount) missingFields.push('amount');
        if (!multisigPDA) missingFields.push('multisigPDA');
        if (!credentialId) missingFields.push('credentialId');
        
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const amountLamports = parseFloat(amount) * LAMPORTS_PER_SOL;
      
      let destinationPublicKey: PublicKey;
      try {
        destinationPublicKey = new PublicKey(destinationAddress);
      } catch (error) {
        throw new Error('Invalid destination address');
      }
      
      if (!multisigPDA) {
        throw new Error('Multisig PDA not found');
      }
      const multisigPublicKey = new PublicKey(multisigPDA);
      const multisigAccountInfo = await connection.getAccountInfo(multisigPublicKey);
      const guardianPDA = getGuardianPDA(
        multisigPublicKey,
        guardianId,
      );

      const nonceOffset = 19;
      
      if (!multisigAccountInfo) {
        throw new Error('Multisig account not found');
      }

      const nonceBytes = multisigAccountInfo.data.slice(nonceOffset, nonceOffset + 8);
      const currentNonce = new BN(nonceBytes, 'le');
      
      const nextNonce = currentNonce.addn(1).toNumber();
      
      let webAuthnPubKey: Buffer | null = null;
      const credentialMapping = await getWalletByCredentialId(credentialId);
      let localMapping: any = null;
      let localStorageData: string | null = null;

      if (!credentialMapping || !credentialMapping.guardianPublicKey || credentialMapping.guardianPublicKey.length === 0) {
        localStorageData = localStorage.getItem('webauthn_credential_' + credentialId);
        if (localStorageData) {
          localMapping = JSON.parse(localStorageData);
          if (localMapping && localMapping.guardianPublicKey && localMapping.guardianPublicKey.length > 0) {
            webAuthnPubKey = Buffer.from(new Uint8Array(localMapping.guardianPublicKey));
          }
        }
      } else {
        webAuthnPubKey = Buffer.from(new Uint8Array(credentialMapping.guardianPublicKey));
      }

      if (!webAuthnPubKey) {
        throw new Error('WebAuthn public key not found');
      }

      const currentTimestamp = Math.floor(Date.now() / 1000);

      const hashBytes = sha256(webAuthnPubKey);
      const hashBytesStart = hashBytes.slice(0, 6);
      const pubkeyHashHex = Buffer.from(hashBytesStart).toString('hex');
      
      const amountInSol = amountLamports / LAMPORTS_PER_SOL;
      const formattedAmount = formatLikeRust(amountInSol);
      
      const messageString = `transfer:${formattedAmount}_SOL_to_${destinationAddress},nonce:${nextNonce},timestamp:${currentTimestamp},pubkey:${pubkeyHashHex}`;
      
      const messageBytes = new TextEncoder().encode(messageString);
      
      setSuccess('Please select your WebAuthn key to authenticate the transaction...');
      
      const assertion = await getWebAuthnAssertion(credentialId, messageString, true);
      
      if (!assertion) {
        throw new Error('Error signing message with WebAuthn or user cancelled authentication');
      }
      
      setSuccess(null);
      
      const rawSignature = derToRaw(assertion.signature);
      const signature = Buffer.from(rawSignature);
      
      const normalizedSignature = normalizeSignatureToLowS(signature);
      
      const clientDataHash = await crypto.subtle.digest('SHA-256', assertion.clientDataJSON);
      const clientDataHashBytes = new Uint8Array(clientDataHash);
      
      const verificationData = new Uint8Array(assertion.authenticatorData.length + clientDataHashBytes.length);
      verificationData.set(new Uint8Array(assertion.authenticatorData), 0);
      verificationData.set(clientDataHashBytes, assertion.authenticatorData.length);
      
      const transferRequestData = {
        destination: destinationPublicKey.toString(),
        amount: amountLamports,
        multisigPDA: multisigPublicKey.toString(),
        guardianPDA: guardianPDA.toString(),
        nonce: nextNonce,
        timestamp: currentTimestamp,
        message: Buffer.from(messageBytes).toString('base64'),
        signature: Buffer.from(normalizedSignature).toString('base64'),
        publicKey: Buffer.from(webAuthnPubKey).toString('base64'),
        credentialId: credentialId,
        authenticatorData: Buffer.from(assertion.authenticatorData).toString('base64'),
        clientDataHash: Buffer.from(clientDataHashBytes).toString('base64')
      };
      
      
      const latestNonce = await readMultisigNonce(connection, multisigPublicKey);
      if (nextNonce !== latestNonce + 1) {
          throw new Error('Nonce đã thay đổi, cần refresh lại');
      }
      
      const response = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transferRequestData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || response.statusText;
        
        throw new Error(`API Error: ${errorMessage}`);
      }
      
      const responseData = await response.json();
      
      if (!responseData.success) {
        throw new Error(`Transaction Error: ${responseData.error || 'Unknown error'}`);
      }
      
      const serializedTx = Buffer.from(responseData.transaction, 'base64');
      
      const transactionId = await connection.sendRawTransaction(serializedTx, {
        skipPreflight: true,
        preflightCommitment: 'confirmed'
      });
      
      setTxId(transactionId);
      
      try {
        const confirmation = await connection.confirmTransaction(transactionId, 'confirmed');
        
        if (confirmation.value.err) {
          throw new Error(`Error confirming transaction: ${JSON.stringify(confirmation.value.err)}`);
        }
        
        setSuccess(`Successfully transferred ${amount} SOL to ${destinationAddress}! Transaction ID: ${transactionId}`);
        setAmount('');
        setDestinationAddress('');
        
        if (onTransferSuccess) {
          onTransferSuccess();
        }
        
        setTimeout(() => {
          onClose();
        }, 3000);
      } catch (confirmError: any) {
        setError(`Transaction was submitted but failed to confirm: ${confirmError.message}`);
        
        if (onTransferError) {
          onTransferError(confirmError);
        }
      }
      
    } catch (error: any) {
      setError(error.message || 'An error occurred while transferring funds');
      
      if (onTransferError) {
        onTransferError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <ModalTitle>Transfer SOL</ModalTitle>
          <ModalDescription>
            Send SOL to another wallet address. Your current balance: {walletBalance.toFixed(4)} SOL
          </ModalDescription>
        </ModalHeader>
      
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="destination">Destination Address</Label>
              <Input
                id="destination"
                placeholder="Enter Solana address"
                value={destinationAddress}
                onChange={handleDestinationChange}
                disabled={isLoading}
                className="font-mono"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (SOL)</Label>
              <Input
                id="amount"
                type="text"
                placeholder="0.0"
                value={amount}
                onChange={handleAmountChange}
                disabled={isLoading}
              />
            </div>
            
            {success && (
              <div className="text-sm text-green-600 font-medium p-2 bg-green-50 rounded">
                {success}
              </div>
            )}
            
            {error && (
              <div className="text-sm text-red-500 font-medium p-2 bg-red-50 rounded">
                {error}
              </div>
            )}
          </div>
          
          <ModalFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Transfer'
              )}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
