"use client";

import { InfoCircledIcon } from "@radix-ui/react-icons";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { connection } from "@/lib/solana/connection";
import { PROGRAM_ID } from "@/lib/solana/connection";
import { useWalletStore } from "@/store/walletStore";
import { getMultisigPDA } from "@/utils/credentialUtils";
import { createWebAuthnCredential } from "@/utils/webauthnUtils";

// Hàm chuyển đổi Buffer sang Uint8Array
function bufferToUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

// Hàm concat cho Uint8Array
function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

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

// Hàm nén khóa công khai từ dạng uncompressed (65 bytes) sang compressed (33 bytes)
const compressPublicKey = (uncompressedKey: Buffer): Buffer => {
  if (uncompressedKey[0] !== 0x04 || uncompressedKey.length !== 65) {
    console.warn(
      "Khóa không đúng định dạng không nén ECDSA, tạo khóa ngẫu nhiên",
    );
    const randomKey = Buffer.alloc(33);
    randomKey[0] = 0x02;
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < 32; i++) {
      randomKey[i + 1] = randomBytes[i];
    }
    return randomKey;
  }

  const x = new Uint8Array(uncompressedKey.slice(1, 33));
  const y = new Uint8Array(uncompressedKey.slice(33, 65));
  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;

  const compressedKey = Buffer.alloc(33);
  compressedKey[0] = prefix;
  for (let i = 0; i < 32; i++) {
    compressedKey[i + 1] = x[i];
  }

  return compressedKey;
};

// Hàm hash recovery phrase
const hashRecoveryPhrase = async (phrase: string): Promise<Uint8Array> => {
  const phraseBytes = new TextEncoder().encode(phrase);
  const inputBytes = new Uint8Array(32);
  inputBytes.set(phraseBytes.slice(0, Math.min(phraseBytes.length, 32)));
  const hashBuffer = await crypto.subtle.digest("SHA-256", inputBytes);
  return new Uint8Array(hashBuffer);
};

// Thêm hàm chuyển đổi secret key
const convertSecretKeyStringToUint8Array = (
  secretKeyString: string | undefined,
): Uint8Array => {
  if (!secretKeyString) {
    throw new Error(
      "Fee payer secret key không được định nghĩa trong biến môi trường",
    );
  }

  const numbers = secretKeyString.split(",").map((s) => parseInt(s.trim(), 10));

  if (numbers.length !== 64 && numbers.length !== 65) {
    throw new Error(
      `Secret key phải có 64 hoặc 65 bytes, nhưng có ${numbers.length} bytes`,
    );
  }

  const bytes = numbers.length === 65 ? numbers.slice(0, 64) : numbers;
  return new Uint8Array(bytes);
};

export default function CreateWallet() {
  const router = useRouter();
  const {
    setMultisigAddress,
    setGuardianPDA,
    fetchPdaBalance,
    setIsLoggedIn,
    setWalletKeypair,
  } = useWalletStore();
  const [currentStep, setCurrentStep] = useState("details");
  const [walletName, setWalletName] = useState("");
  const [walletDescription, setWalletDescription] = useState("");
  const [threshold] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateWallet = async () => {
    try {
      setIsLoading(true);
      setError("");

      // 1. Tạo khóa WebAuthn
      const result = await createWebAuthnCredential(
        walletName || "Moon Wallet",
        walletName || "Moon Wallet",
      );
      const rawIdBase64 = Buffer.from(result.rawId).toString("base64");

      // 2. Tính PDA cho ví
      const multisigPDA = getMultisigPDA(rawIdBase64);
      setMultisigAddress(multisigPDA);

      // 3. Tính PDA cho guardian
      const guardianId = BigInt(1); // Owner có ID = 1
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

      // 4. Lấy fee payer từ biến môi trường
      const feePayerSecretKey = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY;
      if (!feePayerSecretKey) {
        throw new Error(
          "Fee payer secret key not found in environment variables",
        );
      }

      const feePayerPrivateKey =
        convertSecretKeyStringToUint8Array(feePayerSecretKey);
      const feePayerKeypair = Keypair.fromSecretKey(feePayerPrivateKey);

      // 5. Tạo transaction
      const transaction = new Transaction();
      transaction.feePayer = feePayerKeypair.publicKey;

      // 5.1 Khởi tạo Multisig
      const initMultisigDiscriminator = new Uint8Array([
        220, 130, 117, 21, 27, 227, 78, 213,
      ]);
      const thresholdBytes = new Uint8Array([threshold]);

      const credentialIdString = rawIdBase64;
      const credentialIdBuffer = Buffer.from(credentialIdString);

      const credentialIdLenBuffer = Buffer.alloc(4);
      credentialIdLenBuffer.writeUInt32LE(credentialIdBuffer.length, 0);
      const credentialIdLenBytes = bufferToUint8Array(credentialIdLenBuffer);
      const credentialIdDataBytes = bufferToUint8Array(credentialIdBuffer);

      const initData = concatUint8Arrays(
        initMultisigDiscriminator,
        thresholdBytes,
        credentialIdLenBytes,
        credentialIdDataBytes,
      );

      transaction.add(
        new TransactionInstruction({
          keys: [
            { pubkey: multisigPDA, isSigner: false, isWritable: true },
            {
              pubkey: feePayerKeypair.publicKey,
              isSigner: true,
              isWritable: true,
            },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data: Buffer.from(initData),
        }),
      );

      // 5.2 Thêm guardian đầu tiên (owner)
      const hashedRecoveryBytes = await hashRecoveryPhrase(
        walletName || "Moon Wallet",
      );
      const addGuardianDiscriminator = new Uint8Array([
        167, 189, 170, 27, 74, 240, 201, 241,
      ]);
      const guardianNameBuffer = Buffer.from(walletName || "Moon Wallet");
      const guardianNameLenBuffer = Buffer.alloc(4);
      guardianNameLenBuffer.writeUInt32LE(guardianNameBuffer.length, 0);
      const isOwnerByte = new Uint8Array([1]);
      const uncompressedKeyBuffer = Buffer.from(result.publicKey, "hex");
      const compressedKeyBuffer = compressPublicKey(uncompressedKeyBuffer);

      const addGuardianData = concatUint8Arrays(
        addGuardianDiscriminator,
        bufferToUint8Array(Buffer.from(guardianIdBytes)),
        bufferToUint8Array(guardianNameLenBuffer),
        bufferToUint8Array(guardianNameBuffer),
        hashedRecoveryBytes,
        isOwnerByte,
        new Uint8Array([1]),
        bufferToUint8Array(compressedKeyBuffer),
      );

      transaction.add(
        new TransactionInstruction({
          keys: [
            { pubkey: multisigPDA, isSigner: false, isWritable: true },
            { pubkey: guardianPDAAddress, isSigner: false, isWritable: true },
            {
              pubkey: feePayerKeypair.publicKey,
              isSigner: false,
              isWritable: false,
            },
            {
              pubkey: feePayerKeypair.publicKey,
              isSigner: true,
              isWritable: true,
            },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data: Buffer.from(addGuardianData),
        }),
      );

      // 6. Gửi transaction
      const latestBlockhash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = latestBlockhash.blockhash;

      const signature = await connection.sendTransaction(transaction, [
        feePayerKeypair,
      ]);

      await connection.confirmTransaction(signature);

      // Update store
      setMultisigAddress(multisigPDA);
      setGuardianPDA(guardianPDAAddress);
      await fetchPdaBalance();
      setIsLoggedIn(true);
      setWalletKeypair(feePayerKeypair);

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Error creating wallet:", error);
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
                  Description
                </label>
                <Input
                  placeholder="Description (optional)"
                  value={walletDescription}
                  onChange={(e) => setWalletDescription(e.target.value)}
                  maxLength={64}
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
                Security Configuration
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Set up wallet members and confirmation threshold
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
                    <p className="font-medium">Owner (You)</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Biometric authentication
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500">1/1</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Confirmation Threshold</h3>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  1 signature required
                </span>
              </div>
              <Slider
                value={[threshold]}
                min={1}
                max={1}
                step={1}
                className="w-full"
              />
              <p className="text-sm text-gray-500">
                Number of signatures required to approve transactions
              </p>
            </div>

            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
              <InfoCircledIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                You can add more members and adjust the threshold after wallet
                creation
              </AlertDescription>
            </Alert>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={() => setCurrentStep("details")}
              >
                Back
              </Button>
              <Button
                className="h-12 flex-1"
                onClick={() => setCurrentStep("review")}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {currentStep === "review" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-2 text-xl font-semibold">Review & Create</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Verify your wallet configuration before creation
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold">{walletName}</h3>
              {walletDescription && (
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                  {walletDescription}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
                <p className="text-3xl font-bold">1</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Member
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
                <p className="text-3xl font-bold">1/1</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Threshold
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
                <p className="text-3xl font-bold">~0.05</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Fee (SOL)
                </p>
              </div>
            </div>

            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
              <InfoCircledIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Creation fee includes 0.05 SOL platform fee and network fees
              </AlertDescription>
            </Alert>

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
                Back
              </Button>
              <Button
                className="h-12 flex-1"
                onClick={handleCreateWallet}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating wallet...
                  </>
                ) : (
                  "Create Wallet"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
