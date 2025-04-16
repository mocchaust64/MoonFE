"use client";

import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Buffer } from "buffer";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { connection } from "@/lib/solana";
import { useWalletStore } from "@/store/walletStore";
import { compressPublicKey } from "@/utils/bufferUtils";
import { getMultisigPDA, getGuardianPDA } from "@/utils/credentialUtils";
import { hashRecoveryPhrase } from "@/utils/guardianUtils";
import { createWebAuthnCredential } from "@/utils/webauthnUtils";
import { saveWebAuthnCredentialMapping } from "@/lib/firebase/webAuthnService";

export default function CreateWallet() {
  const router = useRouter();
  const [walletName, setWalletName] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [threshold, setThreshold] = useState(1);
  const MAX_ALLOWED_THRESHOLD = 8;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState<
    "details" | "members" | "review"
  >("details");
  const { setMultisigPDA, setWalletData } = useWalletStore();
  
  const handleCreateWallet = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Kiểm tra ngưỡng ký không vượt quá MAX_ALLOWED_THRESHOLD
      const validThreshold = Math.min(threshold, MAX_ALLOWED_THRESHOLD);
      
      const result = await createWebAuthnCredential(walletName);
      const rawIdBase64 = Buffer.from(result.rawId).toString("base64");

      const multisigPDA = getMultisigPDA(rawIdBase64);
      const guardianPDA = getGuardianPDA(multisigPDA, 1);

      const walletResponse = await fetch("/api/wallet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threshold: validThreshold,
          credentialId: rawIdBase64,
          name: walletName,
          multisigPDA: multisigPDA.toString(),
        }),
      });

      if (!walletResponse.ok) {
        const errorData = await walletResponse.json();
        throw new Error(
          `Failed to create wallet: ${errorData.error || "Unknown error"}`,
        );
      }

      const walletData = await walletResponse.json();
      await connection.confirmTransaction(walletData.signature);

      const recoveryHashIntermediate = await hashRecoveryPhrase(recoveryPhrase);

      const uncompressedKeyBuffer = Buffer.from(result.publicKey, "hex");
      const compressedKeyBuffer = compressPublicKey(uncompressedKeyBuffer);

      // Thêm guardian chính (owner)
      const guardianResponse = await fetch("/api/guardian/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardianId: 1,
          guardianName: walletName || "Owner",
          recoveryHashIntermediate: Array.from(recoveryHashIntermediate),
          webauthnPubkey: Array.from(compressedKeyBuffer),
          webauthnCredentialId: rawIdBase64,
          multisigPDA: multisigPDA.toString(),
        }),
      });

      if (!guardianResponse.ok) {
        const errorData = await guardianResponse.json();
        throw new Error(
          `Failed to add guardian: ${errorData.error || "Unknown error"}`,
        );
      }

      await guardianResponse.json();
      
      const webauthnMapping = {
              credentialId: rawIdBase64,
              walletAddress: multisigPDA.toString(),
              guardianPublicKey: Array.from(
                new Uint8Array(compressedKeyBuffer)
              ),
              guardianId: 1
            };

            localStorage.setItem('current_credential_id', rawIdBase64);

            localStorage.setItem(
              "webauthn_credential_" + rawIdBase64,
              JSON.stringify(webauthnMapping)
            );

      await saveWebAuthnCredentialMapping(
        rawIdBase64,             // credential ID
        multisigPDA.toString(),  // địa chỉ ví
        Array.from(new Uint8Array(compressedKeyBuffer)), // public key
        1,                       // guardianId = 1 (owner)
        walletName,              // Thêm walletName 
        validThreshold            // Thêm threshold
      );

      setMultisigPDA(multisigPDA.toString());
      setWalletData({
        walletName,
        threshold: validThreshold,
        guardianCount: 1, // Ban đầu chỉ có 1 guardian (owner)
        lastUpdated: Date.now(),
      });

      router.push("/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[420px] rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-zinc-950">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <div
                className={`h-2 w-2 rounded-full ${currentStep === "details" ? "bg-blue-500" : "bg-gray-200"}`}
              />
              <div
                className={`h-2 w-2 rounded-full ${currentStep === "members" ? "bg-blue-500" : "bg-gray-200"}`}
              />
              <div
                className={`h-2 w-2 rounded-full ${currentStep === "review" ? "bg-blue-500" : "bg-gray-200"}`}
              />
            </div>
            <div className="text-sm text-gray-500">
              Step{" "}
              {currentStep === "details"
                ? "1"
                : currentStep === "members"
                  ? "2"
                  : "3"}{" "}
              of 3
            </div>
          </div>
        </div>

        {currentStep === "details" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-2 text-xl font-semibold">Name your wallet</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Give your wallet a name to help you identify it
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Wallet Name
                </label>
                <Input
                  placeholder="Enter wallet name"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  maxLength={32}
                  className="h-11"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Recovery Key
                </label>
                <Input
                  placeholder="Enter recovery key"
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  maxLength={32}
                  className="h-11"
                />
              </div>
            </div>

            <div className="mt-auto pt-6">
              <Button
                className="h-11 w-full text-base font-medium"
                onClick={() => setCurrentStep("members")}
                disabled={!walletName}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {currentStep === "members" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-2 text-xl font-semibold">
                Cấu hình bảo mật
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Thiết lập ngưỡng xác nhận cho ví
              </p>
            </div>

            <div className="space-y-3 rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                    <svg
                      className="h-5 w-5 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Chủ ví (Bạn)</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Xác thực sinh trắc học
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500">1/1 hiện tại</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Ngưỡng xác nhận</h3>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {threshold} chữ ký cần thiết
                </span>
              </div>
              <Slider
                value={[threshold]}
                min={1}
                max={MAX_ALLOWED_THRESHOLD}
                step={1}
                onValueChange={(value) => setThreshold(value[0])}
                className="w-full"
              />
              <p className="text-sm text-gray-500">
                Số lượng chữ ký cần thiết để xác nhận giao dịch
              </p>
              <p className="text-xs text-amber-500 italic">
                <strong>Lưu ý quan trọng:</strong> Sau khi tạo ví, bạn cần mời thêm ít nhất {threshold > 1 ? threshold - 1 : 0} guardian 
                để đủ số người ký cần thiết cho giao dịch.
              </p>
            </div>

            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
              <InfoCircledIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Bạn có thể thêm thành viên và điều chỉnh ngưỡng xác nhận sau khi tạo ví
              </AlertDescription>
            </Alert>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={() => setCurrentStep("details")}
              >
                Quay lại
              </Button>
              <Button
                className="h-12 flex-1"
                onClick={() => setCurrentStep("review")}
              >
                Tiếp tục
              </Button>
            </div>
          </div>
        )}

        {currentStep === "review" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-2 text-xl font-semibold">Xem lại & Tạo ví</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Kiểm tra cấu hình ví trước khi tạo
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold">{walletName}</h3>
              {recoveryPhrase && (
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                  {recoveryPhrase}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
                <p className="text-3xl font-bold">1</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Thành viên
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
                <p className="text-3xl font-bold">{threshold}/8</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ngưỡng ký
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
                <p className="text-3xl font-bold">Miễn phí</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Phí (SOL)
                </p>
              </div>
            </div>

            {threshold > 1 && (
              <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  <strong>Lưu ý:</strong> Với ngưỡng ký là {threshold}, bạn sẽ cần mời thêm ít nhất {threshold - 1} guardian 
                  sau khi tạo ví để có thể thực hiện giao dịch.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex space-x-3">
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={() => setCurrentStep("members")}
              >
                Quay lại
              </Button>
              <Button
                className="h-12 flex-1"
                onClick={handleCreateWallet}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang tạo ví...
                  </>
                ) : (
                  "Tạo ví"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
