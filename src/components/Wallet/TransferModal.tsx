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
import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram, SYSVAR_CLOCK_PUBKEY, Keypair } from '@solana/web3.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getWebAuthnAssertion } from '@/utils/webauthnUtils';
import { getGuardianPDA } from '@/utils/credentialUtils';
import { getWalletByCredentialId } from '@/lib/firebase/webAuthnService';
import { Buffer } from 'buffer';
import BN from 'bn.js';
import { sha256 } from "@noble/hashes/sha256";
import { normalizeSignatureToLowS } from '@/lib/solana/secp256r1';
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { readMultisigNonce } from '@/lib/solana/transactions';
import { PROGRAM_ID } from '@/utils/constants';
import { createSecp256r1Instruction } from '@/utils/instructionUtils';
import { useRouter } from 'next/navigation';
import { createProposal as saveProposalToFirebase } from '@/lib/firebase/proposalService';
import { Timestamp } from 'firebase/firestore';



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

// Hàm tạo một đề xuất chuyển tiền
const localCreateProposal = async (
  multisigPubkey: PublicKey,
  payerPublicKey: PublicKey,
  guardianPubkey: PublicKey,
  guardianId: number,
  destinationPubkey: PublicKey,
  amountLamports: BN,
  description: string,
  proposalId: BN,
  webauthnSignature: Uint8Array,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
  webAuthnPubKey: Buffer
): Promise<Transaction> => {
  // Tạo transaction
  const tx = new Transaction();
  
  // 1. Tạo client data hash
  const clientDataHash = await crypto.subtle.digest('SHA-256', clientDataJSON);
  const clientDataHashBytes = new Uint8Array(clientDataHash);
  
  // 2. Tạo verification data
  const verificationData = new Uint8Array(authenticatorData.length + clientDataHashBytes.length);
  verificationData.set(new Uint8Array(authenticatorData), 0);
  verificationData.set(clientDataHashBytes, authenticatorData.length);
  
  // 3. Convert signature từ DER sang raw format
  const rawSignature = derToRaw(webauthnSignature);
  
  // 4. Chuẩn hóa signature về dạng Low-S
  const normalizedSignature = normalizeSignatureToLowS(Buffer.from(rawSignature));
  
  // 5. Tạo secp256r1 instruction để xác thực chữ ký WebAuthn
  const secp256r1Instruction = createSecp256r1Instruction(
    Buffer.from(verificationData),
    webAuthnPubKey,
    normalizedSignature,
    false
  );
  
  // Thêm instruction xác thực WebAuthn vào transaction
  tx.add(secp256r1Instruction);
  
  // Discriminator cho create_proposal instruction (từ IDL)
  const createProposalDiscriminator = [132, 116, 68, 174, 216, 160, 198, 22];
  
  // Tạo dữ liệu cho create_proposal instruction
  const descriptionBuffer = Buffer.from(description);
  const descriptionLenBuffer = Buffer.alloc(4);
  descriptionLenBuffer.writeUInt32LE(descriptionBuffer.length, 0);
  
  const actionBuffer = Buffer.from('transfer');
  const actionLenBuffer = Buffer.alloc(4);
  actionLenBuffer.writeUInt32LE(actionBuffer.length, 0);
  
  // Tạo data instruction cho create_proposal
  const data = Buffer.concat([
    Buffer.from(createProposalDiscriminator),
    Buffer.from(proposalId.toArrayLike(Buffer, 'le', 8)),
    Buffer.from(descriptionLenBuffer),
    descriptionBuffer,
    Buffer.from(new BN(guardianId).toArrayLike(Buffer, 'le', 8)),
    Buffer.from(actionLenBuffer),
    actionBuffer,
    // ActionParams với định dạng đúng
    // 1. amount (option<u64>): Some variant (1) + u64 value
    Buffer.from([1]), // Some variant cho amount
    amountLamports.toArrayLike(Buffer, 'le', 8),
    // 2. destination (option<publicKey>): Some variant (1) + public key (32 bytes)
    Buffer.from([1]), // Some variant cho destination
    destinationPubkey.toBuffer(),
    // 3. tokenMint (option<publicKey>): None variant (0)
    Buffer.from([0]), // None variant cho tokenMint
  ]);
  
  // Tính PDA cho proposal để sử dụng làm account
  const [proposalPubkey] = await PublicKey.findProgramAddressSync(
    [
      Buffer.from('proposal'),
      multisigPubkey.toBuffer(),
      proposalId.toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID
  );
  
  // Thêm instruction tạo đề xuất vào transaction
  tx.add(
    new TransactionInstruction({
      keys: [
        { pubkey: multisigPubkey, isSigner: false, isWritable: true },
        { pubkey: proposalPubkey, isSigner: false, isWritable: true },
        { pubkey: guardianPubkey, isSigner: false, isWritable: false },
        { pubkey: payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    })
  );
  
  return tx;
};


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
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txId, setTxId] = useState<string>('');
  const { multisigPDA } = useWalletInfo();
  const router = useRouter();
  
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
  
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
    setError(null);
    setSuccess(null);
    setTxId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setTxId('');
    
    try {
      if (!destinationAddress || !amount || !multisigPDA || !credentialId || !description) {
        const missingFields = [];
        if (!destinationAddress) missingFields.push('destinationAddress');
        if (!amount) missingFields.push('amount');
        if (!multisigPDA) missingFields.push('multisigPDA');
        if (!credentialId) missingFields.push('credentialId');
        if (!description) missingFields.push('description');
        
        throw new Error(`Thiếu thông tin bắt buộc: ${missingFields.join(', ')}`);
      }
      
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Vui lòng nhập số tiền hợp lệ');
      }

      const amountLamports = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);
      
      let destinationPublicKey: PublicKey;
      try {
        destinationPublicKey = new PublicKey(destinationAddress);
      } catch (error) {
        throw new Error('Địa chỉ đích không hợp lệ');
      }
      
      if (!multisigPDA) {
        throw new Error('Không tìm thấy địa chỉ ví đa chữ ký');
      }
      const multisigPublicKey = new PublicKey(multisigPDA);
      const multisigAccountInfo = await connection.getAccountInfo(multisigPublicKey);
      const guardianPDA = getGuardianPDA(
        multisigPublicKey,
        guardianId,
      );
      
      if (!multisigAccountInfo) {
        throw new Error('Không tìm thấy tài khoản ví đa chữ ký');
      }

      // Tạo proposalId từ timestamp như trong frontend_test để đảm bảo unique
      const proposalId = new BN(Date.now());
      
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
        throw new Error('Không tìm thấy WebAuthn public key');
      }

      const currentTimestamp = Math.floor(Date.now() / 1000);

      const hashBytes = sha256(webAuthnPubKey);
      const hashBytesStart = hashBytes.slice(0, 6);
      const pubkeyHashHex = Buffer.from(hashBytesStart).toString('hex');
      
      const messageString = `create:proposal_transfer_${amount}_SOL_to_${destinationAddress},timestamp:${currentTimestamp},pubkey:${pubkeyHashHex}`;
      
      setSuccess('Vui lòng chọn khóa WebAuthn để xác thực giao dịch...');
      
      const assertion = await getWebAuthnAssertion(credentialId, messageString, true);
      
      if (!assertion) {
        throw new Error('Lỗi khi ký tin nhắn với WebAuthn hoặc người dùng đã hủy xác thực');
      }
      
      setSuccess('Đang tạo đề xuất chuyển tiền...');
      
      // Tạo fee payer keypair từ secret key trong biến môi trường
      const feePayerSecretKeyStr = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY || '';
      const feePayerSecretKey = feePayerSecretKeyStr.split(',').map(s => parseInt(s.trim()));
      const feePayerKeypair = Keypair.fromSecretKey(new Uint8Array(feePayerSecretKey));
      
      // Tạo đề xuất chuyển tiền
      const tx = await localCreateProposal(
        multisigPublicKey,
        feePayerKeypair.publicKey,
        guardianPDA,
        guardianId,
        destinationPublicKey,
        amountLamports,
        description,
        proposalId,
        assertion.signature,
        assertion.authenticatorData,
        assertion.clientDataJSON,
        webAuthnPubKey
      );
      
      // Thiết lập recent blockhash và fee payer
      tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
      tx.feePayer = feePayerKeypair.publicKey;
      
      // Ký giao dịch
      tx.sign(feePayerKeypair);
      
      // Gửi transaction lên blockchain với cấu hình phù hợp với local validator
      const transactionId = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,  // Thay đổi thành false để kiểm tra lỗi trước khi gửi đến validator
        maxRetries: 5, 
        preflightCommitment: 'confirmed'  // Thay đổi thành 'confirmed' để đảm bảo tính nhất quán
      });
      
      setTxId(transactionId);
      
      try {
        // Thử cách khác để xác nhận giao dịch trên local validator
        console.log("Đang xác nhận giao dịch...");
        console.log("Transaction ID:", transactionId);

        // Đơn giản hóa phương pháp xác nhận cho local validator
        const blockhashInfo = await connection.getLatestBlockhash('finalized');
        const confirmationStatus = await connection.confirmTransaction({
          blockhash: blockhashInfo.blockhash,
          lastValidBlockHeight: blockhashInfo.lastValidBlockHeight,
          signature: transactionId
        }, 'confirmed');
        
        console.log("Kết quả xác nhận:", confirmationStatus);
        
        if (confirmationStatus.value && confirmationStatus.value.err) {
          throw new Error(`Lỗi khi xác nhận giao dịch: ${JSON.stringify(confirmationStatus.value.err)}`);
        }
        
        // Lưu thông tin đề xuất vào Firebase để hiển thị
        try {
          // Tính PDA cho proposal
          const [proposalPubkey] = await PublicKey.findProgramAddressSync(
            [
              Buffer.from('proposal'),
              multisigPublicKey.toBuffer(),
              proposalId.toArrayLike(Buffer, 'le', 8),
            ],
            PROGRAM_ID
          );
          
          // Lấy threshold từ multisig account
          const thresholdOffset = 8; // 8 bytes (discriminator)
          const thresholdByte = multisigAccountInfo.data[thresholdOffset];
          
          const proposalData = {
            proposalId: proposalId.toNumber(),
            multisigAddress: multisigPDA.toString(),
            description: description,
            action: 'transfer',
            status: 'pending',
            createdAt: Timestamp.now(),
            creator: guardianPDA.toString(),
            signers: [],
            requiredSignatures: thresholdByte,
            destination: destinationPublicKey.toString(),
            amount: parseFloat(amount),
            tokenMint: null,
            transactionSignature: transactionId
          };
          
          console.log("Lưu proposal vào Firebase:", proposalData);
          
          // Sử dụng service để lưu đề xuất
          const docId = await saveProposalToFirebase(proposalData);
          console.log("Đã lưu proposal vào Firebase thành công, ID:", docId);
        } catch (firebaseError) {
          console.error("Lỗi khi lưu proposal vào Firebase:", firebaseError);
          // Không throw error ở đây vì transaction đã thành công
        }
        
        setSuccess(`Đã tạo đề xuất chuyển ${amount} SOL thành công! ID giao dịch: ${transactionId}`);
        setAmount('');
        setDestinationAddress('');
        setDescription('');
        
        if (onTransferSuccess) {
          onTransferSuccess();
        }
        
        setTimeout(() => {
          onClose();
          router.push('/transactions');
        }, 3000);
      } catch (confirmError: any) {
        console.error('Lỗi xác nhận:', confirmError);
        
        // Kiểm tra trạng thái một cách thủ công bằng cách truy vấn nhiều lần
        let checkCount = 0;
        const maxChecks = 15;
        const checkInterval = setInterval(async () => {
          try {
            checkCount++;
            console.log(`Kiểm tra trạng thái lần ${checkCount}/${maxChecks}`);
            
            const status = await connection.getSignatureStatus(transactionId, {searchTransactionHistory: true});
            console.log('Trạng thái giao dịch:', status);
            
            if (status && status.value) {
              clearInterval(checkInterval);
              
              if (status.value.err) {
                setError(`Giao dịch thất bại: ${JSON.stringify(status.value.err)}`);
              } else {
                // Lưu thông tin đề xuất vào Firebase để hiển thị
                try {
                  // Tính PDA cho proposal
                  const [proposalPubkey] = await PublicKey.findProgramAddressSync(
                    [
                      Buffer.from('proposal'),
                      multisigPublicKey.toBuffer(),
                      proposalId.toArrayLike(Buffer, 'le', 8),
                    ],
                    PROGRAM_ID
                  );
                  
                  // Lấy threshold từ multisig account
                  const thresholdOffset = 8; // 8 bytes (discriminator)
                  const thresholdByte = multisigAccountInfo.data[thresholdOffset];
                  
                  const proposalData = {
                    proposalId: proposalId.toNumber(),
                    multisigAddress: multisigPDA.toString(),
                    description: description,
                    action: 'transfer',
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    creator: guardianPDA.toString(),
                    signers: [],
                    requiredSignatures: thresholdByte,
                    destination: destinationPublicKey.toString(),
                    amount: parseFloat(amount),
                    tokenMint: null,
                    transactionSignature: transactionId
                  };
                  
                  console.log("Lưu proposal vào Firebase:", proposalData);
                  
                  // Sử dụng service để lưu đề xuất
                  const docId = await saveProposalToFirebase(proposalData);
                  console.log("Đã lưu proposal vào Firebase thành công, ID:", docId);
                } catch (firebaseError) {
                  console.error("Lỗi khi lưu proposal vào Firebase:", firebaseError);
                  // Không throw error ở đây vì transaction đã thành công
                }
                
                setSuccess(`Đã tạo đề xuất chuyển ${amount} SOL thành công! ID giao dịch: ${transactionId}`);
                setAmount('');
                setDestinationAddress('');
                setDescription('');
                
                if (onTransferSuccess) {
                  onTransferSuccess();
                }
                
                setTimeout(() => {
                  onClose();
                  router.push('/transactions');
                }, 3000);
              }
            } else if (checkCount >= maxChecks) {
              clearInterval(checkInterval);
              setError(`Không thể xác nhận trạng thái giao dịch sau ${maxChecks} lần thử. ID giao dịch: ${transactionId}`);
            }
          } catch (e) {
            console.error('Lỗi khi kiểm tra trạng thái:', e);
            if (checkCount >= maxChecks) {
              clearInterval(checkInterval);
              setError(`Lỗi khi kiểm tra trạng thái giao dịch. ID giao dịch: ${transactionId}`);
            }
          }
        }, 1000);
        
        // Hiển thị thông báo đang chờ xác nhận
        setSuccess(`Đã gửi giao dịch với ID: ${transactionId}. Đang chờ xác nhận...`);
      }
      
    } catch (error: any) {
      setError(error.message || 'Đã xảy ra lỗi khi tạo đề xuất chuyển tiền');
      
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
          <ModalTitle>Chuyển SOL</ModalTitle>
          <ModalDescription>
            Tạo đề xuất chuyển SOL đến ví khác. Số dư hiện tại: {walletBalance.toFixed(4)} SOL
          </ModalDescription>
        </ModalHeader>
      
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="destination">Địa chỉ người nhận</Label>
              <Input
                id="destination"
                placeholder="Nhập địa chỉ Solana"
                value={destinationAddress}
                onChange={handleDestinationChange}
                disabled={isLoading}
                className="font-mono"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="amount">Số lượng (SOL)</Label>
              <Input
                id="amount"
                type="text"
                placeholder="0.0"
                value={amount}
                onChange={handleAmountChange}
                disabled={isLoading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Mô tả</Label>
              <Input
                id="description"
                placeholder="Nhập mô tả cho giao dịch này"
                value={description}
                onChange={handleDescriptionChange}
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
              Hủy
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Tạo đề xuất'
              )}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
