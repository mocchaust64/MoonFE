"use client";

import { Timestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, UserPlus,  Loader2, ArrowUpDown, FileText } from "lucide-react";
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

import { Proposal as BaseProposal, getProposalsByWallet,updateProposalStatus } from "@/lib/firebase/proposalService";
import { PublicKey, SystemProgram, Transaction as SolanaTransaction, TransactionInstruction, SYSVAR_CLOCK_PUBKEY, Keypair } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useWalletStore } from "@/store/walletStore";

import { PROGRAM_ID } from "@/utils/constants";
import BN from "bn.js";
import { getConnection } from "@/utils/connectionUtils";
import { updateProposalInFirebase } from "@/utils/proposalService";
import { handleSignProposal as signProposalWithWebAuthn } from "@/utils/proposalSigning";

// Đưa hàm getErrorCodeFromMessage lên trước các hàm sử dụng nó
// Sửa lỗi S6594 sử dụng RegExp.exec() thay vì match
const getErrorCodeFromMessage = (message: string): string | undefined => {
  const errorCodeRegex = /custom program error: (0x[0-9a-fA-F]+)/;
  const match = errorCodeRegex.exec(message);
  return match?.[1];
};

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
  executedAt?: Timestamp;
  proposalPubkey?: string;
  params?: {
    token_mint?: string;
    token_amount?: number;
    amount?: number;
    destination?: string;
  };
  // Giữ lại tokenMint và extraData để tương thích, nhưng chúng ta sẽ dần loại bỏ việc sử dụng chúng
  tokenMint?: string | null;
  extraData?: {
    tokenMint?: string;
    [key: string]: unknown;
  };
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
    author: proposal.creator ?? "Unknown",
    createdOn: formatDate(proposal.createdAt?.toDate?.() ?? new Date()),
    executedOn: proposal.transactionSignature ? 
      formatDate(proposal.executedAt?.toDate?.() ?? new Date()) : 
      "Pending",
    results: {
      confirmed: proposal.signers?.length ?? 0,
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
      processPendingInvites(multisigPDA.toString());
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transactions");
      setIsLoading(false);
    }
  }

  const processPendingInvites = async (multisigAddress: string) => {
    try {
      const pendingInvites = await getPendingInvites(multisigAddress);
      
      if (!pendingInvites || pendingInvites.length === 0) {
        setTransactions(prev => {
          const nonPendingGuardians = prev.filter(tx => !tx.isPendingGuardian);
          return nonPendingGuardians;
        });
        setIsLoading(false);
        return;
      }

      const guardianTransactionsPromises = pendingInvites.map(createGuardianTransaction);
      const guardianTransactions = await Promise.all(guardianTransactionsPromises);
      
      const validTransactions = guardianTransactions.filter(
        (tx): tx is NonNullable<typeof tx> => tx !== null
      );
      
      setTransactions(prev => {
        const nonPendingGuardians = prev.filter(tx => !tx.isPendingGuardian);
        return [...validTransactions, ...nonPendingGuardians];
      });
    } catch (error) {
      console.error("Error processing pending invites:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createGuardianTransaction = async (inviteCode: string) => {
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
  };

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
      getProposalsByWallet(new PublicKey(multisigPDA.toString()))
        .then(proposalsData => {
          console.log("Loaded proposals:", proposalsData);
          return processProposals(proposalsData, new PublicKey(multisigPDA.toString()));
        })
        .catch(error => {
          console.error("Error loading proposals from Firebase:", error);
          toast.error("Failed to load proposals");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } catch (error) {
      console.error("Error in loadProposalsFromFirebase:", error);
      setIsLoading(false);
    }
  }

  const processProposals = async (proposalsData: BaseProposal[], multisigPDA: PublicKey) => {
    // DEBUG: Hiển thị trạng thái từng proposal 
    proposalsData.forEach(p => {
      console.log(`Proposal ${p.proposalId} - Status: "${p.status}" - Signers: ${p.signers?.length ?? 0}/${p.requiredSignatures}`);
    });
    
    if (!proposalsData || !Array.isArray(proposalsData)) return;
    
    // Tính toán PDA cho mỗi proposal và thêm vào đối tượng
    const proposalsWithPDA = await Promise.all(proposalsData.map(
      async (proposal) => calculateProposalPDA(proposal, multisigPDA)
    ));
    
    setProposals(proposalsWithPDA);
    
    const proposalTransactions = proposalsWithPDA.map(proposal => createTransactionItem(proposal));
    
    setTransactions(prev => {
      const pendingGuardians = prev.filter(tx => tx.isPendingGuardian);
      return [...pendingGuardians, ...proposalTransactions];
    });
    
    setDataLastLoaded(Date.now());
  };

  const calculateProposalPDA = async (proposal: BaseProposal, multisigPDA: PublicKey): Promise<Proposal> => {
    try {
      const seedBuffer = Buffer.from("proposal");
      const multisigBuffer = multisigPDA.toBuffer();
      const proposalIdBuffer = new BN(proposal.proposalId).toArrayLike(Buffer, "le", 8);
      
      const [proposalPubkey] = PublicKey.findProgramAddressSync(
        [seedBuffer, multisigBuffer, proposalIdBuffer],
        PROGRAM_ID
      );
      
      console.log(`Đã tính PDA cho proposal ${proposal.proposalId}: ${proposalPubkey.toString()}`);
      
      // Chuẩn hóa dữ liệu khi nhận proposal từ Firebase
      const proposalWithPDA = {
        ...proposal,
        proposalPubkey: proposalPubkey.toString()
      } as Proposal;
      
      // Xử lý đề xuất chuyển token đặc biệt
      if (proposal.action === 'transfer_token') {
        // Đảm bảo params luôn tồn tại
        if (!proposalWithPDA.params) {
          proposalWithPDA.params = {};
        }
        
        // Chuẩn hóa thông tin token từ các vị trí khác nhau (nếu cần)
        if (!proposalWithPDA.params.token_mint) {
          if (typeof proposalWithPDA.tokenMint === 'string') {
            proposalWithPDA.params.token_mint = proposalWithPDA.tokenMint;
            console.log(`Chuẩn hóa token_mint cho proposal ${proposal.proposalId} từ proposalWithPDA.tokenMint`);
          } else if (proposalWithPDA.extraData?.tokenMint) {
            proposalWithPDA.params.token_mint = proposalWithPDA.extraData.tokenMint;
            console.log(`Chuẩn hóa token_mint cho proposal ${proposal.proposalId} từ proposalWithPDA.extraData.tokenMint`);
          }
        }
      }
      
      return proposalWithPDA;
    } catch (error) {
      console.error(`Lỗi khi tính PDA cho proposal ${proposal.proposalId}:`, error);
      return proposal as Proposal;
    }
  };

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

  const getGuardianId = (currentGuardianId: number | null, multisigPDAString: string): number => {
    // Thử lấy guardianId từ localStorage
    const storedGuardianId = localStorage.getItem('current_guardian_id');
    if (storedGuardianId) {
      const parsedId = parseInt(storedGuardianId);
      console.log(`Sử dụng guardianId từ localStorage: ${parsedId}`);
      return parsedId;
    }
    
    // Nếu đã có guardianId trong state
    if (currentGuardianId !== null) {
      return currentGuardianId;
    }
    
    // Thử lấy từ credential ID
    const storedCredentialId = localStorage.getItem('current_credential_id');
    if (storedCredentialId) {
      try {
        const localStorageKey = "webauthn_credential_" + storedCredentialId;
        const localMapping = localStorage.getItem(localStorageKey);
        if (localMapping) {
          const mappingData = JSON.parse(localMapping);
          if (mappingData.guardianId && mappingData.walletAddress === multisigPDAString) {
            // Đảm bảo mappingData.guardianId là số
            const guardianIdFromMapping = Number(mappingData.guardianId);
            // Lưu lại guardianId vào localStorage để sử dụng sau này
            localStorage.setItem('current_guardian_id', String(guardianIdFromMapping));
            console.log(`Tìm thấy guardianId từ credential mapping: ${guardianIdFromMapping}`);
            return guardianIdFromMapping;
          }
        }
      } catch (e) {
        console.error("Lỗi khi tìm guardianId từ credential mapping:", e);
      }
    }
    
    throw new Error("Không tìm thấy thông tin guardianId. Vui lòng đăng nhập lại.");
  };

  const createFeePayerKeypair = (): Keypair => {
    const feePayerSecretStr = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY as string;
    if (!feePayerSecretStr) {
      throw new Error("NEXT_PUBLIC_FEE_PAYER_SECRET_KEY không được cấu hình");
    }
    
    const secretKeyArray = feePayerSecretStr.split(',').map(Number);
    const secretKey = new Uint8Array(secretKeyArray);
    
    return Keypair.fromSecretKey(secretKey);
  };

  const handleSignProposal = async (proposal: Proposal) => {
    try {
      setIsSigning(true);
      setActiveProposalId(proposal.proposalId);
      
      console.log("Begin signing proposal:", proposal.proposalId);
      if (!multisigPDA) {
        throw new Error("Không tìm thấy MultisigPDA");
      }
      
      // Lấy guardianId từ hàm riêng biệt
      const currentGuardianId = getGuardianId(guardianId, multisigPDA.toString());
      console.log(`Ký đề xuất với guardianId: ${currentGuardianId}`);
      
      // Tạo keypair từ feePayer secret key
      const feePayerKeypair = createFeePayerKeypair();
      const connection = getConnection();

      // Gọi hàm ký đề xuất từ proposalSigning.ts
      await signProposalWithWebAuthn(
        connection,
        proposal,
        multisigPDA,
        currentGuardianId,
        feePayerKeypair,
        credentialId ?? undefined
      );
      
      toast.success(`Đề xuất đã được ký thành công!`);
      
      // Cập nhật trạng thái đề xuất sau khi ký thành công
      setTimeout(async () => {
        console.log("Đang tải lại danh sách đề xuất sau khi ký...");
        await forceReloadProposals();
        
        // Lấy thông tin mới nhất của đề xuất
        const updatedProposals = await getProposalsByWallet(new PublicKey(multisigPDA.toString()));
        const updatedProposal = updatedProposals.find(p => p.proposalId === proposal.proposalId);
        
        if (updatedProposal) {
          await updateProposalStatusAfterSigning(updatedProposal);
        }
        
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
      console.log("Action:", proposal.action);

      if (!multisigPDA) {
        toast.error("Không tìm thấy MultisigPDA");
        return;
      }

      // KIỂM TRA SỐ LƯỢNG CHỮ KÝ SO VỚI THRESHOLD
      console.log("Kiểm tra số lượng chữ ký so với threshold...");
      console.log("Trạng thái đề xuất hiện tại:", proposal.status);
      
      // Kiểm tra số lượng chữ ký so với threshold
      const signatureCount = proposal.signers?.length ?? 0;
      const requiredSignatures = proposal.requiredSignatures ?? 0;
      
      console.log(`Số chữ ký hiện tại: ${signatureCount}/${requiredSignatures}`);
      
      // Sửa lỗi: Kiểm tra dựa trên số lượng chữ ký thực tế chứ không phụ thuộc vào trạng thái 
      if (signatureCount < requiredSignatures) {
        toast.error(`Đề xuất chưa đủ chữ ký (${signatureCount}/${requiredSignatures}). Cần thêm ${requiredSignatures - signatureCount} chữ ký.`);
        return;
      }
      
      // Tính ProposalPDA
      const [proposalPDA] = PublicKey.findProgramAddressSync(
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
      
      // Xác định loại đề xuất để chọn instruction tương ứng
      const isTokenTransfer = proposal.action === 'transfer_token';
      console.log(`Loại đề xuất: ${isTokenTransfer ? 'Token Transfer' : 'SOL Transfer hoặc khác'}`);

      // Debug thông tin đề xuất để xác định cấu trúc
      console.log("Thông tin đề xuất:", {
        action: proposal.action,
        params: proposal.params,
        tokenMint: proposal.params?.token_mint,
        destination: proposal.destination
      });

      // Chọn discriminator dựa vào loại đề xuất
      const executeDiscriminator = isTokenTransfer 
        ? Buffer.from([205, 76, 88, 177, 131, 145, 70, 62])  // execute_token_proposal discriminator
        : Buffer.from([186, 60, 116, 133, 108, 128, 111, 28]); // execute_proposal discriminator
      
      // Tạo dữ liệu cho tham số proposal_id
      const proposalIdBuffer = Buffer.alloc(8);
      proposalIdBuffer.writeBigUInt64LE(BigInt(proposal.proposalId), 0);
      
      // Tạo data instruction với proposal_id
      const executeData = Buffer.concat([
        executeDiscriminator,
        proposalIdBuffer
      ]);
      
      // Tạo transaction
      const transaction = new SolanaTransaction();
      
      try {
        // Tạo instruction dựa trên loại đề xuất
        if (isTokenTransfer) {
          /**
           * ----- PHẦN XỬ LÝ CHUYỂN TOKEN -----
           * 1. Lấy thông tin token mint từ proposal
           * 2. Kiểm tra và chuẩn bị tài khoản token
           * 3. Tạo transaction instruction
           */
          
          // 1. Lấy thông tin token mint - sử dụng nguồn chính thức (proposal.params.token_mint)
          const tokenMintAddress = proposal.params?.token_mint;

          if (!tokenMintAddress) {
            console.error("Lỗi: Không tìm thấy token mint address", {
              proposal_id: proposal.proposalId,
              action: proposal.action
            });
            throw new Error("Đề xuất chuyển token thiếu thông tin token mint. Vui lòng kiểm tra dữ liệu đề xuất.");
          }

          console.log("Token Mint được tìm thấy:", tokenMintAddress);
          
          // Kiểm tra địa chỉ token mint và destination có hợp lệ không
          let tokenMint: PublicKey;
          let destinationAddress: PublicKey;
          
          try {
            tokenMint = new PublicKey(tokenMintAddress);
          } catch {
            console.error("Địa chỉ token mint không hợp lệ:", tokenMintAddress);
            throw new Error("Địa chỉ token mint không hợp lệ. Vui lòng kiểm tra lại dữ liệu đề xuất.");
          }
          
          if (!proposal.destination) {
            throw new Error("Địa chỉ nhận token không được xác định trong đề xuất.");
          }
          
          try {
            destinationAddress = new PublicKey(proposal.destination);
          } catch {
            console.error("Địa chỉ nhận không hợp lệ:", proposal.destination);
            throw new Error("Địa chỉ nhận token không hợp lệ. Vui lòng kiểm tra lại dữ liệu đề xuất.");
          }

          // 2. Thiết lập tài khoản token
          const connection = getConnection();
          const { TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
          const { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
          
          // Tìm địa chỉ tài khoản token của ví multisig (from_token_account)
          const fromTokenAccount = getAssociatedTokenAddressSync(
            tokenMint,
            new PublicKey(multisigPDA.toString()),
            true  // allowOwnerOffCurve = true
          );
          
          // Tìm địa chỉ tài khoản token của người nhận (to_token_account)
          const toTokenAccount = getAssociatedTokenAddressSync(
            tokenMint,
            destinationAddress
          );
          
          console.log("From Token Account:", fromTokenAccount.toString());
          console.log("To Token Account:", toTokenAccount.toString());

          // Kiểm tra xem tài khoản token nguồn đã tồn tại chưa
          const fromTokenAccountInfo = await connection.getAccountInfo(fromTokenAccount);
          if (!fromTokenAccountInfo) {
            console.error("Tài khoản token nguồn chưa được khởi tạo:", fromTokenAccount.toString());
            throw new Error(`Tài khoản token của multisig cho token ${tokenMintAddress} chưa được khởi tạo. Vui lòng nạp token vào ví trước khi thực hiện giao dịch chuyển token.`);
          }
          
          // Kiểm tra số dư token (nếu cần)
          try {
            const { AccountLayout } = await import('@solana/spl-token');
            const tokenAccountData = AccountLayout.decode(fromTokenAccountInfo.data);
            const tokenBalance = Number(tokenAccountData.amount);
            
            // Lấy số lượng token cần chuyển từ đề xuất
            let tokenAmountToTransfer = 0;
            
            // Ưu tiên lấy từ proposal.params.token_amount 
            if (proposal.params?.token_amount !== undefined) {
              tokenAmountToTransfer = Number(proposal.params.token_amount);
            } 
            // Nếu không có, kiểm tra trong các vị trí khác (được thêm bởi các phiên bản cũ)
            else if (proposal.extraData?.tokenAmount !== undefined) {
              tokenAmountToTransfer = Number(proposal.extraData.tokenAmount);
              // Chuẩn hóa: Cập nhật vào params cho lần sau
              if (!proposal.params) proposal.params = {};
              proposal.params.token_amount = tokenAmountToTransfer;
            }
            
            if (tokenAmountToTransfer <= 0) {
              console.warn("Cảnh báo: Số lượng token cần chuyển là 0 hoặc không xác định.");
            }
            
            console.log(`Số dư token hiện tại: ${tokenBalance}`);
            console.log(`Số lượng token cần chuyển: ${tokenAmountToTransfer}`);
            
            if (tokenBalance < tokenAmountToTransfer) {
              throw new Error(`Số dư token không đủ để thực hiện giao dịch (Cần: ${tokenAmountToTransfer}, Có: ${tokenBalance})`);
            }
          } catch (error) {
            console.error("Lỗi khi kiểm tra số dư token:", error);
            // Tiếp tục thực hiện giao dịch, để Solana kiểm tra khi thực thi
          }
          
          // Kiểm tra xem tài khoản token đích đã tồn tại chưa
          const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
          if (!toTokenAccountInfo) {
            console.log("Tạo tài khoản token đích (to_token_account)...");
            transaction.add(
              createAssociatedTokenAccountInstruction(
                feePayerKeypair.publicKey,  // payer
                toTokenAccount,              // ata
                destinationAddress,          // owner
                tokenMint                    // mint
              )
            );
          }
          
          // 3. Tạo instruction cho execute_token_proposal
          const executeTokenInstruction = new TransactionInstruction({
            keys: [
              { pubkey: new PublicKey(multisigPDA.toString()), isSigner: false, isWritable: true },
              { pubkey: proposalPDA, isSigner: false, isWritable: true },
              { pubkey: feePayerKeypair.publicKey, isSigner: true, isWritable: true },
              { pubkey: destinationAddress, isSigner: false, isWritable: true },
              { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
              { pubkey: toTokenAccount, isSigner: false, isWritable: true },
              { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
              { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: executeData,
          });
          
          transaction.add(executeTokenInstruction);
        } else {
          // Tạo instruction thông thường cho execute_proposal (chuyển SOL hoặc khác)
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
          
          transaction.add(executeInstruction);
        }
        
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
        try {
          const confirmation = await connection.confirmTransaction({
          signature,
          lastValidBlockHeight: await connection.getBlockHeight(),
          blockhash
        }, 'confirmed');
          
          // Kiểm tra xem giao dịch có lỗi không
          if (confirmation.value?.err) {
            console.error("Lỗi xác nhận giao dịch:", confirmation.value.err);
            throw new Error(`Giao dịch thất bại: ${JSON.stringify(confirmation.value.err)}`);
          }
          
          console.log("Giao dịch đã được xác nhận thành công!");
          
          // Create a copy of the proposal with updated status
          const updatedProposal = {
            ...proposal,
            status: "Executed",
            executedAt: Timestamp.now(),
            transactionSignature: signature
          };
          
          // Update the transaction in the current state immediately
          setTransactions(prevTransactions => 
            prevTransactions.map(tx => {
              if (tx.proposal?.proposalId === proposal.proposalId) {
                return {
                  ...tx,
                  status: "Executed",
                  statusColor: getStatusColor("executed"),
                  proposal: updatedProposal
                };
        }
              return tx;
            })
          );
        
        // Cập nhật trạng thái đề xuất trong Firebase
        console.log("Cập nhật trạng thái đề xuất trong Firebase...");
          await updateProposalInFirebase(updatedProposal);
        
        // Tạo explorer URL
        const explorerLink = createExplorerLink(signature);
        
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
        
          // Refresh danh sách sau một khoảng thời gian ngắn
          setTimeout(() => {
        loadProposalsFromFirebase();
          }, 2000);
          
        console.log("=== KẾT THÚC THỰC THI ĐỀ XUẤT ===");
        } catch (confirmError) {
          console.error("Lỗi khi xác nhận giao dịch:", confirmError);
          throw new Error(`Không thể xác nhận giao dịch: ${confirmError instanceof Error ? confirmError.message : 'Lỗi không xác định'}`);
        }
      } catch (txError) {
        console.error("Lỗi trong quá trình xử lý transaction:", txError);
        
        // Phân tích chi tiết lỗi liên quan đến token
        if (isTokenTransfer) {
          const errorMessage = txError instanceof Error ? txError.message : String(txError);
          
          // Xử lý các trường hợp lỗi riêng của token
          if (errorMessage.includes("associated token account")) {
            throw new Error("Lỗi liên quan đến tài khoản token: " + errorMessage);
          }
          else if (errorMessage.includes("insufficient funds")) {
            throw new Error("Số dư token không đủ để thực hiện giao dịch");
          }
        }
        
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
      const handleBlockchainError = (error: unknown): string => {
        let errorMessage = 'Lỗi không xác định';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Kiểm tra lỗi từ blockchain
          if (error.message.includes('custom program error')) {
            // Sử dụng hàm getErrorCodeFromMessage thay vì trực tiếp phân tích regex
            const errorCode = getErrorCodeFromMessage(error.message);
            
            if (errorCode) {
              // Ánh xạ mã lỗi tới thông báo dễ hiểu
              switch (errorCode) {
                case '0x1':
                  return 'Khởi tạo không hợp lệ';
                case '0x7':
                  return 'Không đủ chữ ký để thực thi đề xuất';
                case '0x2':
                  return 'Tham số không hợp lệ';
                case '0x1770': // 0x1770 = 6000
                  return 'Lỗi chương trình: Chủ sở hữu không hợp lệ';
                case '0x1771': // 0x1771 = 6001
                  return 'Lỗi chương trình: Thao tác không hợp lệ';
                case '0x177b': // 0x177b = 6011  
                  return 'Lỗi chương trình: Timestamp thuộc về tương lai';
                case '0x177c': // 0x177c = 6012
                  return 'Lỗi token: Không tìm thấy token mint';
                case '0x177d': // 0x177d = 6013
                  return 'Lỗi token: Số dư không đủ';
                default:
                  return `Lỗi chương trình: ${errorCode}`;
              }
            }
          }
          
          // Xử lý lỗi liên quan đến token
          if (error.message.includes('token')) {
            if (error.message.includes('balance')) {
              return 'Số dư token không đủ để thực hiện giao dịch';
            }
            if (error.message.includes('account')) {
              return 'Lỗi tài khoản token: Tài khoản không tồn tại hoặc không hợp lệ';
            }
            return `Lỗi liên quan đến token: ${error.message}`;
          }
        }
        
        return errorMessage;
      };
      
      const errorMessage = handleBlockchainError(error);
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
      await processProposals(proposalsData, new PublicKey(multisigPDA.toString()));
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

  // Kiểm tra đề xuất đã đạt đủ số chữ ký theo ngưỡng yêu cầu chưa
  const isReadyToExecute = (proposal: Proposal): boolean => {
    const signatureCount = proposal.signers?.length ?? 0;
    const requiredSignatures = proposal.requiredSignatures ?? 0;
    return signatureCount >= requiredSignatures;
  };

  // Kiểm tra số chữ ký còn thiếu
  const getMissingSignatureCount = (proposal: Proposal): number => {
    const signatureCount = proposal.signers?.length ?? 0;
    const requiredSignatures = proposal.requiredSignatures ?? 0;
    return Math.max(0, requiredSignatures - signatureCount);
  };

  // Sửa phần explorer URL để tránh nested ternary
  const createExplorerLink = (signature: string): string => {
    if (process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta') {
      return `https://explorer.solana.com/tx/${signature}`;
    } 
    if (process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet') {
      return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
    }
    return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http://localhost:8899`;
  };

  // Thêm hàm cập nhật trạng thái đề xuất sau khi ký
  const updateProposalStatusAfterSigning = async (proposal: Proposal) => {
    try {
      if (!proposal) return;
      
      // Chuẩn hóa dữ liệu proposal trước khi cập nhật
      if (proposal.action === 'transfer_token') {
        // Đảm bảo params tồn tại
        if (!proposal.params) proposal.params = {};
        
        // Chuẩn hóa token_mint nếu cần
        if (!proposal.params.token_mint) {
          if (typeof proposal.tokenMint === 'string') {
            proposal.params.token_mint = proposal.tokenMint;
            console.log("Normalized token_mint from tokenMint");
          } else if (proposal.extraData?.tokenMint) {
            proposal.params.token_mint = proposal.extraData.tokenMint;
            console.log("Normalized token_mint from extraData");
          }
        }
        
        console.log("Normalized proposal:", {
          action: proposal.action,
          params: proposal.params
        });
      }
      
      const signatureCount = proposal.signers?.length ?? 0;
      const requiredSignatures = proposal.requiredSignatures ?? 0;
      
      // Tự động cập nhật trạng thái nếu đủ chữ ký
      if (signatureCount >= requiredSignatures && proposal.status === "pending") {
        console.log("Proposal has enough signatures, updating status to Ready");
        
        // Sử dụng updateProposalStatus từ lib/firebase/proposalService
        await updateProposalStatus(
          proposal.multisigAddress,
          proposal.proposalId,
          "Ready"
        );
        
        // Tải lại danh sách đề xuất
        await forceReloadProposals();
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái đề xuất sau khi ký:", error);
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex items-center justify-between mb-6"
        initial={{ y: -10 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <Button
          onClick={handleManualRefresh}
          disabled={isLoading}
          className="transition-all hover:scale-105 hover:shadow-md"
        >
          {isLoading ? (
            <span className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </span>
          ) : (
            "Refresh"
          )}
        </Button>
      </motion.div>

      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="text-sm text-muted-foreground font-medium flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          All Transactions
        </div>

        {isLoading && (
          <Card className="p-8 shadow-sm border-border/50">
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary/70" />
              <div className="text-muted-foreground">
                Loading transactions...
              </div>
            </div>
          </Card>
        )}

        {!isLoading && transactions.length === 0 && (
          <Card className="p-8 shadow-sm border-border/50">
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
              <UserPlus className="text-muted-foreground/50 h-12 w-12" />
              <h3 className="text-xl font-medium">No transactions found</h3>
              <p className="text-muted-foreground max-w-md">
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
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.005 }}
            >
              <Card
                className={cn(
                  "hover:bg-accent/30 cursor-pointer p-5 transition-all shadow-sm border-border/50",
                  expandedTransactions.has(transaction.id) && "rounded-b-none border-b-0"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 bg-primary/10 p-2 rounded-full">
                      {transaction.icon}
                    </div>
                    <div>
                      <div className="font-medium">{transaction.type}</div>
                      <div className="text-muted-foreground text-sm">
                        {transaction.type === "Transfer" ? "Transfer SOL" : "New guardian"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className={`text-sm font-medium ${transaction.statusColor}`}>
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
                      className="transition-transform hover:scale-110 hover:bg-accent"
                    >
                      {expandedTransactions.has(transaction.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

              <AnimatePresence>
                {expandedTransactions.has(transaction.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                  >
                      <Card className="bg-muted/30 rounded-t-none p-6 shadow-inner border-t-0 border-border/50">
                        <div className="flex flex-col lg:flex-row gap-8">
                          <div className="space-y-5 flex-1">
                            <h3 className="text-lg font-medium flex items-center">
                              <FileText className="h-4 w-4 mr-2 text-primary/70" />
                              Information
                            </h3>
                            <div className="space-y-3 bg-background rounded-xl p-5 shadow-sm">
                              {transaction.type === "Transfer" ? (
                                <>
                                  <div className="flex flex-col space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2">
                                      <span className="text-muted-foreground font-medium">
                                        From
                                      </span>
                                      <div className="md:col-span-2 text-left md:text-right">
                                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded-md truncate max-w-[180px] inline-block overflow-hidden">
                                          {transaction.proposal?.multisigAddress || "Your wallet"}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2">
                                      <span className="text-muted-foreground font-medium">
                                        To
                                      </span>
                                      <div className="md:col-span-2 text-left md:text-right">
                                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded-md truncate max-w-[180px] inline-block overflow-hidden">
                                          {transaction.proposal?.destination || "Unknown"}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 pt-2 border-t border-border/40">
                                      <span className="text-muted-foreground font-medium">
                                        Amount
                                      </span>
                                      <div className="md:col-span-2 text-left md:text-right">
                                        <span className="font-bold text-lg text-primary">
                                          {(() => {
                                            // For SOL transfers
                                            if (transaction.proposal?.action === 'transfer') {
                                              // Check different possible locations for amount data
                                              const amount = transaction.proposal?.params?.amount || 
                                                            transaction.proposal?.amount || 
                                                            (transaction.proposal?.extraData?.amount as number);
                                              
                                              return amount ? `${amount} SOL` : "Unknown amount";
                                            } 
                                            // For token transfers
                                            else if (transaction.proposal?.action === 'transfer_token') {
                                              // Check different possible locations for token amount data
                                              const tokenAmount = transaction.proposal?.params?.token_amount || 
                                                                transaction.proposal?.extraData?.tokenAmount as number || 
                                                                transaction.proposal?.extraData?.token_amount as number;
                                              
                                              // Get token mint info for display if available
                                              const tokenMint = transaction.proposal?.params?.token_mint || 
                                                               transaction.proposal?.tokenMint || 
                                                               transaction.proposal?.extraData?.tokenMint as string;
                                              
                                              // Display token symbol if available, otherwise just show "Token"
                                              const tokenSymbol = tokenMint ? "Token" : "Token";
                                              
                                              return tokenAmount ? `${tokenAmount} ${tokenSymbol}` : "Unknown amount";
                                            }
                                            // For other transaction types
                                            return "N/A";
                                          })()}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 pt-2 border-t border-border/40">
                                      <span className="text-muted-foreground font-medium">
                                        Created
                                      </span>
                                      <div className="md:col-span-2 text-left md:text-right">
                                        <span className="text-sm">{transaction.details.createdOn}</span>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex flex-col space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2">
                                      <span className="text-muted-foreground font-medium">
                                Guardian ID
                              </span>
                                      <div className="md:col-span-2 text-left md:text-right">
                                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded-md inline-block">
                                          {transaction.details.author}
                                        </span>
                            </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 pt-2 border-t border-border/40">
                                      <span className="text-muted-foreground font-medium">
                                        Created
                              </span>
                                      <div className="md:col-span-2 text-left md:text-right">
                                        <span className="text-sm">{transaction.details.createdOn}</span>
                            </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 pt-2 border-t border-border/40">
                                      <span className="text-muted-foreground font-medium">
                                Invite Code
                              </span>
                                      <div className="md:col-span-2 text-left md:text-right">
                                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded-md inline-block">
                                          {transaction.details.executedOn}
                                        </span>
                            </div>
                                    </div>
                                  </div>
                                </>
                              )}
                              {/* Add Solana Explorer link if there's a transaction signature */}
                            {transaction.proposal?.transactionSignature && transaction.proposal.status === "Executed" && (
                                <div className="flex justify-between items-center pt-3 mt-2 border-t border-border/40">
                                  <span className="text-muted-foreground font-medium">
                                  Signature
                                </span>
                                <a
                                  href={createExplorerLink(transaction.proposal.transactionSignature)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                    className="text-blue-500 underline hover:text-blue-700 font-medium flex items-center"
                                >
                                    <span>View on Solana Explorer</span>
                                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                          <div className="space-y-4 flex-1">
                            <h3 className="text-lg font-medium flex items-center">
                              <ChevronUp className="h-4 w-4 mr-2 text-primary/70" />
                              Actions
                            </h3>

                          {transaction.isPendingGuardian && (
                              <div className="flex justify-end mt-3">
                              <Button
                                onClick={() =>
                                  handleConfirmGuardian(
                                    transaction.guardianData!,
                                  )
                                }
                                  className="transition-all hover:scale-105 hover:shadow-md bg-primary"
                              >
                                Confirm
                              </Button>
                            </div>
                          )}
                          
                          {/* Log debugging info */}
                          {logDebuggingInfo(transaction)}
                          
                            {/* Action buttons for proposal */}
                          {transaction.proposal && transaction.status.toLowerCase() !== "executed" && (
                              <div className="space-y-3 bg-background rounded-xl p-5 shadow-sm">
                                {/* Show notification when signed but threshold not met */}
                              {hasCurrentUserSigned(transaction.proposal) && !isReadyToExecute(transaction.proposal) && (
                                  <div className="text-center text-yellow-600 bg-yellow-50 p-3 rounded-lg text-sm border border-yellow-200 mb-4">
                                    You have signed this proposal. {getMissingSignatureCount(transaction.proposal)} more signature(s) needed for execution.
                                </div>
                              )}
                              
                                {/* Sign proposal button - Only show when not signed AND when proposal is not ready to execute */}
                                {!hasCurrentUserSigned(transaction.proposal) && !isReadyToExecute(transaction.proposal) && (
                                <Button
                                  onClick={() => handleSignProposal(transaction.proposal!)}
                                  disabled={isSigning || (transaction.proposal && transaction.proposal.proposalId === activeProposalId)}
                                    className="transition-all hover:scale-102 hover:shadow-md w-full bg-blue-600 hover:bg-blue-700"
                                >
                                  {isSigning && transaction.proposal && transaction.proposal.proposalId === activeProposalId ? (
                                    <span className="flex items-center justify-center">
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing...
                                    </span>
                                  ) : (
                                      "Sign Proposal"
                                  )}
                                </Button>
                              )}
                              
                                {/* Execute proposal button - Only show when enough signatures */}
                              {isReadyToExecute(transaction.proposal) && (
                                <Button
                                  onClick={() => handleExecuteProposal(transaction.proposal!)}
                                  disabled={isProcessing || (transaction.proposal && transaction.proposal.proposalId === activeProposalId)}
                                    className="transition-all hover:scale-102 hover:shadow-md w-full bg-green-600 hover:bg-green-700"
                                >
                                  {isProcessing && transaction.proposal && transaction.proposal.proposalId === activeProposalId ? (
                                    <span className="flex items-center justify-center">
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Executing...
                                    </span>
                                  ) : (
                                      "Execute Proposal"
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                            
                            {/* Show completed status for executed transactions */}
                            {transaction.proposal && transaction.status.toLowerCase() === "executed" && (
                              <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
                                <div className="flex items-center justify-center space-x-2">
                                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="font-medium text-green-700">Transaction completed successfully</span>
                                </div>
                              </div>
                            )}

                            {/* Signature status section */}
                            <div className="bg-background rounded-xl p-5 shadow-sm">
                              <h4 className="text-sm font-medium mb-3 flex items-center">
                                <ChevronUp className="h-4 w-4 mr-2 text-primary/70" />
                                Signature Status
                              </h4>
                              <div className="flex flex-col space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="bg-green-100 text-green-700 h-8 w-8 rounded-full flex items-center justify-center font-semibold text-sm">
                                      {transaction.details.results.confirmed}
                                    </div>
                                    <span className="text-sm text-muted-foreground">Confirmed</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="bg-red-100 text-red-700 h-8 w-8 rounded-full flex items-center justify-center font-semibold text-sm">
                                      {transaction.details.results.rejected}
                                    </div>
                                    <span className="text-sm text-muted-foreground">Rejected</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                  <span className="text-sm font-medium">Required signatures:</span>
                                  <div className="flex items-center gap-2">
                                    <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-md flex items-center justify-center font-semibold text-sm">
                                      {transaction.details.results.threshold}
                                    </div>
                                    {transaction.proposal && transaction.status.toLowerCase() !== "executed" && (
                                      <span className="text-sm text-muted-foreground">
                                        ({getMissingSignatureCount(transaction.proposal)} more needed)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
              </Card>
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