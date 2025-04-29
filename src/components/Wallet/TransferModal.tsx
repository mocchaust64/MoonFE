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
import { LAMPORTS_PER_SOL, PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram, SYSVAR_CLOCK_PUBKEY, Keypair } from '@solana/web3.js';

import { getWebAuthnAssertion } from '@/utils/webauthnUtils';
import { getGuardianPDA } from '@/utils/credentialUtils';
import { getWalletByCredentialId } from '@/lib/firebase/webAuthnService';
import { Buffer } from 'buffer';
import BN from 'bn.js';
import { sha256 } from "@noble/hashes/sha256";
import { normalizeSignatureToLowS } from '@/lib/solana/secp256r1';
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { PROGRAM_ID } from '@/utils/constants';
import { createSecp256r1Instruction } from '@/utils/instructionUtils';
import { useRouter } from 'next/navigation';
import { createProposal as saveProposalToFirebase } from '@/lib/firebase/proposalService';
import { Timestamp } from 'firebase/firestore';
import { derToRaw } from '@/utils/bufferUtils';

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

// Viết hàm với param object để giảm số lượng tham số
interface CreateProposalParams {
  multisigPubkey: PublicKey;
  payerPublicKey: PublicKey;
  guardianPubkey: PublicKey;
  guardianId: number;
  destinationPubkey: PublicKey;
  amountLamports: BN;
  description: string;
  proposalId: BN;
  webauthnSignature: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  webAuthnPubKey: Buffer;
}

// Interface để tổ chức các thông tin giao dịch
interface TransactionInfo {
  proposalId: BN;
  multisigPDA: string;
  multisigPublicKey: PublicKey;
  guardianPDA: PublicKey;
  destinationPublicKey: PublicKey;
  amount: string;
  amountLamports: BN;
  description: string;
  webAuthnPubKey: Buffer;
}

// Interface cho handleTransactionCheck
interface TransactionCheckParams {
  transactionId: string;
  connection: Connection;
  multisigAccountInfo: any;
  multisigPDA: string;
  guardianPDA: PublicKey;
  destinationPublicKey: PublicKey;
  proposalId: BN;
  amount: string;
  description: string;
  onSuccess: (thresholdByte: number) => void;
}

// Interface cho processSuccessfulTransaction
interface ProcessSuccessParams {
  thresholdByte: number;
  transactionId: string;
  multisigPDA: string;
  guardianPDA: PublicKey;
  destinationPublicKey: PublicKey;
  proposalId: BN;
  amount: string;
  description: string;
}

// Hàm tạo một đề xuất chuyển tiền
const localCreateProposal = async (params: CreateProposalParams): Promise<Transaction> => {
  // Tạo transaction
  const tx = new Transaction();
  
  // 1. Tạo client data hash
  const clientDataHash = await crypto.subtle.digest('SHA-256', params.clientDataJSON);
  const clientDataHashBytes = new Uint8Array(clientDataHash);
  
  // 2. Tạo verification data
  const verificationData = new Uint8Array(params.authenticatorData.length + clientDataHashBytes.length);
  verificationData.set(new Uint8Array(params.authenticatorData), 0);
  verificationData.set(clientDataHashBytes, params.authenticatorData.length);
  
  // 3. Convert signature từ DER sang raw format
  const rawSignature = derToRaw(params.webauthnSignature);
  
  // 4. Chuẩn hóa signature về dạng Low-S
  const normalizedSignature = normalizeSignatureToLowS(Buffer.from(rawSignature));
  
  // 5. Tạo secp256r1 instruction để xác thực chữ ký WebAuthn
  const secp256r1Instruction = createSecp256r1Instruction(
    Buffer.from(verificationData),
    params.webAuthnPubKey,
    normalizedSignature,
    false
  );
  
  // Thêm instruction xác thực WebAuthn vào transaction
  tx.add(secp256r1Instruction);
  
  // Discriminator cho create_proposal instruction (từ IDL)
  const createProposalDiscriminator = [132, 116, 68, 174, 216, 160, 198, 22];
  
  // Tạo dữ liệu cho create_proposal instruction
  const descriptionBuffer = Buffer.from(params.description);
  const descriptionLenBuffer = Buffer.alloc(4);
  descriptionLenBuffer.writeUInt32LE(descriptionBuffer.length, 0);
  
  const actionBuffer = Buffer.from('transfer');
  const actionLenBuffer = Buffer.alloc(4);
  actionLenBuffer.writeUInt32LE(actionBuffer.length, 0);
  
  // Tạo data instruction cho create_proposal
  const data = Buffer.concat([
    Buffer.from(createProposalDiscriminator),
    Buffer.from(params.proposalId.toArrayLike(Buffer, 'le', 8)),
    Buffer.from(descriptionLenBuffer),
    descriptionBuffer,
    Buffer.from(new BN(params.guardianId).toArrayLike(Buffer, 'le', 8)),
    Buffer.from(actionLenBuffer),
    actionBuffer,
    // ActionParams với định dạng đúng
    // 1. amount (option<u64>): Some variant (1) + u64 value
    Buffer.from([1]), // Some variant cho amount
    params.amountLamports.toArrayLike(Buffer, 'le', 8),
    // 2. destination (option<publicKey>): Some variant (1) + public key (32 bytes)
    Buffer.from([1]), // Some variant cho destination
    params.destinationPubkey.toBuffer(),
    // 3. tokenMint (option<publicKey>): None variant (0)
    Buffer.from([0]), // None variant cho tokenMint
  ]);
  
  // Tính PDA cho proposal để sử dụng làm account
  const [proposalPubkey] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('proposal'),
      params.multisigPubkey.toBuffer(),
      params.proposalId.toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID
  );
  
  // Thêm instruction tạo đề xuất vào transaction
  tx.add(
    new TransactionInstruction({
      keys: [
        { pubkey: params.multisigPubkey, isSigner: false, isWritable: true },
        { pubkey: proposalPubkey, isSigner: false, isWritable: true },
        { pubkey: params.guardianPubkey, isSigner: false, isWritable: false },
        { pubkey: params.payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    })
  );
  
  return tx;
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
}: Readonly<TransferModalProps>) {
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { multisigPDA } = useWalletInfo();
  const router = useRouter();
  
  const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDestinationAddress(e.target.value);
    setError(null);
    setSuccess(null);
  };
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
      setSuccess(null);
    }
  };
  
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
    setError(null);
    setSuccess(null);
  };

  // Kiểm tra đầu vào và tạo dữ liệu transaction
  const validateInputAndCreateTransactionInfo = async (): Promise<TransactionInfo | Error> => {
    // Kiểm tra các trường bắt buộc
    const validationError = validateRequiredFields();
    if (validationError) {
      return validationError;
    }
    
    // Kiểm tra số tiền
    if (!amount || parseFloat(amount) <= 0) {
      return new Error('Vui lòng nhập số tiền hợp lệ');
    }

    const amountLamports = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);
    
    // Kiểm tra và lấy thông tin địa chỉ đích
    const destinationPublicKeyResult = getDestinationPublicKey();
    if (destinationPublicKeyResult instanceof Error) {
      return destinationPublicKeyResult;
    }
    
    // Kiểm tra và lấy thông tin ví đa chữ ký
    const multisigInfoResult = await getMultisigInfo();
    if (multisigInfoResult instanceof Error) {
      return multisigInfoResult;
    }
    
    const { multisigPublicKey, guardianPDA } = multisigInfoResult;
    
    // Tạo proposalId từ timestamp để đảm bảo unique
    const proposalId = new BN(Date.now());
    
    try {
      // Lấy WebAuthn public key
      const webAuthnPubKey = await getWebAuthnPublicKey(credentialId);
      
      // Đảm bảo multisigPDA không phải null
      if (!multisigPDA) {
        return new Error('Không tìm thấy địa chỉ ví đa chữ ký');
      }
      
      // Tạo và trả về TransactionInfo
      return {
        proposalId,
        multisigPDA: multisigPDA, // Đảm bảo multisigPDA là string
        multisigPublicKey,
        guardianPDA,
        destinationPublicKey: destinationPublicKeyResult,
        amount,
        amountLamports,
        description,
        webAuthnPubKey
      };
    } catch (error) {
      return error instanceof Error 
        ? error 
        : new Error('Lỗi không xác định khi tạo thông tin giao dịch');
    }
  };
  
  // Kiểm tra các trường bắt buộc
  const validateRequiredFields = (): Error | null => {
    if (!destinationAddress || !amount || !multisigPDA || !credentialId || !description) {
      const missingFields = [];
      if (!destinationAddress) missingFields.push('destinationAddress');
      if (!amount) missingFields.push('amount');
      if (!multisigPDA) missingFields.push('multisigPDA');
      if (!credentialId) missingFields.push('credentialId');
      if (!description) missingFields.push('description');
      
      return new Error(`Thiếu thông tin bắt buộc: ${missingFields.join(', ')}`);
    }
    
    return null;
  };
  
  // Kiểm tra và lấy thông tin địa chỉ đích
  const getDestinationPublicKey = (): PublicKey | Error => {
    try {
      return new PublicKey(destinationAddress);
    } catch (err) {
      return new Error(`Địa chỉ đích không hợp lệ: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  // Kiểm tra và lấy thông tin ví đa chữ ký
  const getMultisigInfo = async (): Promise<{
    multisigPublicKey: PublicKey;
    guardianPDA: PublicKey;
  } | Error> => {
    if (!multisigPDA) {
      return new Error('Không tìm thấy địa chỉ ví đa chữ ký');
    }
    
    try {
      // Đã kiểm tra multisigPDA không phải null ở trên
      const multisigPublicKey = new PublicKey(multisigPDA);
      const multisigAccountInfo = await connection.getAccountInfo(multisigPublicKey);
      
      if (!multisigAccountInfo) {
        return new Error('Không tìm thấy tài khoản ví đa chữ ký');
      }
      
      const guardianPDA = getGuardianPDA(multisigPublicKey, guardianId);
      
      return {
        multisigPublicKey,
        guardianPDA
      };
    } catch (error) {
      return new Error(`Lỗi khi xử lý địa chỉ ví đa chữ ký: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Lấy WebAuthn public key
  const getWebAuthnPublicKey = async (credentialId: string): Promise<Buffer> => {
    const credentialMapping = await getWalletByCredentialId(credentialId);
    
    // Kiểm tra từ firebase trước
    if (credentialMapping?.guardianPublicKey?.length) {
      return Buffer.from(new Uint8Array(credentialMapping.guardianPublicKey));
    }
    
    // Nếu không có trong firebase, kiểm tra localStorage
    const localStorageData = localStorage.getItem('webauthn_credential_' + credentialId);
    if (localStorageData) {
      try {
        const localMapping = JSON.parse(localStorageData);
        if (localMapping?.guardianPublicKey?.length > 0) {
          return Buffer.from(new Uint8Array(localMapping.guardianPublicKey));
        }
      } catch (error) {
        console.error('Lỗi khi parse dữ liệu từ localStorage:', error);
        // Thêm xử lý cụ thể cho lỗi parse JSON
        throw new Error('Không thể đọc dữ liệu WebAuthn từ localStorage: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
    
    throw new Error('Không tìm thấy WebAuthn public key');
  };
  
  // Tạo thông điệp xác thực và lấy WebAuthn assertion
  const getTransactionAssertion = async (txInfo: TransactionInfo): Promise<any> => {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // Tạo hash của public key để tạo thông điệp
    const hashBytes = sha256(txInfo.webAuthnPubKey);
    const hashBytesStart = hashBytes.slice(0, 6);
    const pubkeyHashHex = Buffer.from(hashBytesStart).toString('hex');
    
    const messageString = `create:proposal_transfer_${txInfo.amount}_SOL_to_${destinationAddress},timestamp:${currentTimestamp},pubkey:${pubkeyHashHex}`;
    
    setSuccess('Vui lòng chọn khóa WebAuthn để xác thực giao dịch...');
    
    const assertion = await getWebAuthnAssertion(credentialId, messageString, true);
    
    if (!assertion) {
      throw new Error('Lỗi khi ký tin nhắn với WebAuthn hoặc người dùng đã hủy xác thực');
    }
    
    return assertion;
  };
  
  // Tạo và ký transaction
  const createAndSignTransaction = async (txInfo: TransactionInfo, assertion: any): Promise<{ tx: Transaction, transactionId: string }> => {
    setSuccess('Đang tạo đề xuất chuyển tiền...');
    
    // Tạo fee payer keypair từ secret key trong biến môi trường
    const feePayerSecretKeyStr = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY ?? '';
    const feePayerSecretKey = feePayerSecretKeyStr.split(',').map(s => parseInt(s.trim()));
    const feePayerKeypair = Keypair.fromSecretKey(new Uint8Array(feePayerSecretKey));
    
    // Tạo đề xuất chuyển tiền với object params
    const tx = await localCreateProposal({
      multisigPubkey: txInfo.multisigPublicKey,
      payerPublicKey: feePayerKeypair.publicKey,
      guardianPubkey: txInfo.guardianPDA,
      guardianId,
      destinationPubkey: txInfo.destinationPublicKey,
      amountLamports: txInfo.amountLamports,
      description: txInfo.description,
      proposalId: txInfo.proposalId,
      webauthnSignature: assertion.signature,
      authenticatorData: assertion.authenticatorData,
      clientDataJSON: assertion.clientDataJSON,
      webAuthnPubKey: txInfo.webAuthnPubKey
    });
    
    // Thiết lập recent blockhash và fee payer
    tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
    tx.feePayer = feePayerKeypair.publicKey;
    
    // Ký giao dịch
    tx.sign(feePayerKeypair);
    
    // Gửi transaction lên blockchain
    const transactionId = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 5, 
      preflightCommitment: 'confirmed'
    });
    
    return { tx, transactionId };
  };
  
  // Xác nhận giao dịch và xử lý kết quả
  const confirmAndProcessTransaction = async (
    transactionId: string,
    txInfo: TransactionInfo,
    multisigAccountInfo: any
  ): Promise<void> => {
    try {
      console.log("Đang xác nhận giao dịch...");
      console.log("Transaction ID:", transactionId);

      const blockhashInfo = await connection.getLatestBlockhash('finalized');
      const confirmationStatus = await connection.confirmTransaction({
        blockhash: blockhashInfo.blockhash,
        lastValidBlockHeight: blockhashInfo.lastValidBlockHeight,
        signature: transactionId
      }, 'confirmed');
      
      console.log("Kết quả xác nhận:", confirmationStatus);
      
      if (confirmationStatus.value?.err) {
        throw new Error(`Lỗi khi xác nhận giao dịch: ${JSON.stringify(confirmationStatus.value.err)}`);
      }
      
      await saveProposalToFirebaseAndUpdateUI(transactionId, txInfo, multisigAccountInfo);
    } catch (confirmError) {
      console.error('Lỗi xác nhận:', confirmError);
      
      // Sửa cách gọi callback trong handleTransactionCheck
      handleTransactionCheck({
        transactionId, 
        connection, 
        multisigAccountInfo, 
        multisigPDA: txInfo.multisigPDA, 
        guardianPDA: txInfo.guardianPDA, 
        destinationPublicKey: txInfo.destinationPublicKey, 
        proposalId: txInfo.proposalId, 
        amount: txInfo.amount, 
        description: txInfo.description, 
        // Sử dụng callback không trả về Promise
        onSuccess: (thresholdByte) => {
          // Gọi processSuccessfulTransaction mà không return Promise
          processSuccessfulTransaction({
            thresholdByte,
            transactionId, 
            multisigPDA: txInfo.multisigPDA, 
            guardianPDA: txInfo.guardianPDA, 
            destinationPublicKey: txInfo.destinationPublicKey, 
            proposalId: txInfo.proposalId, 
            amount: txInfo.amount, 
            description: txInfo.description
          }).catch(error => {
            console.error('Lỗi khi xử lý giao dịch thành công:', error);
          });
        }
      });
      
      // Hiển thị thông báo đang chờ xác nhận
      setSuccess(`Đã gửi giao dịch với ID: ${transactionId}. Đang chờ xác nhận...`);
    }
  };
  
  // Lưu đề xuất vào Firebase và cập nhật UI
  const saveProposalToFirebaseAndUpdateUI = async (
    transactionId: string,
    txInfo: TransactionInfo,
    multisigAccountInfo: any
  ): Promise<void> => {
    try {
      // Lấy threshold từ multisig account
      const thresholdOffset = 8; // 8 bytes (discriminator)
      const thresholdByte = multisigAccountInfo.data[thresholdOffset];
      
      const proposalData = {
        proposalId: txInfo.proposalId.toNumber(),
        multisigAddress: txInfo.multisigPDA,
        description: txInfo.description,
        action: 'transfer',
        status: 'pending',
        createdAt: Timestamp.now(),
        creator: txInfo.guardianPDA.toString(),
        signers: [],
        requiredSignatures: thresholdByte,
        destination: txInfo.destinationPublicKey.toString(),
        amount: parseFloat(txInfo.amount),
        tokenMint: null,
        transactionSignature: transactionId
      };
      
      console.log("Lưu proposal vào Firebase:", proposalData);
      
      // Sử dụng service để lưu đề xuất
      const docId = await saveProposalToFirebase(proposalData);
      console.log("Đã lưu proposal vào Firebase thành công, ID:", docId);
      
      handleTransactionSuccess(transactionId, txInfo.amount);
    } catch (firebaseError) {
      console.error("Lỗi khi lưu proposal vào Firebase:", firebaseError);
      // Không throw error ở đây vì transaction đã thành công
      setSuccess(`Đã tạo đề xuất chuyển tiền thành công, nhưng không lưu được thông tin chi tiết. ID giao dịch: ${transactionId}`);
      
      // Vẫn cập nhật UI và redirect
      setTimeout(() => {
        onClose();
        router.push('/transactions');
      }, 3000);
    }
  };
  
  // Xử lý khi transaction thành công
  const handleTransactionSuccess = (transactionId: string, amount: string): void => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Kiểm tra đầu vào và tạo dữ liệu transaction
      const txInfoResult = await validateInputAndCreateTransactionInfo();
      
      if (txInfoResult instanceof Error) {
        throw txInfoResult;
      }
      
      const txInfo = txInfoResult;  // Loại bỏ type assertion không cần thiết
      
      // Lấy thông tin tài khoản multisig
      const multisigAccountInfo = await connection.getAccountInfo(txInfo.multisigPublicKey);
      if (!multisigAccountInfo) {
        throw new Error('Không tìm thấy tài khoản ví đa chữ ký');
      }
      
      // Lấy assertion từ WebAuthn
      const assertion = await getTransactionAssertion(txInfo);
      
      // Tạo và ký transaction
      const { transactionId } = await createAndSignTransaction(txInfo, assertion);
      
      // Xác nhận và xử lý transaction
      await confirmAndProcessTransaction(transactionId, txInfo, multisigAccountInfo);
      
    } catch (error: any) {
      setError(error.message ?? 'Đã xảy ra lỗi khi tạo đề xuất chuyển tiền');
      
      if (onTransferError) {
        onTransferError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTransactionCheck = (params: TransactionCheckParams): void => {
    const { 
      transactionId, 
      connection, 
      multisigAccountInfo, 
      onSuccess 
    } = params;
    
    let checkCount = 0;
    const maxChecks = 15;
    let isCheckingComplete = false;
    
    // Sử dụng một hàm kiểm tra định kỳ có giới hạn thay vì setInterval vô hạn
    const checkTransaction = async () => {
      if (isCheckingComplete || checkCount >= maxChecks) {
        return;
      }
      
      checkCount++;
      console.log(`Kiểm tra trạng thái lần ${checkCount}/${maxChecks}`);
      
      try {
        const status = await connection.getSignatureStatus(transactionId, {searchTransactionHistory: true});
        console.log('Trạng thái giao dịch:', status);
        
        if (status?.value) {
          isCheckingComplete = true;
          
          if (status.value.err) {
            setError(`Giao dịch thất bại: ${JSON.stringify(status.value.err)}`);
          } else {
            // Lấy threshold từ multisig account
            const thresholdOffset = 8; // 8 bytes (discriminator)
            const thresholdByte = multisigAccountInfo.data[thresholdOffset];
            
            // Gọi callback onSuccess mà không return Promise
            onSuccess(thresholdByte);
          }
          return;
        }
        
        if (checkCount < maxChecks) {
          // Sử dụng setTimeout với thời gian tăng dần để giảm số lần gọi API khi chờ lâu
          const delay = Math.min(1000 * (1 + checkCount * 0.2), 5000); // Tăng delay theo thời gian, tối đa 5s
          setTimeout(checkTransaction, delay);
        } else {
          isCheckingComplete = true;
          setError(`Không thể xác nhận trạng thái giao dịch sau ${maxChecks} lần thử. ID giao dịch: ${transactionId}`);
        }
      } catch (e) {
        console.error('Lỗi khi kiểm tra trạng thái:', e);
        if (checkCount < maxChecks) {
          // Nếu gặp lỗi, thử lại sau một khoảng thời gian ngắn
          setTimeout(checkTransaction, 1000);
        } else {
          isCheckingComplete = true;
          setError(`Lỗi khi kiểm tra trạng thái giao dịch. ID giao dịch: ${transactionId}`);
        }
      }
    };
    
    // Bắt đầu quá trình kiểm tra
    checkTransaction();
  };
  
  const processSuccessfulTransaction = async (params: ProcessSuccessParams): Promise<void> => {
    const {
      thresholdByte,
      transactionId,
      multisigPDA,
      guardianPDA,
      destinationPublicKey,
      proposalId,
      amount,
      description
    } = params;
    
    try {
      const proposalData = {
        proposalId: proposalId.toNumber(),
        multisigAddress: multisigPDA,
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
      
      handleTransactionSuccess(transactionId, amount);
    } catch (firebaseError) {
      console.error("Lỗi khi lưu proposal vào Firebase:", firebaseError);
      // Không throw error ở đây vì transaction đã thành công
      setSuccess(`Đã tạo đề xuất chuyển tiền thành công, nhưng không lưu được thông tin chi tiết. ID giao dịch: ${transactionId}`);
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
