"use client";

import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { connection, PROGRAM_ID } from "@/lib/solana/connection";
import { useWalletStore } from "@/store/walletStore";
import { getMultisigPDA } from "@/utils/credentialUtils";
import { getWebAuthnAssertionForLogin } from "@/utils/webauthnUtils";

// Hàm chuyển đổi từ BigInt (u64) sang bytes theo thứ tự little-endian
const bigIntToLeBytes = (
  value: bigint,
  bytesLength: number = 8,
): Uint8Array => {
  const result = new Uint8Array(bytesLength);
  for (let i = 0; i < bytesLength; i++) {
    result[i] = Number((value >> BigInt(8 * i)) & BigInt(0xff));
  }
  return result;
};

export default function LoginWallet() {
  const router = useRouter();
  const { setMultisigAddress, setIsLoggedIn, setGuardianPDA, fetchPdaBalance } =
    useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError("");

      // 1. Lấy assertion từ WebAuthn
      console.log("Đang lấy assertion từ WebAuthn...");
      const assertionResult = await getWebAuthnAssertionForLogin("", true);

      if (!assertionResult.success || !assertionResult.rawId) {
        throw new Error(
          assertionResult.error || "Không thể xác thực với thiết bị",
        );
      }

      // 2. Chuyển đổi rawId thành base64
      const rawIdBase64 = Buffer.from(assertionResult.rawId).toString("base64");
      console.log("Raw ID (base64):", rawIdBase64);

      // 3. Tính PDA từ credential ID
      const multisigPDA = getMultisigPDA(rawIdBase64);
      console.log("Đã tính PDA:", multisigPDA.toString());
      setMultisigAddress(multisigPDA);

      // 4. Kiểm tra ví tồn tại
      console.log("Đang kiểm tra ví trên Solana...");
      const walletAccount = await connection.getAccountInfo(multisigPDA);

      if (!walletAccount) {
        console.error("Không tìm thấy ví với PDA:", multisigPDA.toString());
        throw new Error(
          "Không tìm thấy ví với credential này. Vui lòng tạo ví mới.",
        );
      }

      // 5. Tính PDA cho guardian (owner có ID = 1)
      const guardianId = BigInt(1);
      const guardianIdBytes = bigIntToLeBytes(guardianId);

      const [guardianPDAAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("guardian").subarray(0),
          multisigPDA.toBuffer(),
          guardianIdBytes,
        ],
        PROGRAM_ID,
      );

      setGuardianPDA(guardianPDAAddress);

      // 6. Lấy số dư ví
      await fetchPdaBalance();

      setIsLoggedIn(true);
      router.push("/dashboard");
    } catch (error) {
      console.error("Lỗi khi đăng nhập:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleLogin}
        disabled={isLoading}
        variant="outline"
        size="lg"
        className="border-2 transition-colors hover:bg-white hover:text-black"
      >
        {isLoading ? "Connect Walet..." : "Connect Wallet"}
      </Button>
      {error && <div className="mt-2 text-sm text-red-500">{error}</div>}
    </div>
  );
}
