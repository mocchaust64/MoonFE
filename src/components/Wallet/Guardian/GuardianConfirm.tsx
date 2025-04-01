import { PublicKey, Keypair } from "@solana/web3.js";
import {
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  getGuardianData,
  updateGuardianStatus,
} from "@/lib/firebase/guardianService";
import { createAddGuardianInstructionData } from "@/lib/instructions";
import { connection, PROGRAM_ID } from "@/lib/solana/connection";
import { useWalletStore } from "@/store/walletStore";
import { bigIntToLeBytes } from "@/utils/helpers";

export interface GuardianConfirmProps {
  inviteCode: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// Hàm chuyển đổi secret key từ chuỗi trong .env thành Uint8Array
const convertSecretKeyStringToUint8Array = (
  secretKeyString: string | undefined,
): Uint8Array => {
  if (!secretKeyString) {
    throw new Error(
      "Fee payer secret key không được định nghĩa trong biến môi trường",
    );
  }

  // Chuyển đổi chuỗi "1,2,3,..." thành mảng số
  const numbers = secretKeyString.split(",").map((s) => parseInt(s.trim(), 10));

  // Kiểm tra kích thước hợp lệ (64 bytes cho ed25519)
  if (numbers.length !== 64 && numbers.length !== 65) {
    throw new Error(
      `Secret key phải có 64 hoặc 65 bytes, nhưng có ${numbers.length} bytes`,
    );
  }

  const bytes = numbers.length === 65 ? numbers.slice(0, 64) : numbers;
  return new Uint8Array(bytes);
};

export function GuardianConfirm({
  inviteCode,
  onSuccess,
  onError,
}: GuardianConfirmProps) {
  const { multisigAddress, fetchGuardians } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Khi component này được render, log thông tin inviteCode
  useEffect(() => {
    console.log(`GuardianConfirm được khởi tạo với mã mời: ${inviteCode}`);
  }, [inviteCode]);

  const addLog = (message: string) => {
    console.log(message);
    setLogs((prev) => [...prev, message]);
  };

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      setLogs([]);
      addLog(`Bắt đầu xác nhận guardian với mã mời: ${inviteCode}`);

      // Kiểm tra multisigAddress có tồn tại không
      if (!multisigAddress) {
        throw new Error("Không tìm thấy địa chỉ multisig");
      }

      addLog(`Multisig address: ${multisigAddress.toString()}`);

      // Lấy fee payer từ biến môi trường thay vì từ walletStore
      const feePayerSecretKey = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY;
      if (!feePayerSecretKey) {
        throw new Error("Không tìm thấy khóa fee payer trong biến môi trường");
      }

      const feePayerPrivateKey =
        convertSecretKeyStringToUint8Array(feePayerSecretKey);
      const feePayer = Keypair.fromSecretKey(feePayerPrivateKey);
      addLog(`Fee payer address: ${feePayer.publicKey.toString()}`);

      // 1. Lấy thông tin guardian
      addLog(`Đang lấy thông tin guardian từ Firebase...`);
      const guardianData = await getGuardianData(inviteCode);

      if (!guardianData) {
        throw new Error("Không tìm thấy dữ liệu guardian");
      }

      if (guardianData.status !== "ready") {
        throw new Error(
          `Guardian có trạng thái không hợp lệ: ${guardianData.status}`,
        );
      }

      addLog(
        `Đã tìm thấy dữ liệu guardian: ${guardianData.guardianName} (ID: ${guardianData.guardianId})`,
      );

      // 2. Tạo transaction
      addLog(`Đang tạo transaction...`);
      const tx = new Transaction();

      // Tìm PDA cho guardian
      const multisigPublicKey =
        typeof multisigAddress === "string"
          ? new PublicKey(multisigAddress)
          : multisigAddress;

      addLog(`Đang tính PDA cho guardian ID ${guardianData.guardianId}...`);
      const guardianIdBigInt = BigInt(guardianData.guardianId);
      const guardianIdBytes = bigIntToLeBytes(guardianIdBigInt);

      const [guardianPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("guardian"),
          multisigPublicKey.toBuffer(),
          guardianIdBytes,
        ],
        PROGRAM_ID,
      );

      addLog(`Guardian PDA: ${guardianPDA.toString()}`);

      // Kiểm tra xem guardian đã tồn tại trên blockchain chưa
      const existingAccount = await connection.getAccountInfo(guardianPDA);
      if (existingAccount) {
        addLog(
          `⚠️ Guardian đã tồn tại trên blockchain! Đang kiểm tra chủ sở hữu...`,
        );

        if (existingAccount.owner.equals(PROGRAM_ID)) {
          addLog(
            `⚠️ Guardian đã thuộc về chương trình của chúng ta. Có thể guardian đã được thêm trước đó.`,
          );
          await updateGuardianStatus(inviteCode, "completed", "already_exists");

          // Refresh guardians list
          addLog(`Đang làm mới danh sách guardians...`);
          await fetchGuardians();

          onSuccess?.();
          return;
        }
      }

      // Tạo instruction data
      addLog(`Đang tạo dữ liệu instruction...`);
      const instructionData = createAddGuardianInstructionData({
        guardianId: guardianData.guardianId,
        guardianName: guardianData.guardianName,
        recoveryHash: new Uint8Array(guardianData.hashedRecoveryBytes),
        isOwner: false,
        webauthnPubkey: new Uint8Array(guardianData.webauthnPublicKey),
      });

      // Thêm instruction
      tx.add(
        new TransactionInstruction({
          keys: [
            { pubkey: multisigPublicKey, isSigner: false, isWritable: true },
            { pubkey: guardianPDA, isSigner: false, isWritable: true },
            { pubkey: feePayer.publicKey, isSigner: false, isWritable: false },
            { pubkey: feePayer.publicKey, isSigner: true, isWritable: true },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data: Buffer.from(instructionData),
        }),
      );

      // Đặt fee payer cho transaction
      tx.feePayer = feePayer.publicKey;

      // Lấy blockhash gần nhất
      addLog(`Đang lấy blockhash gần nhất...`);
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      addLog(`Chi tiết transaction:
- Multisig: ${multisigPublicKey.toString()}
- Guardian PDA: ${guardianPDA.toString()}
- Fee payer: ${feePayer.publicKey.toString()}
- Tên guardian: ${guardianData.guardianName}
- ID guardian: ${guardianData.guardianId}
- Kích thước dữ liệu: ${instructionData.length} bytes`);

      // 3. Gửi và xác nhận transaction
      addLog(`Đang gửi transaction...`);
      try {
        const signature = await sendAndConfirmTransaction(
          connection,
          tx,
          [feePayer],
          { commitment: "confirmed" },
        );

        addLog(`✅ Transaction đã được xác nhận! Signature: ${signature}`);

        // 4. Cập nhật trạng thái
        addLog(`Đang cập nhật trạng thái guardian...`);
        await updateGuardianStatus(inviteCode, "completed", signature);

        // 5. Cập nhật lại danh sách guardian trong store
        addLog(`Đang làm mới danh sách guardians...`);
        await fetchGuardians();

        onSuccess?.();
      } catch (txError) {
        console.error("Transaction error:", txError);
        addLog(
          `❌ Lỗi khi gửi transaction: ${txError instanceof Error ? txError.message : String(txError)}`,
        );
        throw txError;
      }
    } catch (error) {
      console.error("Error confirming guardian:", error);
      addLog(
        `❌ Lỗi: ${error instanceof Error ? error.message : String(error)}`,
      );
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Disable button nếu không có multisigAddress
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Xác nhận Guardian</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !multisigAddress}
            variant="default"
            className="w-full"
          >
            {isLoading ? "Đang xác nhận..." : "Xác nhận Guardian"}
          </Button>

          {logs.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800">
              {logs.map((log, index) => (
                <div key={index} className="py-1">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
