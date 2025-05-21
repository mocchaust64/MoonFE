"use client";

import { PublicKey } from "@solana/web3.js";
import { Copy } from "lucide-react";
import { useState } from "react";
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
import { connection } from "@/lib/solana";
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { getGuardianPDA } from "@/utils/credentialUtils";

interface InviteGuardianModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteGuardianModal({
  open,
  onOpenChange,
}: Readonly<InviteGuardianModalProps>) {
  const { multisigPDA, walletName } = useWalletInfo();
  const [inviteLink, setInviteLink] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const findNextAvailableGuardianId = async (): Promise<number> => {
    if (!multisigPDA) throw new Error("Multisig PDA not found");

    // Convert string to PublicKey object
    const multisigPublicKey = new PublicKey(multisigPDA);
    
    // Tạo set để lưu các ID đã được sử dụng (từ blockchain và Firebase)
    const usedIds = new Set<number>();
    
    // 1. Kiểm tra từ blockchain
    for (let i = 1; i <= 8; i++) {
      const guardianPDA = getGuardianPDA(multisigPublicKey, i);
      const guardianAccount = await connection.getAccountInfo(guardianPDA);
      if (guardianAccount) {
        usedIds.add(i);
      }
    }
    
    // 2. Kiểm tra từ Firebase - các guardian đang trong trạng thái "pending"
    try {
      const { getPendingGuardianIds } = await import("@/lib/firebase/guardianService");
      const pendingGuardianIds = await getPendingGuardianIds(multisigPDA.toString());
      
      // Thêm tất cả pending IDs vào set đã sử dụng
      pendingGuardianIds.forEach((id: number) => usedIds.add(id));
      
      console.log("Guardian IDs đã được sử dụng:", Array.from(usedIds));
    } catch (error) {
      console.error("Lỗi khi lấy pending guardian IDs từ Firebase:", error);
      // Tiếp tục xử lý với các ID đã biết từ blockchain
    }
    
    // 3. Tìm ID nhỏ nhất chưa được sử dụng
    for (let i = 1; i <= 8; i++) {
      if (!usedIds.has(i)) {
        return i;
      }
    }

    throw new Error("Đã đạt đến số lượng guardian tối đa (8)");
  };

  const generateGuardianInvite = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!multisigPDA) {
        throw new Error("Please create a wallet before inviting guardians");
      }

      const newGuardianId = await findNextAvailableGuardianId();
      const newInviteCode = generateRandomCode(8);
      const baseUrl = "https://3dc9-222-252-14-158.ngrok-free.app";
      const newInviteLink = `${baseUrl}/guardian/${newInviteCode}`;

      await saveInvitation({
        inviteCode: newInviteCode,
        multisigPDA: multisigPDA.toString(),
        guardianId: newGuardianId,
        status: "pending",
        walletName: walletName || "Unnamed Wallet",
        threshold: 1,
      });

      setInviteLink(newInviteLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="w-full max-w-[95vw] sm:max-w-[420px]">
        <ModalHeader className="space-y-1.5 p-4">
          <ModalTitle className="text-xl">Invite New Guardian</ModalTitle>
          <ModalDescription className="text-sm">
            Create an invitation link to add a new guardian to your wallet
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4 px-4 py-3">
          {!inviteLink ? (
            <Button
              onClick={generateGuardianInvite}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Generating..." : "Create Invitation Link"}
            </Button>
          ) : (
            <div className="space-y-4">
              {/* QR Code Section */}
              <div className="flex justify-center">
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  <QRCode
                    value={inviteLink}
                    size={160}
                    className="h-auto max-w-full"
                  />
                </div>
              </div>

              {/* Invitation Link */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="invitation-link" 
                  className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Invitation Link
                </label>
                <div className="flex items-center gap-2">
                  <div 
                    id="invitation-link"
                    className="bg-muted flex-1 overflow-hidden rounded-md p-2.5"
                  >
                    <div className="font-mono text-sm break-all">
                      {inviteLink}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(inviteLink)}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-sm">
              {error}
            </div>
          )}
        </div>

        <ModalFooter className="px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
