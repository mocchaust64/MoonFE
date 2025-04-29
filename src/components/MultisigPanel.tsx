import { useState, useEffect, FC } from "react";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SYSVAR_CLOCK_PUBKEY,
  Connection,
  TransactionInstruction
} from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import {
  findMultisigWallet,
  loadProposals,
} from "@/utils/multisigUtils";
import {
  getWebAuthnAssertion,
  derToRaw,
} from "@/utils/webauthnUtils";
import {
  createSecp256r1Instruction, normalizeSignatureToLowS
} from "@/lib/solana/secp256r1";
import { createActionParams } from "@/types/transaction";
import { getWalletByCredentialId } from "@/lib/firebase/webAuthnService";
import { getGuardianPDA } from "@/utils/credentialUtils";
import { PROGRAM_ID } from "@/lib/solana/index";
import { Timestamp } from "firebase/firestore";
import {
  createProposal,
  addSignerToProposal,
  updateProposalStatus,
  getProposalById,
} from "@/lib/firebase/proposalService";
import { createApproveProposalTx } from "@/utils/proposalSigning";

import { useRouter } from 'next/navigation';
import { useWalletInfo } from "@/hooks/useWalletInfo";
// Props interface
interface MultisigPanelProps {
  credentialId: Uint8Array;
  connection: Connection;
}

// Thêm interface cho proposal params
interface ProposalTransactionParams {
  verificationData: Uint8Array;
  webAuthnPubKey: Buffer;
  normalizedSignature: Buffer;
  proposalId: BN;
  multisigPDA: PublicKey;
  guardianId: BN;
  description: string;
  destinationPubkey: PublicKey;
  amountLamports: BN;
}

export const MultisigPanel: FC<MultisigPanelProps> = ({
  credentialId,
  connection,
}) => {
  const [showMultisigPanel, setShowMultisigPanel] = useState<boolean>(false);
  const [showProposalForm, setShowProposalForm] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [multisigAddress, setMultisigAddress] = useState<PublicKey | null>(
    null
  );
  const [program] = useState<Program | null>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [multisigInfo, setMultisigInfo] = useState<any>(null);
  const [payerKeypair] = useState<any>(null);

  // Form state cho tạo đề xuất
  const [destinationAddress, setDestinationAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("0.1");
  const [description, setDescription] = useState<string>("Chuyển SOL");
  // Thêm state isUsingFirebase
  const [isUsingFirebase] = useState<boolean>(true);
  const {threshold} = useWalletInfo();
  const router = useRouter();

  // Thêm hàm để chuyển đổi trạng thái hiển thị form tạo đề xuất
  const toggleProposalForm = () => {
    setShowProposalForm(prev => !prev);
  };

  // Khởi tạo
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setStatus("Đang khởi tạo...");

        // Kiểm tra kết nối đến validator
        try {
          const blockHeight = await connection.getBlockHeight();
          console.log(
            "Kết nối thành công đến validator. Block height:",
            blockHeight
          );
          setStatus(
            (prev) =>
              `${prev}\nĐã kết nối thành công đến validator. Block height: ${blockHeight}`
          );
        } catch (connError) {
          console.error("Lỗi kết nối đến validator:", connError);
          setStatus(
            (prev) =>
              `${prev}\nLỗi kết nối đến validator: ${
                connError instanceof Error
                  ? connError.message
                  : String(connError)
              }`
          );
        }

        // Tìm địa chỉ ví multisig ngay cả khi program chưa được khởi tạo
        const credentialIdBase64 = Buffer.from(credentialId).toString("base64");
        await findWallet(credentialIdBase64, null);
      } catch (error) {
        console.error("Lỗi khi khởi tạo:", error);
        setStatus(
          `Lỗi: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [credentialId, connection, isUsingFirebase]);

  // Tìm ví đa chữ ký
  const findWallet = async (
    credentialIdBase64: string,
    prog: Program | null
  ) => {
    try {
      setIsLoading(true);
      setStatus("Đang tìm ví đa chữ ký...");

      const result = await findMultisigWallet(credentialIdBase64, prog as any, {
        onProgress: (msg) => setStatus((prev) => `${prev}\n${msg}`),
        onError: (err) => setStatus((prev) => `${prev}\nLỗi: ${err}`),
        onSuccess: (data) => {
          setMultisigInfo(data);
          setMultisigAddress(data.address);

          // Thêm log để hiển thị thông tin threshold
          if (data.threshold !== undefined) {
            console.log(`Đã tìm thấy thông tin ngưỡng ký: ${data.threshold}`);
            setStatus(
              (prev) =>
                `${prev}\nĐã tìm thấy ví đa chữ ký: ${data.address}\nNgưỡng ký: ${data.threshold}`
            );
          } else {
            console.warn("CẢNH BÁO: Không tìm thấy thông tin ngưỡng ký!");
            setStatus(
              (prev) =>
                `${prev}\nĐã tìm thấy ví đa chữ ký: ${data.address}\nCẢNH BÁO: Không tìm thấy thông tin ngưỡng ký!`
            );
          }

          // Hiển thị form multisig khi tìm thấy ví
          setShowMultisigPanel(true);

          // Nếu tìm thấy, tải danh sách đề xuất
          if (data.pubkey && prog) {
            loadMultisigProposals(data.pubkey, prog);
          }
        },
      });

      return result;
    } catch (error) {
      console.error("Lỗi khi tìm ví:", error);
      setStatus(
        `Lỗi: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Tải danh sách đề xuất
  const loadMultisigProposals = async (
    multisigPubkey: PublicKey,
    prog: Program | null
  ) => {
    try {
      setIsLoading(true);
      setStatus("Đang tải danh sách đề xuất...");

      await loadProposals(multisigPubkey, {
        onProgress: (msg) => setStatus((prev) => `${prev}\n${msg}`),
        onError: (err) => setStatus(`Lỗi: ${err}`),
        onSuccess: (data) => {
          setProposals(data);
          setStatus((prev) => `${prev}\nĐã tải ${data.length} đề xuất.`);

          // Tải lại danh sách đề xuất
          if (prog && multisigInfo?.pubkey) {
            setTimeout(() => {
              loadMultisigProposals(multisigInfo.pubkey, prog);
            }, 2000);
          }
        },
      });
    } catch (error) {
      console.error("Lỗi khi tải đề xuất:", error);
      setStatus(
        `Lỗi: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm helper để lấy WebAuthn public key từ Firebase hoặc localStorage
  const getWebAuthnPublicKey = async (credentialIdHex: string): Promise<Buffer> => {
      console.log("Lấy WebAuthn public key...");

      // Thử tìm trong Firebase
      const credentialMapping = await getWalletByCredentialId(credentialIdHex);

    if (!credentialMapping?.guardianPublicKey?.length) {
        // Thử tìm trong localStorage
      console.log("Không tìm thấy trong Firebase, thử tìm trong localStorage...");
        const localStorageData = localStorage.getItem(
          "webauthn_credential_" + credentialIdHex
        );
      
        if (localStorageData) {
          const localMapping = JSON.parse(localStorageData);
        if (localMapping?.guardianPublicKey?.length) {
          return Buffer.from(new Uint8Array(localMapping.guardianPublicKey));
        }
      }
      
          throw new Error("Không tìm thấy WebAuthn public key");
        }
    
        // Sử dụng WebAuthn public key từ Firebase
    return Buffer.from(new Uint8Array(credentialMapping.guardianPublicKey));
  };

  // Hàm helper để tạo verification data từ WebAuthn assertion
  const createVerificationDataFromAssertion = async (assertion: any) => {
    // Tính hash của clientDataJSON
    const clientDataHash = await crypto.subtle.digest(
      "SHA-256",
      assertion.clientDataJSON
    );
    const clientDataHashBytes = new Uint8Array(clientDataHash);
    
    // Tạo verification data: authenticatorData + hash(clientDataJSON)
    const verificationData = new Uint8Array(
      assertion.authenticatorData.length + clientDataHashBytes.length
    );
    verificationData.set(new Uint8Array(assertion.authenticatorData), 0);
    verificationData.set(
      clientDataHashBytes,
      assertion.authenticatorData.length
    );
    
    return verificationData;
  };

  // Hàm xử lý WebAuthn assertion và tạo chữ ký
  const processWebAuthnAssertion = async (
    credentialIdString: string,
    webAuthnPubKey: Buffer
  ): Promise<{
    verificationData: Uint8Array;
    normalizedSignature: Buffer;
  }> => {
    // 1. Lấy xác thực WebAuthn
      const assertion = await getWebAuthnAssertion(
        credentialIdString,
        undefined,
        true
      );
    
      if (!assertion) {
        throw new Error("Không thể lấy WebAuthn assertion");
      }

      setStatus((prev) => `${prev}\nĐã lấy xác thực WebAuthn thành công.`);

    // 2. Chuyển đổi chữ ký DER sang raw và chuẩn hóa
        const signatureRaw = derToRaw(Buffer.from(assertion.signature));
        const signatureBuffer = Buffer.from(signatureRaw);
    const normalizedSignature = normalizeSignatureToLowS(signatureBuffer);
    
    // 3. Tạo verification data
    const verificationData = await createVerificationDataFromAssertion(assertion);
    
    return {
      verificationData,
      normalizedSignature
    };
  };

  // Hàm tạo transaction cho đề xuất
  const buildTransactionForProposal = async (
    params: ProposalTransactionParams
  ): Promise<Transaction> => {
    // 1. Tạo secp256r1 instruction
        const secp256r1Instruction = createSecp256r1Instruction(
      Buffer.from(params.verificationData),
      params.webAuthnPubKey,
      params.normalizedSignature,
          false
        );

    // 2. Tính PDA cho guardian
    const guardianPubkey = getGuardianPDA(
      params.multisigPDA,
      params.guardianId.toNumber()
    );

    // 3. Tính PDA cho proposal
    const [proposalPubkey] = PublicKey.findProgramAddressSync(
            [
              Buffer.from("proposal"),
        params.multisigPDA.toBuffer(),
        params.proposalId.toArrayLike(Buffer, "le", 8),
            ],
            PROGRAM_ID
          );

    // 4. Tạo ActionParams
          const actionParams = createActionParams(
      params.amountLamports,
      params.destinationPubkey
          );

    // 5. Tạo transaction mới và thêm secp256r1 instruction
          const transaction = new Transaction();
          transaction.add(secp256r1Instruction);

    // 6. Tạo instruction cho create_proposal
          const createProposalDiscriminator = new Uint8Array([
            132, 116, 68, 174, 216, 160, 198, 22,
          ]);

    // 7. Tạo và encode dữ liệu theo định dạng Anchor
          const parts = [Buffer.from(createProposalDiscriminator)];

    // 7.1. proposal_id (u64 - 8 bytes)
    parts.push(Buffer.from(params.proposalId.toArrayLike(Buffer, "le", 8)));

    // 7.2. description (string - 4 byte độ dài + nội dung)
    const descriptionBuffer = Buffer.from(params.description);
          const descriptionLenBuffer = Buffer.alloc(4);
          descriptionLenBuffer.writeUInt32LE(descriptionBuffer.length, 0);
          parts.push(descriptionLenBuffer);
          parts.push(descriptionBuffer);

    // 7.3. proposer_guardian_id (u64 - 8 bytes)
    parts.push(Buffer.from(params.guardianId.toArrayLike(Buffer, "le", 8)));

    // 7.4. action (string - 4 byte độ dài + nội dung)
          const actionBuffer = Buffer.from("transfer");
          const actionLenBuffer = Buffer.alloc(4);
          actionLenBuffer.writeUInt32LE(actionBuffer.length, 0);
          parts.push(actionLenBuffer);
          parts.push(actionBuffer);

    // 7.5. params (ActionParams)
    // 7.5.1. amount (option<u64>)
          if (actionParams.amount) {
            parts.push(Buffer.from([1])); // Some variant
            parts.push(
              Buffer.from(actionParams.amount.toArrayLike(Buffer, "le", 8))
            );
          } else {
            parts.push(Buffer.from([0])); // None variant
          }

    // 7.5.2. destination (option<publicKey>)
          if (actionParams.destination) {
            parts.push(Buffer.from([1])); // Some variant
            parts.push(Buffer.from(actionParams.destination.toBuffer()));
          } else {
            parts.push(Buffer.from([0])); // None variant
          }

    // 7.5.3. tokenMint (option<publicKey>)
          if (actionParams.tokenMint) {
            parts.push(Buffer.from([1])); // Some variant
            parts.push(Buffer.from(actionParams.tokenMint.toBuffer()));
          } else {
            parts.push(Buffer.from([0])); // None variant
          }

    // 8. Nối tất cả các phần lại để tạo thành data instruction hoàn chỉnh
          const data = Buffer.concat(parts);

    // 9. Thêm instruction vào transaction
          transaction.add(
            new TransactionInstruction({
              keys: [
          { pubkey: params.multisigPDA, isSigner: false, isWritable: true },
                { pubkey: proposalPubkey, isSigner: false, isWritable: true },
                { pubkey: guardianPubkey, isSigner: false, isWritable: false }, // proposer_guardian
                {
                  pubkey: payerKeypair.publicKey,
                  isSigner: true,
                  isWritable: true,
                },
                {
                  pubkey: SYSVAR_CLOCK_PUBKEY,
                  isSigner: false,
                  isWritable: false,
                },
                {
                  pubkey: SystemProgram.programId,
                  isSigner: false,
                  isWritable: false,
                },
              ],
              programId: PROGRAM_ID,
              data,
            })
          );

    return transaction;
  };

  // Hàm lưu đề xuất vào Firebase
  const saveProposalToFirebase = async (
    proposalId: BN,
    multisigPDAObj: PublicKey,
    description: string,
    amountLamports: BN,
    destinationPubkey: PublicKey,
    transactionSignature: string,
    threshold: number
  ): Promise<void> => {
              const proposalData = {
                proposalId: proposalId.toNumber(),
                multisigAddress: multisigPDAObj.toString(),
                description: description,
                action: "transfer",
                status: "pending",
                createdAt: Timestamp.now(),
                creator: payerKeypair.publicKey.toString(),
                signers: [], // Không tự động coi người tạo đã ký, để họ ký riêng như các guardian khác
      requiredSignatures: threshold,
                amount: amountLamports.toNumber(),
                destination: destinationPubkey.toString(),
                tokenMint: null,
      transactionSignature: transactionSignature,
              };

              console.log("Lưu proposal vào Firebase:", proposalData);

              try {
                // Sử dụng service để lưu đề xuất
                const docId = await createProposal(proposalData);
                console.log(
                  "Đã lưu proposal vào Firebase thành công, ID:",
                  docId
                );
              } catch (firebaseError) {
                console.error(
                  "Lỗi khi lưu proposal vào Firebase:",
                  firebaseError
                );
                // Không throw error ở đây vì transaction đã thành công
                // Chỉ log lỗi để debug
              }
  };

  // Hàm xử lý lỗi giao dịch
  const handleTransactionError = (error: unknown): string => {
    console.error("Lỗi khi xác nhận giao dịch:", error);

    // Xử lý lỗi
    if (error instanceof Error) {
      const errorMessage = error.message;
                let logs: string[] = [];

                // @ts-ignore - Truy cập thuộc tính logs nếu có
      if (error.logs) {
                  // @ts-ignore
        logs = error.logs;
                }

                console.error("Transaction logs:", logs);

                // Phân tích thông tin lỗi để hiển thị thông báo cụ thể
                if (errorMessage.includes("custom program error: 0x2")) {
        return "Lỗi tham số không hợp lệ (custom program error: 0x2). Có thể do:\n- Sai địa chỉ đích\n- Sai số lượng SOL\n- Guardian không có quyền tạo đề xuất";
                } else if (errorMessage.includes("custom program error: 0x1")) {
        return "Lỗi khởi tạo sai (custom program error: 0x1)";
                } else if (errorMessage.includes("custom program error: 0x3")) {
        return "Lỗi đề xuất đã tồn tại (custom program error: 0x3)";
                } else {
        return `Lỗi: ${errorMessage}`;
                }
              } else {
      return "Giao dịch thất bại với lỗi không xác định";
    }
  };

  // Tạo đề xuất giao dịch
  const handleCreateProposal = async () => {
    try {
      setIsLoading(true);
      setStatus("Đang tạo đề xuất giao dịch...");

      // Kiểm tra đầu vào
      if (!destinationAddress) {
        throw new Error("Vui lòng nhập địa chỉ đích");
      }

      if (!amount || parseFloat(amount) <= 0) {
        throw new Error("Vui lòng nhập số lượng SOL hợp lệ");
      }

      if (!multisigAddress || !payerKeypair) {
        throw new Error(
          "Vui lòng đảm bảo ví đa chữ ký và keypair đã được khởi tạo"
        );
      }

      setStatus((prev) => `${prev}\nĐang yêu cầu xác thực WebAuthn...`);

      // 1. Lấy WebAuthn public key
      const credentialIdHex = Buffer.from(credentialId).toString("hex");
      const webAuthnPubKey = await getWebAuthnPublicKey(credentialIdHex);
      
      // 2. Xử lý WebAuthn assertion
      const credentialIdString = Buffer.from(credentialId).toString("hex");
      const { verificationData, normalizedSignature } = 
          await processWebAuthnAssertion(credentialIdString, webAuthnPubKey);

      // 3. Chuẩn bị các thông số cần thiết
      const proposalId = new BN(Date.now());
      const guardianId = new BN(1); // Mặc định là 1 (owner)
      const multisigPDAObj = new PublicKey(multisigAddress.toString());
      const destinationPubkey = new PublicKey(destinationAddress);
      const amountLamports = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);

      // 4. Tạo và cấu hình transaction
      const transaction = await buildTransactionForProposal({
        verificationData,
        webAuthnPubKey,
        normalizedSignature,
        proposalId,
        multisigPDA: multisigPDAObj,
        guardianId,
        description,
        destinationPubkey,
        amountLamports,
      });

      // 5. Gửi transaction
      transaction.feePayer = payerKeypair.publicKey;
      const latestBlockhash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = latestBlockhash.blockhash;
      
      try {
        // Ký và gửi transaction
        transaction.sign(payerKeypair);
        
        // Sử dụng version API mới không bị deprecated
        const signature = await connection.sendRawTransaction(
          transaction.serialize(),
          {
            preflightCommitment: "confirmed",
          }
        );
        
        // Xác nhận transaction
        await connection.confirmTransaction({
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        });

        // 6. Lưu đề xuất vào Firebase
        await saveProposalToFirebase(
          proposalId,
          multisigPDAObj,
          description,
          amountLamports,
          destinationPubkey,
          signature,
          threshold
        );

        // 7. Cập nhật UI và làm mới danh sách đề xuất
        setStatus(`Đã tạo đề xuất thành công! Signature: ${signature}`);
        setShowProposalForm(false);

        if (program && multisigInfo?.pubkey) {
          setTimeout(() => {
            loadMultisigProposals(multisigInfo.pubkey, program);
          }, 2000);
        }
      } catch (confirmError) {
        const errorDetail = handleTransactionError(confirmError);
        setStatus(`Giao dịch thất bại: ${errorDetail}`);
      }
    } catch (error) {
      console.error("Lỗi khi tạo đề xuất:", error);
      setStatus(
        `Lỗi: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm phê duyệt đề xuất
  const handleApproveProposal = async (
    proposalId: string,
  ) => {
    try {
      setIsLoading(true);
      setStatus("Đang chuẩn bị phê duyệt đề xuất...");

      // Kiểm tra điều kiện cần thiết
      if (!multisigInfo || !payerKeypair) {
        throw new Error("Thông tin ví multisig hoặc keypair không khả dụng");
      }

      // 1. Lấy thông tin xác thực
      const credentialIdString = Buffer.from(credentialId).toString("hex");
      
      // 2. Lấy thông tin đề xuất từ Firebase để đảm bảo dữ liệu mới nhất
      const proposal = await getProposalById(multisigInfo.pubkey.toString(), parseInt(proposalId));
      if (!proposal) {
        throw new Error("Không tìm thấy thông tin đề xuất");
      }

      // 3. Tính PDA cho proposal
      const [proposalPubkey] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("proposal"),
          multisigInfo.pubkey.toBuffer(),
          new BN(parseInt(proposalId)).toArrayLike(Buffer, "le", 8)
        ],
        PROGRAM_ID
      );

      // 4. Tính PDA cho guardian
      const guardianId = 1; // Mặc định là 1 (owner)
      const guardianPDA = getGuardianPDA(multisigInfo.pubkey, guardianId);

      // 5. Lấy thông tin từ WebAuthn assertion
      const credential = await getWebAuthnAssertion(credentialIdString, undefined, true);
      if (!credential) {
        throw new Error("Không thể lấy WebAuthn assertion");
      }

      setStatus((prev) => `${prev}\nĐã lấy xác thực WebAuthn thành công.`);
      
      const signature = new Uint8Array(credential.signature);
      const authenticatorData = new Uint8Array(credential.authenticatorData);
      const clientDataJSON = new Uint8Array(credential.clientDataJSON);

      // 6. Tạo transaction approve proposal
      const timestamp = Math.floor(Date.now() / 1000);
      const tx = await createApproveProposalTx({
        proposalPubkey,
        multisigPDA: multisigInfo.pubkey,
        guardianPDA,
        guardianId,
        feePayer: payerKeypair.publicKey,
        webauthnSignature: signature,
        authenticatorData,
        clientDataJSON,
        proposalId: parseInt(proposalId),
        timestamp,
        credentialId: credentialIdString
      });

      // 7. Thiết lập và gửi transaction
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.feePayer = payerKeypair.publicKey;
      tx.partialSign(payerKeypair);

      try {
        // Gửi transaction
        const txId = await connection.sendRawTransaction(tx.serialize(), {
            preflightCommitment: "confirmed",
        });

        // Xác nhận transaction
        await connection.confirmTransaction({
          signature: txId,
          blockhash: tx.recentBlockhash,
          lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
        });

        // 8. Cập nhật UI và dữ liệu
        setStatus(`Đã phê duyệt đề xuất thành công! TxID: ${txId}`);
        loadMultisigProposals(multisigInfo.pubkey, program);

        // 9. Cập nhật danh sách chữ ký trong Firebase
        try {
          await addSignerToProposal(
            multisigInfo.pubkey.toString(),
            parseInt(proposalId),
            payerKeypair.publicKey.toString()
          );
          console.log(
            `Đã thêm ${payerKeypair.publicKey.toString()} vào danh sách người ký của đề xuất ${proposalId}`
          );
        } catch (firebaseError) {
          console.error(
            "Lỗi khi cập nhật danh sách chữ ký trên Firebase:",
            firebaseError
          );
        }
      } catch (txError) {
        const errorDetail = handleTransactionError(txError);
        setStatus(`Lỗi khi gửi giao dịch: ${errorDetail}`);
      }
    } catch (error) {
      console.error("Lỗi khi phê duyệt đề xuất:", error);
      setStatus(
        `Lỗi: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm thực thi đề xuất
  const handleExecuteProposal = async (
    proposalId: string,
    proposalPubkey: PublicKey
  ) => {
    try {
      setIsLoading(true);
      setStatus("Đang chuẩn bị thực thi đề xuất...");

      // Kiểm tra điều kiện cần thiết
      if (!multisigInfo || !payerKeypair) {
        throw new Error("Thông tin ví multisig hoặc keypair không khả dụng");
      }

      // 1. Lấy thông tin xác thực
      const credentialIdString = Buffer.from(credentialId).toString("hex");
      const webAuthnPubKey = await getWebAuthnPublicKey(credentialIdString);
      
      // 2. Lấy thông tin WebAuthn assertion
      const credential = await getWebAuthnAssertion(credentialIdString, undefined, true);
      if (!credential) {
        throw new Error("Không thể lấy WebAuthn assertion");
      }
      
      setStatus((prev) => `${prev}\nĐã lấy xác thực WebAuthn thành công.`);

      // Tạo verificationData từ assertion
      const clientDataHash = await crypto.subtle.digest(
        "SHA-256",
        credential.clientDataJSON
      );
      const clientDataHashBytes = new Uint8Array(clientDataHash);

      const verificationData = new Uint8Array(
        credential.authenticatorData.length + clientDataHashBytes.length
      );
      verificationData.set(new Uint8Array(credential.authenticatorData), 0);
      verificationData.set(
        clientDataHashBytes,
        credential.authenticatorData.length
      );
      
      // Chuyển đổi chữ ký DER sang raw và chuẩn hóa
      const signatureRaw = derToRaw(Buffer.from(credential.signature));
      const signatureBuffer = Buffer.from(signatureRaw);
      const normalizedSignature = normalizeSignatureToLowS(signatureBuffer);

      // 3. Tạo instruction secp256r1
      const secp256r1Instruction = createSecp256r1Instruction(
        Buffer.from(verificationData),
        webAuthnPubKey,
        normalizedSignature
      );

      // 4. Tạo transaction
      const transaction = new Transaction();
      transaction.add(secp256r1Instruction);

      // 5. Tạo discriminator từ IDL cho hàm execute_proposal
      const executeProposalDiscriminator = Buffer.from([186, 60, 116, 133, 108, 128, 111, 28]);
      
      // 6. Tạo dữ liệu cho tham số proposal_id
      const proposalIdBuffer = Buffer.alloc(8);
      proposalIdBuffer.writeBigUInt64LE(BigInt(parseInt(proposalId)), 0);
      
      // 7. Tạo data instruction với proposal_id
      const executeData = Buffer.concat([
        executeProposalDiscriminator,
        proposalIdBuffer
      ]);

      // 8. Lấy thông tin đề xuất từ Firebase
      const proposal = await getProposalById(multisigInfo.pubkey.toString(), parseInt(proposalId));
      if (!proposal) {
        throw new Error("Không tìm thấy thông tin đề xuất");
      }

      // 9. Tạo instruction thực thi đề xuất
      const destinationPubkey = proposal.destination 
        ? new PublicKey(proposal.destination) 
        : SystemProgram.programId;

      const executeInstruction = new TransactionInstruction({
        keys: [
          { pubkey: multisigInfo.pubkey, isSigner: false, isWritable: true }, // multisig
          { pubkey: proposalPubkey, isSigner: false, isWritable: true }, // proposal
          { pubkey: payerKeypair.publicKey, isSigner: true, isWritable: true }, // payer
          { pubkey: destinationPubkey, isSigner: false, isWritable: true }, // destination
          { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // clock
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ],
        programId: PROGRAM_ID,
        data: executeData,
      });
      
      // 10. Thêm instruction thực thi đề xuất vào transaction
      transaction.add(executeInstruction);

      // 11. Thiết lập và gửi transaction
      transaction.feePayer = payerKeypair.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.sign(payerKeypair);

      try {
        // Gửi transaction
        const txId = await connection.sendRawTransaction(
          transaction.serialize(),
          {
            preflightCommitment: "confirmed",
          }
        );

        // Xác nhận transaction
        await connection.confirmTransaction({
          signature: txId,
          blockhash: blockhash,
          lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
        });

        // 12. Cập nhật UI và dữ liệu
        setStatus(`Đã thực thi đề xuất thành công! TxID: ${txId}`);
        loadMultisigProposals(multisigInfo.pubkey, program);

        // 13. Cập nhật trạng thái đề xuất trong Firebase
        try {
          await updateProposalStatus(
            multisigInfo.pubkey.toString(),
            parseInt(proposalId),
            "executed",
            txId
          );
          console.log(
            `Đã cập nhật trạng thái đề xuất ${proposalId} thành 'executed'`
          );
        } catch (firebaseError) {
          console.error(
            "Lỗi khi cập nhật trạng thái đề xuất trên Firebase:",
            firebaseError
          );
        }
      } catch (txError) {
        const errorDetail = handleTransactionError(txError);
        setStatus(`Lỗi khi gửi giao dịch: ${errorDetail}`);
      }
    } catch (error) {
      console.error("Lỗi khi thực thi đề xuất:", error);
      setStatus(
        `Lỗi: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm định dạng trạng thái đề xuất
  const formatProposalStatus = (status: string) => {
    switch (status) {
      case "Pending":
        return "Đang chờ";
      case "Executed":
        return "Đã thực thi";
      case "Rejected":
        return "Đã từ chối";
      case "Expired":
        return "Đã hết hạn";
      default:
        return status;
    }
  };

  // Hàm điều hướng đến trang danh sách đề xuất
  const goToProposalList = () => {
    router.push('/proposals');
  };

  // Khi tìm thấy multisig address thành công, lưu vào localStorage
  useEffect(() => {
    if (multisigAddress) {
      // Lưu địa chỉ ví vào localStorage để sử dụng ở các trang khác
      localStorage.setItem("multisigAddress", multisigAddress.toString());
      console.log(
        "MultisigPanel: Đã lưu địa chỉ ví vào localStorage:",
        multisigAddress.toString()
      );
    }
  }, [multisigAddress]);

  return (
    <div>
      <h2>Ví Đa Chữ Ký</h2>

      {isLoading ? (
        <p>Đang tải...</p>
      ) : (
        <>
          {status && (
            <div>
              <pre>{status}</pre>
            </div>
          )}

          {showMultisigPanel && multisigAddress && (
            <>
              <div>
                <label htmlFor="wallet-address">Địa chỉ ví:</label>
                <div id="wallet-address">{multisigAddress.toString()}</div>
              </div>

              <div>
                <button
                  onClick={goToProposalList}
                >
                  Xem Danh Sách Đề Xuất
                </button>
                <button
                  onClick={toggleProposalForm}
                >
                  {showProposalForm ? "Ẩn Form Tạo Đề Xuất" : "Tạo Đề Xuất Mới"}
                </button>
              </div>

              {showProposalForm && (
                <div>
                  <h3>Tạo Đề Xuất Mới</h3>
                  <div>
                    <label htmlFor="destination-address">Địa chỉ nhận:</label>
                    <input
                      id="destination-address"
                      type="text"
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      placeholder="Địa chỉ ví nhận SOL"
                    />
                  </div>

                  <div>
                    <label htmlFor="amount">Số lượng SOL:</label>
                    <input
                      id="amount"
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Số lượng SOL"
                    />
                  </div>

                  <div>
                    <label htmlFor="description">Mô tả:</label>
                    <input
                      id="description"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Mô tả giao dịch"
                    />
                  </div>

                  <button
                    onClick={handleCreateProposal}
                    disabled={isLoading}
                  >
                    Tạo Đề Xuất Chuyển Tiền
                  </button>
                </div>
              )}

              {proposals.length > 0 && (
                <div>
                  <h3>Danh Sách Đề Xuất</h3>
                  {proposals.map((proposal) => (
                    <div key={`proposal-${proposal.id}`}>
                      <div>
                        <div>
                          {proposal.description}
                        </div>
                        <div>
                          {formatProposalStatus(proposal.status)}
                        </div>
                      </div>

                      <div>
                        <p>ID: {proposal.id}</p>
                        <p>
                          Chữ ký: {proposal.signaturesCount}/
                          {proposal.requiredSignatures}
                        </p>
                        <p>Tạo lúc: {proposal.createdAt}</p>
                        <p>
                          Địa chỉ nhận:{" "}
                          {proposal.params.destination?.toString()}
                        </p>
                        <p>
                          Số lượng:{" "}
                          {proposal.params.amount
                            ? proposal.params.amount / LAMPORTS_PER_SOL
                            : 0}{" "}
                          SOL
                        </p>
                      </div>

                      {proposal.status === "Pending" && (
                        <div>
                          <button
                            onClick={() =>
                              handleApproveProposal(
                                proposal.id,
                              )
                            }
                          >
                            Phê Duyệt
                          </button>

                          <button
                            onClick={() =>
                              console.log("Từ chối đề xuất", proposal.id)
                            }
                          >
                            Từ Chối
                          </button>

                          {proposal.signaturesCount >=
                            proposal.requiredSignatures && (
                            <button
                              onClick={() =>
                                handleExecuteProposal(
                                  proposal.id,
                                  proposal.pubkey
                                )
                              }
                            >
                              Thực Thi
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
