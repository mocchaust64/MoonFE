"use client";

import { Keypair } from "@solana/web3.js";
import { Copy } from "lucide-react";
import { useState, useEffect } from "react";
import QRCode from "react-qr-code";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import { saveInvitation } from "@/lib/firebase/guardianService";
import { useWalletStore } from "@/store/walletStore";
import { createFeePayerKeypair } from "@/utils/keypairUtils";

interface InviteGuardianModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteGuardianModal({
  open,
  onOpenChange,
}: InviteGuardianModalProps) {
  const { multisigAddress, existingGuardians } = useWalletStore();
  const [inviteLink, setInviteLink] = useState<string>("");
  const [inviteCode, setInviteCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feePayer, setFeePayer] = useState<Keypair | null>(null);

  // Khởi tạo feePayer khi component mount
  useEffect(() => {
    try {
      const keypair = createFeePayerKeypair();
      setFeePayer(keypair);
      console.log("Đã khởi tạo feePayer thành công");
    } catch (error) {
      console.error("Lỗi khởi tạo feePayer:", error);
    }
  }, []);

  // Hàm tạo mã mời ngẫu nhiên
  const generateRandomCode = (length: number = 8): string => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
    return result;
  };

  // Hàm tính guardianId mới không bị trùng
  const calculateNewGuardianId = (): number => {
    // Nếu không có guardian nào, bắt đầu từ ID 2 (ID 1 thường là owner)
    if (!existingGuardians || existingGuardians.length === 0) return 2;

    // Tìm ID nhỏ nhất chưa được sử dụng
    let newId = 1;
    while (existingGuardians.includes(newId)) {
      newId++;
    }

    console.log(`Tính toán ID mới cho guardian: ${newId}`);
    return newId;
  };

  // Hàm tạo link mời guardian mới
  const generateGuardianInvite = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!multisigAddress) {
        throw new Error("Vui lòng tạo ví trước khi mời guardian");
      }

      // Tạo feePayer mới nếu chưa có
      let feePayerToUse = feePayer;
      if (!feePayerToUse) {
        feePayerToUse = createFeePayerKeypair();
      }

      // Tính guardian ID mới
      const newGuardianId = calculateNewGuardianId();

      // Tạo mã ngẫu nhiên cho link mời
      const newInviteCode = generateRandomCode(8);

      // Tạo link mời với URL hiện tại
      const baseUrl = "https://wallet.moonraise.xyz/";
      const newInviteLink = `${baseUrl}/guardian/${newInviteCode}`;

      // Lưu thông tin vào Firebase
      console.log("Lưu invitation với dữ liệu:", {
        inviteCode: newInviteCode,
        multisigAddress: multisigAddress.toString(),
        guardianId: newGuardianId,
        ownerId: feePayerToUse.publicKey.toString(),
      });

      await saveInvitation({
        inviteCode: newInviteCode,
        multisigAddress: multisigAddress.toString(),
        guardianId: newGuardianId,
        ownerId: feePayerToUse.publicKey.toString(),
        status: "pending",
      });

      console.log("Đã lưu thành công invitation với mã:", newInviteCode);

      setInviteCode(newInviteCode);
      setInviteLink(newInviteLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Mời Guardian mới</ModalTitle>
          <ModalDescription>
            Tạo link mời để thêm guardian mới vào ví của bạn
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4 py-4">
          {!inviteLink ? (
            <Button
              onClick={generateGuardianInvite}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Đang tạo..." : "Tạo link mời"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <QRCode value={inviteLink} size={200} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div className="font-mono text-sm">{inviteLink}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(inviteLink)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-md border p-2">
                  <div className="font-mono text-sm">{inviteCode}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(inviteCode)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && <div className="text-destructive text-sm">{error}</div>}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
