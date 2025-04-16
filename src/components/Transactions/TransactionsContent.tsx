"use client";

import { Timestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, UserPlus, Send, Loader2, Key, ArrowUpDown, FileText } from "lucide-react";
import type React from "react";
import { useState, useEffect,  useRef } from "react";
import { toast } from "sonner";
import { GuardianConfirm } from "@/components/Guardian/GuardianConfirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  getPendingInvites,
  getGuardianData,
  getInvitation,
} from "@/lib/firebase/guardianService";
import { cn } from "@/lib/utils";
import type { GuardianData } from "@/types/guardian";
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { getProposalsByWallet, addSignerToProposal, updateProposalStatus } from "@/lib/firebase/proposalService";
import { Proposal as BaseProposal } from "@/lib/firebase/proposalService";
import { PublicKey, SystemProgram, Transaction as SolanaTransaction, TransactionInstruction, SYSVAR_CLOCK_PUBKEY, Keypair } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import { Buffer } from "buffer";
import { useWalletStore } from "@/store/walletStore";
import { getWalletByCredentialId } from "@/lib/firebase/webAuthnService";
import { PROGRAM_ID } from "@/utils/constants";
import BN from "bn.js";
import {getConnection } from "@/utils/connectionUtils";
import { SYSVAR_INSTRUCTIONS_PUBKEY } from "@/utils/transactionUtils";
import { updateProposalInFirebase } from "@/utils/proposalService";
import { handleSignProposal as signProposalWithWebAuthn } from "@/utils/proposalSigning";


interface TransactionItem {
  id: string;
  type: string;
  icon: React.ReactNode;
  status: string;
  statusColor: string;
  details: {
    author: string;
    createdOn: string;
    executedOn: string;
    results: {
      confirmed: number;
      rejected: number;
      threshold: string;
    };
  };
  guardianData?: GuardianData;
  isPendingGuardian?: boolean;
  proposal?: Proposal;
}

// Định nghĩa kiểu Proposal mở rộng với executedAt
interface Proposal extends BaseProposal {
  executedAt?: any;
  proposalPubkey?: string;
}

// Thêm hàm formatDate
const formatDate = (date: Date): string => {
  return date.toLocaleString();
};

// Thêm hàm getStatusColor
const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'executed':
      return 'text-green-500';
    case 'ready':
      return 'text-yellow-500';
    case 'pending':
      return 'text-blue-500';
    case 'failed':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
};

// Thêm hàm createTransactionItem
const createTransactionItem = (proposal: Proposal): TransactionItem => ({
  id: proposal.proposalId.toString(),
  type: proposal.action === 'transfer' ? "Transfer" : proposal.action,
  icon: proposal.action === 'transfer' ? <ArrowUpDown className="h-5 w-5" /> : <FileText className="h-5 w-5" />,
  status: proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1),
  statusColor: getStatusColor(proposal.status),
  details: {
    author: proposal.creator || "Unknown",
    createdOn: formatDate(proposal.createdAt?.toDate?.() || new Date()),
    executedOn: proposal.transactionSignature ? 
      formatDate(proposal.executedAt?.toDate?.() || new Date()) : 
      "Pending",
    results: {
      confirmed: proposal.signers?.length || 0,
      rejected: 0,
      threshold: `${proposal.requiredSignatures}/${proposal.requiredSignatures}`
    }
  },
  proposal
});

// Thêm khai báo cho window.loggedTransactions
declare global {
  interface Window {
    loggedTransactions: Set<string>;
  }
}

export function TransactionsContent() {
  const { threshold, guardianCount, multisigPDA } = useWalletInfo();
  const { guardians } = useWalletStore();
  const [guardianPDA, setGuardianPDA] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [guardianId, setGuardianId] = useState<number | null>(null);
  
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSigning, setIsSigning] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianData | null>(
    null,
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingGuardians, setPendingGuardians] = useState<GuardianData[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeProposalId, setActiveProposalId] = useState<number | null>(null);
  const [dataLastLoaded, setDataLastLoaded] = useState<number>(0);

  const toggleTransaction = (id: string) => {
    setExpandedTransactions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  function loadPendingGuardians() {
    if (!multisigPDA) {
      console.log("No multisig address found in loadPendingGuardians");
      setTransactions(prev => {
        const nonPendingGuardians = prev.filter(tx => !tx.isPendingGuardian);
        return nonPendingGuardians;
      });
      setIsLoading(false);
      return;
    }

    console.log("Loading pending guardians for multisig:", multisigPDA.toString());
    
    const now = Date.now();
    if (now - dataLastLoaded < 3000 && transactions.length > 0) {
      console.log("Skipping loadPendingGuardians - loaded recently");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      getPendingInvites(multisigPDA.toString()).then((pendingInvites) => {
        if (!pendingInvites || pendingInvites.length === 0) {
          setTransactions(prev => {
            const nonPendingGuardians = prev.filter(tx => !tx.isPendingGuardian);
            return nonPendingGuardians;
          });
          setIsLoading(false);
          return;
        }

        Promise.all(
          pendingInvites.map(async (inviteCode) => {
            const guardianData = await getGuardianData(inviteCode);
            const inviteData = await getInvitation(inviteCode);

            if (!guardianData || !inviteData) return null;

            return {
              id: inviteCode,
              type: "Add Guardian",
              icon: <UserPlus className="h-5 w-5 text-purple-500" />,
              status: "Ready for execution",
              statusColor: "text-yellow-500",
              details: {
                author: ` ${guardianData.guardianId}`,
                createdOn:
                  guardianData.createdAt instanceof Timestamp
                    ? guardianData.createdAt.toDate().toLocaleString()
                    : new Date(guardianData.createdAt).toLocaleString(),
                executedOn: ` ${inviteCode}`,
                results: {
                  confirmed: 0,
                  rejected: 0,
                  threshold: `${threshold}/${guardianCount}`,
                },
              },
              guardianData,
              isPendingGuardian: true,
            };
          })
        ).then((guardianTransactions) => {
          const validTransactions = guardianTransactions.filter(
            (tx): tx is NonNullable<typeof tx> => tx !== null
          );
          
          setTransactions(prev => {
            const nonPendingGuardians = prev.filter(tx => !tx.isPendingGuardian);
            return [...validTransactions, ...nonPendingGuardians];
          });
          setIsLoading(false);
        });
      });
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transactions");
      setIsLoading(false);
    }
  }

  function loadProposalsFromFirebase() {
    if (!multisigPDA) {
      console.log("No multisig address found in loadProposalsFromFirebase");
      return;
    }

    console.log("Loading proposals from Firebase for multisig:", multisigPDA.toString());
    
    const now = Date.now();
    if (now - dataLastLoaded < 3000 && proposals.length > 0) {
      console.log("Skipping loadProposalsFromFirebase - loaded recently");
      return;
    }

    setIsLoading(true);
    try {
      getProposalsByWallet(new PublicKey(multisigPDA.toString())).then(async (proposalsData) => {
        console.log("Loaded proposals:", proposalsData);
        
        // DEBUG: Hiển thị trạng thái từng proposal 
        proposalsData.forEach(p => {
          console.log(`Proposal ${p.proposalId} - Status: "${p.status}" - Signers: ${p.signers?.length || 0}/${p.requiredSignatures}`);
        });
        
        if (proposalsData && Array.isArray(proposalsData)) {
          // Tính toán PDA cho mỗi proposal và thêm vào đối tượng
          const proposalsWithPDA = await Promise.all(proposalsData.map(async (proposal) => {
            try {
              const seedBuffer = Buffer.from("proposal");
              const multisigBuffer = new PublicKey(multisigPDA).toBuffer();
              const proposalIdBuffer = new BN(proposal.proposalId).toArrayLike(Buffer, "le", 8);
              
              const [proposalPubkey] = await PublicKey.findProgramAddress(
                [seedBuffer, multisigBuffer, proposalIdBuffer],
                PROGRAM_ID
              );
              
              console.log(`Đã tính PDA cho proposal ${proposal.proposalId}: ${proposalPubkey.toString()}`);
              return {
                ...proposal,
                proposalPubkey: proposalPubkey.toString()
              };
            } catch (error) {
              console.error(`Lỗi khi tính PDA cho proposal ${proposal.proposalId}:`, error);
              return proposal;
            }
          }));
          
          setProposals(proposalsWithPDA);
          
          const proposalTransactions = proposalsWithPDA.map(proposal => createTransactionItem(proposal));
          
          setTransactions(prev => {
            const pendingGuardians = prev.filter(tx => tx.isPendingGuardian);
            return [...pendingGuardians, ...proposalTransactions];
          });
          
          setDataLastLoaded(Date.now());
        }
      });
    } catch (error) {
      console.error("Error loading proposals from Firebase:", error);
      toast.error("Failed to load proposals");
    } finally {
      setIsLoading(false);
    }
  }

  const handleConfirmGuardian = (guardian: GuardianData) => {
    setSelectedGuardian(guardian);
    setShowConfirmDialog(true);
  };

  const handleConfirmSuccess = () => {
    toast.success("Guardian confirmed successfully");
    loadPendingGuardians();
    setShowConfirmDialog(false);
    setSelectedGuardian(null);
  };

  const handleSignProposal = async (proposal: Proposal) => {
    try {
      setIsSigning(true);
      setActiveProposalId(proposal.proposalId);
      
      console.log("Begin signing proposal:", proposal.proposalId);
      if (!multisigPDA) {
        throw new Error("Không tìm thấy MultisigPDA");
      }
      
      // Lấy guardianId từ localStorage thay vì sử dụng guardianId từ state
      let currentGuardianId = guardianId;
      const storedGuardianId = localStorage.getItem('current_guardian_id');
      
      if (storedGuardianId) {
        // Nếu có guardianId trong localStorage, ưu tiên sử dụng nó
        currentGuardianId = parseInt(storedGuardianId);
        console.log(`Sử dụng guardianId từ localStorage: ${currentGuardianId}`);
      } else if (!currentGuardianId) {
        // Nếu không có guardianId trong state và localStorage, thử lấy từ credential ID
        const storedCredentialId = localStorage.getItem('current_credential_id');
        if (storedCredentialId) {
          try {
            const localStorageKey = "webauthn_credential_" + storedCredentialId;
            const localMapping = localStorage.getItem(localStorageKey);
            if (localMapping) {
              const mappingData = JSON.parse(localMapping);
              if (mappingData.guardianId && mappingData.walletAddress === multisigPDA.toString()) {
                // Đảm bảo mappingData.guardianId là số
                const guardianIdFromMapping = Number(mappingData.guardianId);
                currentGuardianId = guardianIdFromMapping;
                console.log(`Tìm thấy guardianId từ credential mapping: ${guardianIdFromMapping}`);
                // Lưu lại guardianId vào localStorage để sử dụng sau này
                localStorage.setItem('current_guardian_id', String(guardianIdFromMapping));
              }
            }
          } catch (e) {
            console.error("Lỗi khi tìm guardianId từ credential mapping:", e);
          }
        }
      }
      
      if (!currentGuardianId) {
        throw new Error("Không tìm thấy thông tin guardianId. Vui lòng đăng nhập lại.");
      }
      
      console.log(`Ký đề xuất với guardianId: ${currentGuardianId}`);
      
      // Tạo keypair từ feePayer secret key
        let feePayerKeypair;
          const feePayerSecretStr = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY as string;
          if (!feePayerSecretStr) {
            throw new Error("NEXT_PUBLIC_FEE_PAYER_SECRET_KEY không được cấu hình");
          }
          
          const secretKeyArray = feePayerSecretStr.split(',').map(Number);
          const secretKey = new Uint8Array(secretKeyArray);
          
          feePayerKeypair = Keypair.fromSecretKey(secretKey);
      
          const connection = getConnection();
      
      // Gọi hàm ký đề xuất từ proposalSigning.ts
      const txSignature = await signProposalWithWebAuthn(
        connection,
        proposal,
        multisigPDA,
        currentGuardianId,
        feePayerKeypair,
        credentialId || undefined
      );
      
      toast.success(`Đề xuất đã được ký thành công!`);
      
      // Cập nhật danh sách đề xuất sau khi ký thành công
      setTimeout(async () => {
        console.log("Đang tải lại danh sách đề xuất sau khi ký...");
        await forceReloadProposals();
        console.log("Đã cập nhật danh sách đề xuất sau khi ký");
        
        // Tải lại lần nữa sau 3 giây để đảm bảo mọi thay đổi đã được cập nhật
        setTimeout(async () => {
          console.log("Tải lại lần thứ hai...");
          await forceReloadProposals();
          console.log("Cập nhật lần cuối hoàn tất");
        }, 3000);
      }, 2000); // Tăng thời gian từ 1000ms lên 2000ms
      
      } catch (error) {
      console.error("Lỗi khi ký đề xuất:", error);
      toast.error(`Lỗi khi ký đề xuất: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
    } finally {
      setIsSigning(false);
      setActiveProposalId(null);
    }
  };

  const handleExecuteProposal = async (proposal: Proposal) => {
    try {
      console.log("Bắt đầu thực thi đề xuất:", proposal);
      setIsProcessing(true);
      setActiveProposalId(proposal.proposalId);
      
      console.log("Bắt đầu thực thi đề xuất:", proposal);
      console.log("ProposalId:", proposal.proposalId);
      console.log("MultisigPDA:", multisigPDA?.toString());

      if (!multisigPDA) {
        toast.error("Không tìm thấy MultisigPDA");
        return;
      }

      // KIỂM TRA SỐ LƯỢNG CHỮ KÝ SO VỚI THRESHOLD
      console.log("Kiểm tra số lượng chữ ký so với threshold...");
      console.log("Trạng thái đề xuất hiện tại:", proposal.status);
      
      // Kiểm tra đề xuất đã sẵn sàng thực thi chưa
      if (proposal.status !== "Ready") {
        toast.error("Đề xuất chưa sẵn sàng để thực thi. Cần đạt đủ số chữ ký.");
        return;
      }
      
      // Kiểm tra số lượng chữ ký so với threshold
      const signatureCount = proposal.signers?.length || 0;
      const requiredSignatures = proposal.requiredSignatures || 0;
      
      console.log(`Số chữ ký hiện tại: ${signatureCount}/${requiredSignatures}`);
      
      if (signatureCount < requiredSignatures) {
        toast.error(`Đề xuất chưa đủ chữ ký (${signatureCount}/${requiredSignatures}). Cần thêm ${requiredSignatures - signatureCount} chữ ký.`);
        return;
      }
      
      // Tính ProposalPDA
      const [proposalPDA] = await PublicKey.findProgramAddress(
        [
          Buffer.from("proposal"),
          new PublicKey(multisigPDA.toString()).toBuffer(),
          new BN(proposal.proposalId).toArrayLike(Buffer, "le", 8)
        ],
        PROGRAM_ID
      );
      console.log("Proposal PDA đã tính toán:", proposalPDA.toString());
      
      // Tạo keypair từ feePayer secret key
      let feePayerKeypair;
      try {
        const feePayerSecretStr = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY as string;
        if (!feePayerSecretStr) {
          throw new Error("NEXT_PUBLIC_FEE_PAYER_SECRET_KEY không được cấu hình");
        }
        
        const secretKeyArray = feePayerSecretStr.split(',').map(Number);
        const secretKey = new Uint8Array(secretKeyArray);
        
        feePayerKeypair = Keypair.fromSecretKey(secretKey);
        console.log("Fee Payer public key:", feePayerKeypair.publicKey.toString());
      } catch (keypairError) {
        console.error("Lỗi khi tạo keypair từ NEXT_PUBLIC_FEE_PAYER_SECRET_KEY:", keypairError);
        throw new Error("Không thể tạo keypair cho fee payer. Vui lòng kiểm tra cấu hình.");
      }
      
      // Discriminator cho execute_proposal
      const executeProposalDiscriminator = Buffer.from([186, 60, 116, 133, 108, 128, 111, 28]);
      
      // Tạo dữ liệu cho tham số proposal_id
      const proposalIdBuffer = Buffer.alloc(8);
      proposalIdBuffer.writeBigUInt64LE(BigInt(proposal.proposalId), 0);
      
      // Tạo data instruction với proposal_id
      const executeData = Buffer.concat([
        executeProposalDiscriminator,
        proposalIdBuffer
      ]);
      
      // Tạo transaction
      const transaction = new SolanaTransaction();
      
      try {
        // Tạo instruction thực thi đề xuất
        const executeInstruction = new TransactionInstruction({
          keys: [
            { pubkey: new PublicKey(multisigPDA.toString()), isSigner: false, isWritable: true },
            { pubkey: proposalPDA, isSigner: false, isWritable: true },
            { pubkey: feePayerKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: proposal.destination ? new PublicKey(proposal.destination) : SystemProgram.programId, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: executeData,
        });
        
        // Thêm instruction thực thi đề xuất
        transaction.add(executeInstruction);
        
        // Thiết lập fee payer và blockhash
        transaction.feePayer = feePayerKeypair.publicKey;
        const connection = getConnection();
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        
        // Ký transaction với feePayer keypair
        transaction.sign(feePayerKeypair);
        
        // Gửi transaction
        console.log("Đang gửi transaction thực thi đề xuất...");
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3
        });
        console.log("Transaction đã được gửi với signature:", signature);
        
        // Xác nhận giao dịch
        console.log("Đang chờ xác nhận giao dịch...");
        await connection.confirmTransaction(signature, 'confirmed');
        
        // Cập nhật trạng thái đề xuất trong Firebase
        console.log("Cập nhật trạng thái đề xuất trong Firebase...");
        proposal.status = "Executed";
        proposal.executedAt = Timestamp.now();
        proposal.transactionSignature = signature;
        await updateProposalInFirebase(proposal);
        
        // Tạo explorer URL
        const explorerLink = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
          ? `https://explorer.solana.com/tx/${signature}`
          : process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet'
            ? `https://explorer.solana.com/tx/${signature}?cluster=devnet` 
            : `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http://localhost:8899`;
          
        toast.success(
          <div>
            Đề xuất đã được thực thi thành công!
            <div className="mt-2">
              <a 
                href={explorerLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 underline hover:text-blue-700"
              >
                Xem trên Solana Explorer
              </a>
            </div>
          </div>,
          { duration: 6000 }
        );
        
        // Refresh danh sách
        await loadProposalsFromFirebase();
        console.log("=== KẾT THÚC THỰC THI ĐỀ XUẤT ===");
      } catch (txError) {
        console.error("Lỗi trong quá trình xử lý transaction:", txError);
        
        // Kiểm tra xem có phải lỗi từ RPC không
        const errorMessage = txError instanceof Error ? txError.message : String(txError);
        if (errorMessage.includes("failed to send transaction")) {
          throw new Error(`Không thể gửi transaction: ${errorMessage}`);
        }
        
        // Mặc định throw lỗi gốc
        throw txError;
      }
    } catch (error) {
      console.error('Lỗi khi thực thi đề xuất:', error);
      
      // Phân tích chi tiết lỗi
      let errorMessage = 'Lỗi không xác định';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Kiểm tra lỗi từ blockchain
        if (error.message.includes('custom program error')) {
          // Trích xuất mã lỗi nếu có
          const errorCodeMatch = error.message.match(/custom program error: (0x[0-9a-fA-F]+)/);
          if (errorCodeMatch && errorCodeMatch[1]) {
            const errorCode = errorCodeMatch[1];
            
            // Ánh xạ mã lỗi tới thông báo dễ hiểu
            switch (errorCode) {
              case '0x1':
                errorMessage = 'Khởi tạo không hợp lệ';
                break;
              case '0x7':
                errorMessage = 'Không đủ chữ ký để thực thi đề xuất';
                break;
              case '0x2':
                errorMessage = 'Tham số không hợp lệ';
                break;
              case '0x1770': // 0x1770 = 6000
                errorMessage = 'Lỗi chương trình: Chủ sở hữu không hợp lệ';
                break;
              case '0x1771': // 0x1771 = 6001
                errorMessage = 'Lỗi chương trình: Thao tác không hợp lệ';
                break;
              default:
                errorMessage = `Lỗi chương trình: ${errorCode}`;
            }
          }
        }
      }
      
      toast.error(`Lỗi khi thực thi đề xuất: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      setActiveProposalId(null);
    }
  };

  const handleManualRefresh = () => {
    setDataLastLoaded(0);
    loadPendingGuardians();
    loadProposalsFromFirebase();
  };

  const forceReloadProposals = async () => {
    if (!multisigPDA) {
      console.log("No multisig address found in forceReloadProposals");
      return;
    }
    
    console.log("Force reloading proposals from Firebase for multisig:", multisigPDA.toString());
    setIsLoading(true);
    
    try {
      const proposalsData = await getProposalsByWallet(new PublicKey(multisigPDA.toString()));
      console.log("Loaded proposals (force reload):", proposalsData);
      
      // DEBUG: Hiển thị trạng thái từng proposal 
      proposalsData.forEach(p => {
        console.log(`Proposal ${p.proposalId} - Status: "${p.status}" - Signers: ${p.signers?.length || 0}/${p.requiredSignatures}`);
      });
      
      if (proposalsData && Array.isArray(proposalsData)) {
        // Tính toán PDA cho mỗi proposal và thêm vào đối tượng
        const proposalsWithPDA = await Promise.all(proposalsData.map(async (proposal) => {
          try {
            const seedBuffer = Buffer.from("proposal");
            const multisigBuffer = new PublicKey(multisigPDA).toBuffer();
            const proposalIdBuffer = new BN(proposal.proposalId).toArrayLike(Buffer, "le", 8);
            
            const [proposalPubkey] = await PublicKey.findProgramAddress(
              [seedBuffer, multisigBuffer, proposalIdBuffer],
              PROGRAM_ID
            );
            
            console.log(`Đã tính PDA cho proposal ${proposal.proposalId}: ${proposalPubkey.toString()}`);
            return {
              ...proposal,
              proposalPubkey: proposalPubkey.toString()
            };
          } catch (error) {
            console.error(`Lỗi khi tính PDA cho proposal ${proposal.proposalId}:`, error);
            return proposal;
          }
        }));
        
        setProposals(proposalsWithPDA);
        
        const proposalTransactions = proposalsWithPDA.map(proposal => createTransactionItem(proposal));
        setTransactions(prev => {
          const pendingGuardians = prev.filter(tx => tx.isPendingGuardian);
          return [...pendingGuardians, ...proposalTransactions];
        });
        
        setDataLastLoaded(Date.now());
      }
    } catch (error) {
      console.error("Error loading proposals:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Log debugging info
  const logDebuggingInfo = (transaction: TransactionItem) => {
    // Chỉ log một lần mỗi transaction để tránh spam console
    if (!window.loggedTransactions) window.loggedTransactions = new Set<string>();
    
    if (!window.loggedTransactions.has(transaction.id)) {
      console.log(`DEBUG ${transaction.id}:`, {
        guardianPDA,
        guardianId,
        localStorageGuardianPDA: localStorage.getItem('guardianPDA'),
        hasProposal: !!transaction.proposal,
        statusRaw: transaction.proposal?.status,
        statusLower: transaction.proposal?.status?.toLowerCase(),
        buttonShouldShow: transaction.proposal && !transaction.proposal.transactionSignature,
        hasUserSignedResult: transaction.proposal ? hasCurrentUserSigned(transaction.proposal) : false,
        signers: transaction.proposal?.signers || []
      });
      window.loggedTransactions.add(transaction.id);
    }
    return null;
  };

  useEffect(() => {
    const savedCredentialId = localStorage.getItem('credentialId');
    const savedGuardianId = localStorage.getItem('guardianId');
    const savedGuardianPDA = localStorage.getItem('guardianPDA');
    
    if (savedCredentialId) setCredentialId(savedCredentialId);
    if (savedGuardianId) setGuardianId(parseInt(savedGuardianId, 10));
    if (savedGuardianPDA) setGuardianPDA(savedGuardianPDA);
    
    if (guardians.length > 0 && !savedGuardianPDA) {
      const primaryGuardian = guardians[0];
      setGuardianPDA(primaryGuardian.address);
      setGuardianId(primaryGuardian.id);
    }
    
    // Load data once when component mounts
    loadPendingGuardians();
    loadProposalsFromFirebase();
    setDataLastLoaded(Date.now());
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Chỉ chạy khi mount component

  // Sử dụng useRef để lưu giá trị multisigPDA trước đó
  const prevMultisigPDARef = useRef<string | null>(null);
  const dataLoadingRef = useRef<boolean>(false);

  // Thêm useEffect mới để xử lý khi guardians hoặc multisigPDA thay đổi,
  // nhưng không gây ra refresh liên tục
  useEffect(() => {
    // Tránh việc load dữ liệu trùng lặp
    if (dataLoadingRef.current) return;
    
    // Chỉ reload nếu multisigPDA thay đổi thực sự
    if (multisigPDA && (!prevMultisigPDARef.current || prevMultisigPDARef.current !== multisigPDA.toString())) {
      console.log("MultisigPDA changed:", multisigPDA.toString());
      prevMultisigPDARef.current = multisigPDA.toString();
      
      // Tránh load liên tục
      const now = Date.now();
      if (now - dataLastLoaded > 5000) {
        dataLoadingRef.current = true;
        loadPendingGuardians();
        loadProposalsFromFirebase();
        setDataLastLoaded(now);
        setTimeout(() => {
          dataLoadingRef.current = false;
        }, 1000);
      }
    }
    
    // Chỉ cập nhật guardian nếu chưa có guardianPDA được lưu
    if (guardians.length > 0 && !guardianPDA) {
      const primaryGuardian = guardians[0];
      setGuardianPDA(primaryGuardian.address);
      setGuardianId(primaryGuardian.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardians, multisigPDA]);

  // Kiểm tra người dùng đã ký đề xuất chưa trước khi thực hiện ký
  const hasCurrentUserSigned = (proposal: Proposal): boolean => {
    if (!guardianPDA || !proposal.signers) return false;
    return proposal.signers.includes(guardianPDA);
  };

  return (
    <motion.div
      className="space-y-6"
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
        <h1 className="text-3xl font-bold">Transactions</h1>
        <Button
          onClick={handleManualRefresh}
          disabled={isLoading}
          className="transition-transform hover:scale-105"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
      </motion.div>

      <motion.div
        className="mt-8 space-y-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="text-muted-foreground text-sm">All Transactions</div>

        {isLoading && (
          <Card className="p-6">
            <div className="flex flex-col items-center justify-center space-y-2 py-8 text-center">
              <div className="text-muted-foreground">
                Loading transactions...
              </div>
            </div>
          </Card>
        )}

        {!isLoading && transactions.length === 0 && (
          <Card className="p-6">
            <div className="flex flex-col items-center justify-center space-y-2 py-8 text-center">
              <UserPlus className="text-muted-foreground/50 h-12 w-12" />
              <h3 className="text-lg font-medium">No transactions found</h3>
              <p className="text-muted-foreground">
                When you add guardians or make transfers, they will appear here.
              </p>
            </div>
          </Card>
        )}

        <AnimatePresence>
          {transactions.map((transaction, index) => (
            <motion.div
              key={transaction.id}
              className="transition-all duration-200"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.01 }}
            >
              <Card
                className={cn(
                  "hover:bg-accent/50 cursor-pointer p-4 transition-colors",
                  expandedTransactions.has(transaction.id) && "rounded-b-none",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">{transaction.icon}</div>
                    <div>
                      <div className="font-medium">{transaction.type}</div>
                      <div className="text-muted-foreground text-sm">
                        {transaction.type === "Transfer" ? "Transfer SOL" : "New owner"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className={`text-sm ${transaction.statusColor}`}>
                        {transaction.status}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Status
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleTransaction(transaction.id)}
                      aria-label={
                        expandedTransactions.has(transaction.id)
                          ? "Collapse details"
                          : "Expand details"
                      }
                      className="transition-transform hover:scale-110"
                    >
                      {expandedTransactions.has(transaction.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>

              <AnimatePresence>
                {expandedTransactions.has(transaction.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="bg-muted/50 rounded-t-none border-t-0 p-6">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Info</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Guardian ID
                              </span>
                              <span>{transaction.details.author}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Created on
                              </span>
                              <span>{transaction.details.createdOn}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Invite Code
                              </span>
                              <span>{transaction.details.executedOn}</span>
                            </div>
                            {/* Thêm link Solana Explorer nếu có transaction signature */}
                            {transaction.proposal?.transactionSignature && transaction.proposal.status === "Executed" && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Signature
                                </span>
                                <a
                                  href={process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
                                    ? `https://explorer.solana.com/tx/${transaction.proposal.transactionSignature}`
                                    : process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet'
                                      ? `https://explorer.solana.com/tx/${transaction.proposal.transactionSignature}?cluster=devnet` 
                                      : `https://explorer.solana.com/tx/${transaction.proposal.transactionSignature}?cluster=custom&customUrl=http://localhost:8899`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 underline hover:text-blue-700"
                                >
                                  Xem trên Solana Explorer
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Results</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <motion.div
                              className="bg-background rounded-lg p-4 text-center"
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="text-2xl font-bold text-green-500">
                                {transaction.details.results.confirmed}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                Confirmed
                              </div>
                            </motion.div>
                            <motion.div
                              className="bg-background rounded-lg p-4 text-center"
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="text-2xl font-bold text-red-500">
                                {transaction.details.results.rejected}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                Rejected
                              </div>
                            </motion.div>
                            <motion.div
                              className="bg-background rounded-lg p-4 text-center"
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="text-2xl font-bold">
                                {transaction.details.results.threshold}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                Threshold
                              </div>
                            </motion.div>
                          </div>

                          {transaction.isPendingGuardian && (
                            <div className="mt-4 flex justify-end">
                              <Button
                                onClick={() =>
                                  handleConfirmGuardian(
                                    transaction.guardianData!,
                                  )
                                }
                                className="transition-transform hover:scale-105"
                              >
                                Confirm
                              </Button>
                            </div>
                          )}
                          
                          {/* Log debugging info */}
                          {logDebuggingInfo(transaction)}
                          
                          {/* Nút Ký đề xuất */}
                          {transaction.status.toLowerCase() === "pending" && (
                            <div className="mt-4 flex justify-end">
                              <Button
                                onClick={() => handleSignProposal(transaction.proposal!)}
                                disabled={isSigning || (transaction.proposal && hasCurrentUserSigned(transaction.proposal))}
                                className="transition-transform hover:scale-105"
                              >
                                {isSigning && transaction.proposal && transaction.proposal.proposalId === activeProposalId ? (
                                  <span className="flex items-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Đang ký...
                                  </span>
                                ) : transaction.proposal && hasCurrentUserSigned(transaction.proposal) ? (
                                  "Đã ký"
                                ) : (
                                  "Ký đề xuất"
                                )}
                              </Button>
                            </div>
                          )}

                          {transaction.proposal && transaction.proposal.status.toLowerCase() === "ready" && (
                            <div className="mt-4 flex justify-end">
                              <Button
                                onClick={() => handleExecuteProposal(transaction.proposal!)}
                                disabled={isProcessing}
                                className="transition-transform hover:scale-105 bg-green-600 hover:bg-green-700"
                              >
                                {isProcessing && transaction.proposal.proposalId === activeProposalId ? (
                                  <span className="flex items-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Đang thực thi...
                                  </span>
                                ) : (
                                  "Thực thi"
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {showConfirmDialog && selectedGuardian && (
        <GuardianConfirm
          isOpen={showConfirmDialog}
          onClose={() => {
            setShowConfirmDialog(false);
            setSelectedGuardian(null);
          }}
          onConfirm={handleConfirmSuccess}
          guardian={selectedGuardian}
        />
      )}
    </motion.div>
  );
} 