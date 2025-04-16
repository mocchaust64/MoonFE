import { useState, useEffect, FC } from "react";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SYSVAR_CLOCK_PUBKEY
} from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import {
  findMultisigWallet,
  loadProposals,
} from "@/utils/multisigUtils";
import { Connection } from "@solana/web3.js";
import {
  getWebAuthnAssertion,
  createWebAuthnVerificationData,
  derToRaw,
} from "@/utils/webauthnUtils";
import {
  createSecp256r1Instruction, normalizeSignatureToLowS
} from "@/lib/solana/secp256r1";
import { createActionParams } from "@/types/transaction";
import { getWalletByCredentialId } from "@/lib/firebase/webAuthnService";
import { getGuardianPDA } from "@/utils/credentialUtils";
import { TransactionInstruction } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/solana/index";
import { Timestamp } from "firebase/firestore";
import {
  createProposal,
  addSignerToProposal,
  updateProposalStatus,
} from "@/lib/firebase/proposalService";
import { sha256 } from "@noble/hashes/sha256";
import { useRouter } from 'next/navigation';
import { useWalletInfo } from "@/hooks/useWalletInfo";
// Props interface
interface MultisigPanelProps {
  credentialId: Uint8Array;
  connection: Connection;
}

export const MultisigPanel: FC<MultisigPanelProps> = ({
  credentialId,
  connection,
}) => {
  const [showTransferForm, setShowTransferForm] = useState<boolean>(false);
  const [showMultisigPanel, setShowMultisigPanel] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [multisigAddress, setMultisigAddress] = useState<PublicKey | null>(
    null
  );
  const [program, setProgram] = useState<Program | null>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [multisigInfo, setMultisigInfo] = useState<any>(null);
  const [payerKeypair, setPayerKeypair] = useState<any>(null);

  // Form state cho tạo đề xuất
  const [showProposalForm, setShowProposalForm] = useState<boolean>(false);
  const [destinationAddress, setDestinationAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("0.1");
  const [description, setDescription] = useState<string>("Chuyển SOL");
  // Thêm state isUsingFirebase
  const [isUsingFirebase] = useState<boolean>(true);
  const {threshold} = useWalletInfo();
  const router = useRouter();

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

          // Mặc định hiển thị form chuyển tiền khi tìm thấy ví
          setShowTransferForm(true);

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

      // LẤY WEBAUTHN PUBLIC KEY THẬT TỪ FIREBASE
      console.log("Lấy WebAuthn public key...");
      let webAuthnPubKey: Buffer;

      // Chuyển đổi credentialId từ Uint8Array sang string hex
      const credentialIdHex = Buffer.from(credentialId).toString("hex");
      console.log("CredentialId hex:", credentialIdHex);

      // Thử tìm trong Firebase
      const credentialMapping = await getWalletByCredentialId(credentialIdHex);

      if (
        !credentialMapping ||
        !credentialMapping.guardianPublicKey ||
        credentialMapping.guardianPublicKey.length === 0
      ) {
        // Thử tìm trong localStorage
        console.log(
          "Không tìm thấy trong Firebase, thử tìm trong localStorage..."
        );
        const localStorageData = localStorage.getItem(
          "webauthn_credential_" + credentialIdHex
        );
        if (localStorageData) {
          const localMapping = JSON.parse(localStorageData);
          if (
            localMapping &&
            localMapping.guardianPublicKey &&
            localMapping.guardianPublicKey.length > 0
          ) {
            webAuthnPubKey = Buffer.from(
              new Uint8Array(localMapping.guardianPublicKey)
            );
          } else {
            throw new Error(
              "Không tìm thấy WebAuthn public key trong localStorage"
            );
          }
        } else {
          throw new Error("Không tìm thấy WebAuthn public key");
        }
      } else {
        // Sử dụng WebAuthn public key từ Firebase
        webAuthnPubKey = Buffer.from(
          new Uint8Array(credentialMapping.guardianPublicKey)
        );
      }

      console.log(
        "Đã lấy được WebAuthn public key thật:",
        webAuthnPubKey.toString("hex")
      );

      // 1. Lấy xác thực WebAuthn - đảm bảo hoạt động đúng với chữ ký
      const credentialIdString = Buffer.from(credentialId).toString("hex");
      console.log("Yêu cầu chữ ký với credential ID:", credentialIdString);

      const assertion = await getWebAuthnAssertion(
        credentialIdString,
        undefined,
        true
      );
      if (!assertion) {
        throw new Error("Không thể lấy WebAuthn assertion");
      }

      console.log("Đã nhận WebAuthn assertion:", assertion);
      setStatus((prev) => `${prev}\nĐã lấy xác thực WebAuthn thành công.`);

      try {
        // 2. Chuẩn bị message và tạo instruction secp256r1
        const timestamp = Math.floor(Date.now() / 1000);
        const amountStr = parseFloat(amount).toString();

        // Tính hash của webAuthnPubKey
        console.log("===== DEBUG HASH CALCULATION =====");
        console.log(
          "Hash Function Input (exact param):",
          webAuthnPubKey.toString("hex")
        );
        console.log(
          "Hash Function Input Type:",
          webAuthnPubKey.constructor.name
        );
        console.log("Hash Function Input Bytes:", Array.from(webAuthnPubKey));

        // Tính hash sử dụng sha256 giống contract
        const hashBytes = sha256(Buffer.from(webAuthnPubKey));
        const fullHashHex = Buffer.from(hashBytes).toString("hex");
        console.log("Full SHA-256 Hash (Hex):", fullHashHex);

        // Lấy 6 bytes đầu tiên của hash
        const hashBytesStart = hashBytes.slice(0, 6);

        // Chuyển đổi sang hex string giống hàm to_hex trong contract
        const pubkeyHashHex = Array.from(hashBytesStart as Uint8Array)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        console.log("First 6 bytes of Hash (12 hex chars):", pubkeyHashHex);

        // Thêm debug để kiểm tra từng byte hash
        console.log(
          "Hash bytes (first 6):",
          Array.from(hashBytesStart as Uint8Array)
        );
        console.log("Hash hex format with contract matching:");
        Array.from(hashBytesStart as Uint8Array).forEach((byte, i) => {
          const hex = byte.toString(16).padStart(2, "0");
          console.log(`Byte ${i}: ${byte} -> hex: ${hex}`);
        });
        console.log("==============================================");

        // Tạo message với đầy đủ thông tin bao gồm pubkey hash
        const messageString = `create:proposal_transfer_${amountStr}_SOL_to_${destinationAddress},timestamp:${timestamp},pubkey:${pubkeyHashHex}`;
        
        console.log("Message đầy đủ để ký:", messageString);

        // Chuyển đổi chữ ký DER sang raw
        const signatureRaw = derToRaw(Buffer.from(assertion.signature));
        const signatureBuffer = Buffer.from(signatureRaw);

        console.log("Signature (raw):", signatureBuffer.toString("hex"));
        
        // Thêm log chi tiết về WebAuthn assertion
        console.log("[DEBUG] WebAuthn Raw Response:");
        console.log("- clientDataJSON (raw):", new Uint8Array(assertion.clientDataJSON));
        console.log("- clientDataJSON (text):", new TextDecoder().decode(assertion.clientDataJSON));
        console.log("- authenticatorData (hex):", Buffer.from(assertion.authenticatorData).toString('hex'));
        console.log("- signature (hex):", Buffer.from(assertion.signature).toString('hex'));

        // Chuẩn hóa signature về dạng Low-S
        const normalizedSignature = normalizeSignatureToLowS(
          signatureBuffer
        );
        console.log(
          "Normalized signature:",
          normalizedSignature.toString("hex")
        );

        // Thêm log để debug giá trị publicKeyBytes
        console.log("KIỂM TRA PUBLIC KEY TRƯỚC KHI TẠO INSTRUCTION:");
        console.log("webAuthnPubKey:", webAuthnPubKey.toString("hex"));
        console.log("webAuthnPubKey length:", webAuthnPubKey.length);

        // Chuẩn bị dữ liệu xác thực WebAuthn đúng cách
        console.log("Tạo verification data WebAuthn...");
        const verificationData = await createWebAuthnVerificationData(
          assertion
        );

        console.log("[DEBUG] Verification Data:");
        console.log("- verificationData (hex):", Buffer.from(verificationData).toString("hex"));
        console.log("- verificationData (length):", verificationData.length);
        console.log("- authDataBytes (length):", assertion.authenticatorData.length);
        console.log("- clientDataHashBytes (length):", 32); // SHA-256 hash luôn là 32 bytes

        // 4. Tạo secp256r1 instruction - sử dụng verificationData thay vì message
        const secp256r1Instruction = createSecp256r1Instruction(
          Buffer.from(verificationData), // Sử dụng verificationData thay vì message
          webAuthnPubKey,
          normalizedSignature,
          false
        );

        // 5. Thay thế phần gọi hàm createProposal với trực tiếp tạo và gửi transaction
        setStatus(
          (prev) => `${prev}\nĐang tạo transaction với secp256r1 instruction...`
        );

        try {
          // Tạo proposal ID dựa trên timestamp hiện tại
          const proposalId = new BN(Date.now());

          // Chuyển đổi guardianId
          const guardianId = new BN(1); // Mặc định là 1 (owner)

          // Đảm bảo multisigAddress là đối tượng PublicKey hợp lệ
          const multisigPDAObj = new PublicKey(multisigAddress.toString());
          console.log(
            "MultisigPDA được chuyển đổi:",
            multisigPDAObj.toString()
          );

          // Tính PDA cho guardian
          const guardianPubkey = await getGuardianPDA(
            multisigPDAObj,
            guardianId.toNumber()
          );

          // Tính PDA cho proposal
          const [proposalPubkey] = await PublicKey.findProgramAddressSync(
            [
              Buffer.from("proposal"),
              multisigPDAObj.toBuffer(),
              proposalId.toArrayLike(Buffer, "le", 8),
            ],
            PROGRAM_ID
          );

          // Tạo tham số cho đề xuất
          const destinationPubkey = new PublicKey(destinationAddress);
          const amountLamports = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);

          // Sử dụng hàm createActionParams để tạo ActionParams theo định dạng chuẩn
          const actionParams = createActionParams(
            amountLamports,
            destinationPubkey,
            undefined // Sử dụng undefined thay vì null
          );

          console.log("ActionParams:", actionParams);

          // Tạo transaction mới và thêm secp256r1 instruction trước tiên
          const transaction = new Transaction();
          transaction.add(secp256r1Instruction);

          // Sử dụng discriminator từ IDL
          const createProposalDiscriminator = new Uint8Array([
            132, 116, 68, 174, 216, 160, 198, 22,
          ]);

          console.log(
            "Đang sử dụng discriminator từ IDL:",
            Buffer.from(createProposalDiscriminator).toString("hex")
          );

          // Tạo và encode dữ liệu theo định dạng Anchor

          // 1. Discriminator (8 bytes)
          const parts = [Buffer.from(createProposalDiscriminator)];

          // 2. proposal_id (u64 - 8 bytes)
          parts.push(Buffer.from(proposalId.toArrayLike(Buffer, "le", 8)));

          // 3. description (string - 4 byte độ dài + nội dung)
          const descriptionBuffer = Buffer.from(description);
          const descriptionLenBuffer = Buffer.alloc(4);
          descriptionLenBuffer.writeUInt32LE(descriptionBuffer.length, 0);
          parts.push(descriptionLenBuffer);
          parts.push(descriptionBuffer);

          // 4. proposer_guardian_id (u64 - 8 bytes)
          parts.push(Buffer.from(guardianId.toArrayLike(Buffer, "le", 8)));

          // 5. action (string - 4 byte độ dài + nội dung)
          const actionBuffer = Buffer.from("transfer");
          const actionLenBuffer = Buffer.alloc(4);
          actionLenBuffer.writeUInt32LE(actionBuffer.length, 0);
          parts.push(actionLenBuffer);
          parts.push(actionBuffer);

          // 6. params (ActionParams)
          // 6.1. amount (option<u64>)
          if (actionParams.amount) {
            parts.push(Buffer.from([1])); // Some variant
            parts.push(
              Buffer.from(actionParams.amount.toArrayLike(Buffer, "le", 8))
            );
          } else {
            parts.push(Buffer.from([0])); // None variant
          }

          // 6.2. destination (option<publicKey>)
          if (actionParams.destination) {
            parts.push(Buffer.from([1])); // Some variant
            parts.push(Buffer.from(actionParams.destination.toBuffer()));
          } else {
            parts.push(Buffer.from([0])); // None variant
          }

          // 6.3. tokenMint (option<publicKey>)
          if (actionParams.tokenMint) {
            parts.push(Buffer.from([1])); // Some variant
            parts.push(Buffer.from(actionParams.tokenMint.toBuffer()));
          } else {
            parts.push(Buffer.from([0])); // None variant
          }

          // Nối tất cả các phần lại để tạo thành data instruction hoàn chỉnh
          const data = Buffer.concat(parts);

          console.log("Instruction data length:", data.length);
          console.log(
            "Instruction data (first 32 bytes):",
            Buffer.from(data.slice(0, 32)).toString("hex")
          );

          // Thêm instruction vào transaction
          transaction.add(
            new TransactionInstruction({
              keys: [
                { pubkey: multisigPDAObj, isSigner: false, isWritable: true },
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

          // Gửi transaction
          transaction.feePayer = payerKeypair.publicKey;
          transaction.recentBlockhash = (
            await connection.getLatestBlockhash()
          ).blockhash;
          transaction.sign(payerKeypair);

          setStatus(
            (prev) => `${prev}\nĐang gửi giao dịch với 2 instructions...`
          );
          console.log("Gửi transaction với 2 instructions:", transaction);

          // Kiểm tra instruction bytes
          console.log("Kiểm tra instruction 0 (secp256r1):", {
            programId: transaction.instructions[0].programId.toString(),
            pubkeyInData: webAuthnPubKey.toString("hex"),
            dataSize: transaction.instructions[0].data.length,
          });

          // Bắt đầu thêm xử lý lỗi SendTransactionError tốt hơn
          try {
            // Gửi transaction với opion skipPreflight: false để bắt lỗi sớm
            const signature = await connection.sendTransaction(
              transaction,
              [payerKeypair],
              {
                skipPreflight: false,
                preflightCommitment: "confirmed",
                maxRetries: 3,
              }
            );

            // Thêm xử lý gói confirmTransaction vào try/catch riêng để bắt lỗi trong quá trình xác nhận
            try {
              await connection.confirmTransaction(signature, "confirmed");

              // Tạo đối tượng proposal để lưu vào Firebase
              const guardianPDA = await getGuardianPDA(
                multisigPDAObj,
                guardianId.toNumber()
              );
              const proposalData = {
                proposalId: proposalId.toNumber(),
                multisigAddress: multisigPDAObj.toString(),
                description: description,
                action: "transfer",
                status: "pending",
                createdAt: Timestamp.now(),
                creator: payerKeypair.publicKey.toString(),
                signers: [guardianPDA.toString()], // Chuyển guardianPDA sang string
                requiredSignatures: threshold, // Chỉ lấy số threshold từ useWalletInfo
                amount: amountLamports.toNumber(),
                destination: destinationPubkey.toString(),
                tokenMint: null,
                transactionSignature: signature,
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

              setStatus(`Đã tạo đề xuất thành công! Signature: ${signature}`);
              setShowProposalForm(false);

              // Tải lại danh sách đề xuất
              if (program && multisigInfo?.pubkey) {
                setTimeout(() => {
                  loadMultisigProposals(multisigInfo.pubkey, program);
                }, 2000);
              }
            } catch (confirmError) {
              console.error("Lỗi khi xác nhận giao dịch:", confirmError);

              // Kiểm tra xem lỗi có thuộc về loại SendTransactionError không
              if (confirmError instanceof Error) {
                const errorMessage = confirmError.message;
                // Lấy logs từ kết quả simulation nếu có
                let logs: string[] = [];

                // @ts-ignore - Truy cập thuộc tính logs nếu có
                if (confirmError.logs) {
                  // @ts-ignore
                  logs = confirmError.logs;
                }

                // In ra logs để debug
                console.error("Transaction logs:", logs);

                // Phân tích thông tin lỗi để hiển thị thông báo cụ thể
                let errorDetail = "Lỗi không xác định";

                if (errorMessage.includes("custom program error: 0x2")) {
                  errorDetail =
                    "Lỗi tham số không hợp lệ (custom program error: 0x2). Có thể do:";
                  errorDetail += "\n- Sai địa chỉ đích";
                  errorDetail += "\n- Sai số lượng SOL";
                  errorDetail += "\n- Guardian không có quyền tạo đề xuất";
                } else if (errorMessage.includes("custom program error: 0x1")) {
                  errorDetail = "Lỗi khởi tạo sai (custom program error: 0x1)";
                } else if (errorMessage.includes("custom program error: 0x3")) {
                  errorDetail =
                    "Lỗi đề xuất đã tồn tại (custom program error: 0x3)";
                } else {
                  errorDetail = `Lỗi: ${errorMessage}`;
                }

                setStatus(`Giao dịch thất bại: ${errorDetail}`);
              } else {
                setStatus(`Giao dịch thất bại với lỗi không xác định`);
              }
            }
          } catch (sendError: any) {
            // Xử lý lỗi khi gửi giao dịch
            console.error("Lỗi khi gửi giao dịch:", sendError);

            // Lấy logs từ kết quả simulation nếu có
            let logs: string[] = [];
            if (sendError.logs) {
              logs = sendError.logs;
              console.error("Logs đầy đủ từ blockchain:", logs);
            }

            // Lấy thông tin chi tiết từ transaction nếu có signature
            if (sendError.signature) {
              try {
                const txInfo = await connection.getTransaction(
                  sendError.signature,
                  {
                    commitment: "confirmed",
                    maxSupportedTransactionVersion: 0,
                  }
                );
                console.error("Chi tiết giao dịch:", txInfo?.meta?.logMessages);

                if (txInfo?.meta?.logMessages) {
                  logs = txInfo.meta.logMessages;
                }
              } catch (e) {
                console.error("Không thể lấy thông tin chi tiết giao dịch:", e);
              }
            }

            // In ra logs để debug
            console.error("Simulation logs:", logs);

            // Phân tích thông tin lỗi để hiển thị thông báo cụ thể
            let errorDetail = "Lỗi không xác định";

            if (logs.length > 0) {
              // Hiển thị logs chi tiết trong UI
              errorDetail = "Lỗi từ chương trình Solana:\n\n" + logs.join("\n");
            } else if (sendError.message.includes("custom program error: 0x")) {
              // Phân tích mã lỗi custom program
              if (sendError.message.includes("custom program error: 0x2")) {
                errorDetail =
                  "Lỗi tham số không hợp lệ (custom program error: 0x2). Có thể do:";
                errorDetail += "\n- Sai địa chỉ đích";
                errorDetail += "\n- Sai số lượng SOL";
                errorDetail += "\n- Guardian không có quyền tạo đề xuất";
              } else if (
                sendError.message.includes("custom program error: 0x1")
              ) {
                errorDetail = "Lỗi khởi tạo sai (custom program error: 0x1)";
              } else if (
                sendError.message.includes("custom program error: 0x3")
              ) {
                errorDetail =
                  "Lỗi đề xuất đã tồn tại (custom program error: 0x3)";
              } else {
                // Trích xuất mã lỗi
                const errorMatch = sendError.message.match(
                  /custom program error: (0x[0-9a-fA-F]+)/
                );
                if (errorMatch && errorMatch[1]) {
                  errorDetail = `Lỗi chương trình: ${errorMatch[1]}`;
                } else {
                  errorDetail = `Lỗi: ${sendError.message}`;
                }
              }
            } else if (sendError.message.includes("Instruction #")) {
              errorDetail = `Lỗi instruction: ${sendError.message}`;

              // Thêm logs từ blockchain nếu có
              if (logs.length > 0) {
                errorDetail +=
                  "\n\nChi tiết từ blockchain:\n" + logs.join("\n");
              }
            } else {
              errorDetail = `Lỗi: ${sendError.message}`;
            }

            setStatus(`Giao dịch thất bại: ${errorDetail}`);

            // Hiển thị modal với thông tin lỗi chi tiết nếu logs dài
            if (logs.length > 5) {
              // Tạo modal hoặc hiển thị logs trong console để người dùng có thể xem
              console.error("=== CHI TIẾT LỖI ĐẦY ĐỦ TỪ BLOCKCHAIN ===");
              console.error(logs.join("\n"));
            }
          }
        } catch (error) {
          console.error("Lỗi khi xử lý WebAuthn assertion:", error);
          setStatus(
            (prev) =>
              `${prev}\nLỗi khi xử lý WebAuthn assertion: ${
                error instanceof Error ? error.message : String(error)
              }`
          );
        }
      } catch (error) {
        console.error("Lỗi khi tạo đề xuất:", error);
        setStatus(
          `Lỗi: ${error instanceof Error ? error.message : String(error)}`
        );
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

      if (!multisigInfo || !payerKeypair) {
        throw new Error("Thông tin ví multisig hoặc keypair không khả dụng");
      }

      // 1. Lấy xác thực WebAuthn
      const credentialIdString = Buffer.from(credentialId).toString("hex");
      const assertion = await getWebAuthnAssertion(
        credentialIdString,
        undefined,
        true
      );
      if (!assertion) {
        throw new Error("Không thể lấy WebAuthn assertion");
      }
      setStatus((prev) => `${prev}\nĐã lấy xác thực WebAuthn thành công.`);

      // LẤY WEBAUTHN PUBLIC KEY THẬT TỪ FIREBASE
      console.log("Lấy WebAuthn public key...");
      let webAuthnPubKey: Buffer;

      // Thử tìm trong Firebase
      const credentialMapping = await getWalletByCredentialId(
        credentialIdString
      );

      if (
        !credentialMapping ||
        !credentialMapping.guardianPublicKey ||
        credentialMapping.guardianPublicKey.length === 0
      ) {
        // Thử tìm trong localStorage
        console.log(
          "Không tìm thấy trong Firebase, thử tìm trong localStorage..."
        );
        const localStorageData = localStorage.getItem(
          "webauthn_credential_" + credentialIdString
        );
        if (localStorageData) {
          const localMapping = JSON.parse(localStorageData);
          if (
            localMapping &&
            localMapping.guardianPublicKey &&
            localMapping.guardianPublicKey.length > 0
          ) {
            webAuthnPubKey = Buffer.from(
              new Uint8Array(localMapping.guardianPublicKey)
            );
          } else {
            throw new Error(
              "Không tìm thấy WebAuthn public key trong localStorage"
            );
          }
        } else {
          throw new Error("Không tìm thấy WebAuthn public key");
        }
      } else {
        // Sử dụng WebAuthn public key từ Firebase
        webAuthnPubKey = Buffer.from(
          new Uint8Array(credentialMapping.guardianPublicKey)
        );
      }

      console.log(
        "Đã lấy được WebAuthn public key thật:",
        webAuthnPubKey.toString("hex")
      );

      // 2. Chuẩn bị message cho secp256r1
      const timestamp = Math.floor(Date.now() / 1000);
      // Tạo message theo định dạng yêu cầu của contract
      const messageString = `approve:proposal_${proposalId},timestamp:${timestamp},pubkey:${payerKeypair.publicKey.toBase58()}`;

      // 4. Chuyển đổi từ DER sang raw
      const signatureRaw = derToRaw(Buffer.from(assertion.signature));
      const signatureBuffer = Buffer.from(signatureRaw);

      console.log("Signature (raw):", signatureBuffer.toString("hex"));

      // Chuẩn hóa signature về dạng Low-S
      const normalizedSignature = normalizeSignatureToLowS(signatureBuffer);
      console.log("Normalized signature:", normalizedSignature.toString("hex"));

      // ĐÚNG QUY TRÌNH XÁC MINH WEBAUTHN:
      // 1. Tính hash của clientDataJSON
      const clientDataHash = await crypto.subtle.digest(
        "SHA-256",
        assertion.clientDataJSON
      );
      const clientDataHashBytes = new Uint8Array(clientDataHash);
      console.log(
        "clientDataJSON hash:",
        Buffer.from(clientDataHashBytes).toString("hex")
      );

      // 2. Tạo verification data đúng cách: authenticatorData + hash(clientDataJSON)
      const verificationData = new Uint8Array(
        assertion.authenticatorData.length + clientDataHashBytes.length
      );
      verificationData.set(new Uint8Array(assertion.authenticatorData), 0);
      verificationData.set(
        clientDataHashBytes,
        assertion.authenticatorData.length
      );

      console.log("Verification data length:", verificationData.length);
      console.log(
        "Verification data (hex):",
        Buffer.from(verificationData).toString("hex")
      );

      setStatus(
        (prev) => `${prev}\nĐang tạo transaction với 2 instructions...`
      );

      // 5. Tạo instruction cho secp256r1
      const secp256r1Instruction = createSecp256r1Instruction(
        Buffer.from(verificationData), // Sử dụng verification data
        webAuthnPubKey, // Sử dụng public key thật từ Firebase
        normalizedSignature // Sử dụng chữ ký đã chuẩn hóa
      );

      // 6. Tạo instruction cho moon wallet program để phê duyệt đề xuất
      // Đây là phần giả định - bạn cần thay thế với instruction thực tế từ API của bạn
      // (Tương tự như trong TransferForm.tsx)

      // Tạo transaction và thêm cả hai instruction
      const transaction = new Transaction();
      transaction.add(secp256r1Instruction);

      // TODO: Thêm instruction phê duyệt đề xuất của moon wallet
      // transaction.add(approveProposalInstruction);

      // 7. Gửi transaction
      // Sử dụng skipPreflight để tránh lỗi với secp256r1 instruction
      transaction.feePayer = payerKeypair.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      try {
        const txId = await sendAndConfirmTransaction(
          connection,
          transaction,
          [payerKeypair],
          {
            skipPreflight: false, // Thay đổi để bắt lỗi sớm
            preflightCommitment: "confirmed",
          }
        );

        setStatus(`Đã phê duyệt đề xuất thành công! TxID: ${txId}`);

        // Tải lại danh sách đề xuất
        loadMultisigProposals(multisigInfo.pubkey, program);

        // Cập nhật danh sách chữ ký trong Firebase chỉ khi giao dịch thành công
        try {
          await addSignerToProposal(
            multisigInfo.pubkey.toString(),
            parseInt(proposalId),
            payerKeypair.publicKey.toString() // Đây là địa chỉ Solana, không phải WebAuthn public key
          );
          console.log(
            `Đã thêm ${payerKeypair.publicKey.toString()} vào danh sách người ký của đề xuất ${proposalId}`
          );
        } catch (firebaseError) {
          console.error(
            "Lỗi khi cập nhật danh sách chữ ký trên Firebase:",
            firebaseError
          );
          // Không throw error ở đây vì transaction blockchain đã thành công
        }
      } catch (txError) {
        console.error("Lỗi khi gửi giao dịch:", txError);
        setStatus(
          `Lỗi khi gửi giao dịch: ${
            txError instanceof Error ? txError.message : String(txError)
          }`
        );
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

      if (!multisigInfo || !payerKeypair) {
        throw new Error("Thông tin ví multisig hoặc keypair không khả dụng");
      }

      // 1. Lấy xác thực WebAuthn
      const credentialIdString = Buffer.from(credentialId).toString("hex");
      const assertion = await getWebAuthnAssertion(
        credentialIdString,
        undefined,
        true
      );
      if (!assertion) {
        throw new Error("Không thể lấy WebAuthn assertion");
      }
      setStatus((prev) => `${prev}\nĐã lấy xác thực WebAuthn thành công.`);

      // LẤY WEBAUTHN PUBLIC KEY THẬT TỪ FIREBASE
      console.log("Lấy WebAuthn public key...");
      let webAuthnPubKey: Buffer;

      // Thử tìm trong Firebase
      const credentialMapping = await getWalletByCredentialId(
        credentialIdString
      );

      if (
        !credentialMapping ||
        !credentialMapping.guardianPublicKey ||
        credentialMapping.guardianPublicKey.length === 0
      ) {
        // Thử tìm trong localStorage
        console.log(
          "Không tìm thấy trong Firebase, thử tìm trong localStorage..."
        );
        const localStorageData = localStorage.getItem(
          "webauthn_credential_" + credentialIdString
        );
        if (localStorageData) {
          const localMapping = JSON.parse(localStorageData);
          if (
            localMapping &&
            localMapping.guardianPublicKey &&
            localMapping.guardianPublicKey.length > 0
          ) {
            webAuthnPubKey = Buffer.from(
              new Uint8Array(localMapping.guardianPublicKey)
            );
          } else {
            throw new Error(
              "Không tìm thấy WebAuthn public key trong localStorage"
            );
          }
        } else {
          throw new Error("Không tìm thấy WebAuthn public key");
        }
      } else {
        // Sử dụng WebAuthn public key từ Firebase
        webAuthnPubKey = Buffer.from(
          new Uint8Array(credentialMapping.guardianPublicKey)
        );
      }

      console.log(
        "Đã lấy được WebAuthn public key thật:",
        webAuthnPubKey.toString("hex")
      );

      // 2. Chuẩn bị message cho secp256r1
      const timestamp = Math.floor(Date.now() / 1000);
      // Tạo message theo định dạng yêu cầu của contract
      const messageString = `execute:proposal_${proposalId},timestamp:${timestamp},pubkey:${payerKeypair.publicKey.toBase58()}`;

      // 4. Chuyển đổi từ DER sang raw
      const signatureRaw = derToRaw(Buffer.from(assertion.signature));
      const signatureBuffer = Buffer.from(signatureRaw);

      console.log("Signature (raw):", signatureBuffer.toString("hex"));

      // Chuẩn hóa signature về dạng Low-S
      const normalizedSignature = normalizeSignatureToLowS(signatureBuffer);
      console.log("Normalized signature:", normalizedSignature.toString("hex"));

      // ĐÚNG QUY TRÌNH XÁC MINH WEBAUTHN:
      // 1. Tính hash của clientDataJSON
      const clientDataHash = await crypto.subtle.digest(
        "SHA-256",
        assertion.clientDataJSON
      );
      const clientDataHashBytes = new Uint8Array(clientDataHash);
      console.log(
        "clientDataJSON hash:",
        Buffer.from(clientDataHashBytes).toString("hex")
      );

      // 2. Tạo verification data đúng cách: authenticatorData + hash(clientDataJSON)
      const verificationData = new Uint8Array(
        assertion.authenticatorData.length + clientDataHashBytes.length
      );
      verificationData.set(new Uint8Array(assertion.authenticatorData), 0);
      verificationData.set(
        clientDataHashBytes,
        assertion.authenticatorData.length
      );

      console.log("Verification data length:", verificationData.length);
      console.log(
        "Verification data (hex):",
        Buffer.from(verificationData).toString("hex")
      );

      setStatus(
        (prev) => `${prev}\nĐang tạo transaction với 2 instructions...`
      );

      // 5. Tạo instruction cho secp256r1
      const secp256r1Instruction = createSecp256r1Instruction(
        Buffer.from(verificationData), // Sử dụng verification data
        webAuthnPubKey, // Sử dụng public key thật từ Firebase
        normalizedSignature // Sử dụng chữ ký đã chuẩn hóa
      );

      // 6. Tạo instruction cho moon wallet program để thực thi đề xuất
      // Tạo transaction và thêm instruction
      const transaction = new Transaction();
      transaction.add(secp256r1Instruction);

      // TODO: Thêm instruction thực thi đề xuất của moon wallet
      // transaction.add(executeProposalInstruction);

      // 7. Gửi transaction
      // Sử dụng skipPreflight để tránh lỗi với secp256r1 instruction
      transaction.feePayer = payerKeypair.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      try {
        const txId = await sendAndConfirmTransaction(
          connection,
          transaction,
          [payerKeypair],
          {
            skipPreflight: false, // Thêm skipPreflight để tránh lỗi
            preflightCommitment: "confirmed",
          }
        );

        setStatus(`Đã thực thi đề xuất thành công! TxID: ${txId}`);

        // Tải lại danh sách đề xuất
        loadMultisigProposals(multisigInfo.pubkey, program);

        // Cập nhật trạng thái đề xuất thành 'executed' trong Firebase chỉ khi giao dịch thành công
        try {
          await updateProposalStatus(
            multisigInfo.pubkey.toString(),
            parseInt(proposalId),
            "executed",
            txId // Sử dụng biến txId từ kết quả của quá trình thực thi
          );
          console.log(
            `Đã cập nhật trạng thái đề xuất ${proposalId} thành 'executed'`
          );
        } catch (firebaseError) {
          console.error(
            "Lỗi khi cập nhật trạng thái đề xuất trên Firebase:",
            firebaseError
          );
          // Không throw error ở đây vì transaction blockchain đã thành công
        }
      } catch (txError) {
        console.error("Lỗi khi gửi giao dịch:", txError);
        setStatus(
          `Lỗi khi gửi giao dịch: ${
            txError instanceof Error ? txError.message : String(txError)
          }`
        );
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
                <label>Địa chỉ ví:</label>
                <div>{multisigAddress.toString()}</div>
              </div>

              <div>
                <button
                  onClick={goToProposalList}
                >
                  Xem Danh Sách Đề Xuất
                </button>
              </div>

              {showTransferForm && (
                <div>
                  <h3>Chuyển Tiền</h3>
                  <div>
                    <label>Địa chỉ nhận:</label>
                    <input
                      type="text"
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      placeholder="Địa chỉ ví nhận SOL"
                    />
                  </div>

                  <div>
                    <label>Số lượng SOL:</label>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Số lượng SOL"
                    />
                  </div>

                  <div>
                    <label>Mô tả:</label>
                    <input
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
                  {proposals.map((proposal, index) => (
                    <div key={index}>
                      <div>
                        <div>
                          {proposal.description}
                        </div>
                        <div>
                          {proposal.status}
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
