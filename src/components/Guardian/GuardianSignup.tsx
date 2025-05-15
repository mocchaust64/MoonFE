"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  saveGuardianData,
  getInvitation,
  getGuardianData,
  checkGuardianNameExists,
} from "@/lib/firebase/guardianService";
import { saveWebAuthnCredentialMapping } from "@/lib/firebase/webAuthnService";
import { GuardianData } from "@/types/guardian";
import { compressPublicKey } from "@/utils/bufferUtils";
import { hashRecoveryPhrase } from "@/utils/guardianUtils";
import { createWebAuthnCredential } from "@/utils/webauthnUtils";

export interface GuardianSignupProps {
  readonly inviteCode: string;
  readonly onComplete?: () => void;
}

export function GuardianSignup({
  inviteCode,
  onComplete,
}: GuardianSignupProps) {
  const router = useRouter();
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [guardianId, setGuardianId] = useState<number | null>(null);
  const [isRegistrationSuccess, setIsRegistrationSuccess] = useState(false);
  const [walletName, setWalletName] = useState<string>("");
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const checkGuardianStatus = useCallback(async () => {
    try {
      const guardianData = await getGuardianData(inviteCode);
      if (guardianData?.status === "completed") {
        setStatus("Guardian registration confirmed! Redirecting...");
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error checking guardian status:", error);
    }
  }, [inviteCode, router, setStatus]);

  useEffect(() => {
    const loadInvitation = async () => {
      try {
        setIsInitialLoading(true);
        setLoadError(null);
        setStatus("Loading invitation details...");
        
        const invitation = await getInvitation(inviteCode);

        if (!invitation) {
          setLoadError("Invitation not found. Please check your invite code.");
          setStatus("Invitation not found. Please check your invite code.");
          return;
        }

        setGuardianId(invitation.guardianId);
        setWalletName(invitation.walletName);
        setStatus(`Invitation loaded. Guardian ID: ${invitation.guardianId}`);
        await checkGuardianStatus();
      } catch (error) {
        console.error("Error loading invitation:", error);
        setLoadError("Error loading invitation details. Please try refreshing the page.");
        setStatus("Error loading invitation details");
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInvitation();
  }, [inviteCode, checkGuardianStatus]);

  useEffect(() => {
    if (!isRegistrationSuccess) return;

    const interval = setInterval(checkGuardianStatus, 5000);
    return () => clearInterval(interval);
  }, [isRegistrationSuccess, inviteCode, checkGuardianStatus]);

  const checkDuplicateName = async (name: string) => {
    if (!name) return;
    
    setIsCheckingName(true);
    setNameError("");
    
    try {
      const exists = await checkGuardianNameExists(name);
      if (exists) {
        setNameError("Tên guardian này đã tồn tại. Vui lòng chọn tên khác.");
      }
    } catch (error) {
      console.error("Lỗi khi kiểm tra tên:", error);
    } finally {
      setIsCheckingName(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);

      if (!guardianId) {
        throw new Error("Guardian ID not found in invitation");
      }

      if (!recoveryPhrase) {
        throw new Error("Please enter recovery phrase");
      }

      if (!guardianName) {
        throw new Error("Vui lòng nhập tên Guardian");
      }

      const exists = await checkGuardianNameExists(guardianName);
      if (exists) {
        setNameError("Tên guardian này đã tồn tại. Vui lòng chọn tên khác.");
        setIsLoading(false);
        return;
      }

      const webAuthnResult = await createWebAuthnCredential(walletName);

      const hashedRecoveryBytes = await hashRecoveryPhrase(recoveryPhrase);

      const compressedKey = compressPublicKey(
        Buffer.from(webAuthnResult.publicKey, "hex"),
      );

      const invitation = await getInvitation(inviteCode);
      if (!invitation) {
        throw new Error("Invitation not found");
      }

      const guardianData: GuardianData = {
        inviteCode,
        guardianId,
        multisigPDA: invitation.multisigPDA,
        hashedRecoveryBytes: Array.from(hashedRecoveryBytes),
        webauthnCredentialId: webAuthnResult.credentialId,
        webauthnPublicKey: Array.from(compressedKey),
        status: "ready",
        createdAt: new Date(),
        guardianName: guardianName,
        isOwner: true
      };

      await saveGuardianData(guardianData);

      await saveWebAuthnCredentialMapping(
        webAuthnResult.credentialId,
        invitation.multisigPDA,
        Array.from(compressedKey),
        invitation.guardianId,
        guardianName,
        invitation.threshold,
        true
      );

      localStorage.setItem('current_credential_id', webAuthnResult.credentialId);
      localStorage.setItem('current_guardian_id', invitation.guardianId.toString());
      
      localStorage.setItem(
        "webauthn_credential_" + webAuthnResult.credentialId,
        JSON.stringify({
          credentialId: webAuthnResult.credentialId,
          walletAddress: invitation.multisigPDA,
          guardianPublicKey: Array.from(compressedKey),
          guardianId: invitation.guardianId
        })
      );

      setIsRegistrationSuccess(true);
      setStatus("Registration successful! Waiting for owner confirmation.");
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error("Error registering guardian:", error);
      setStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isInitialLoading ? (
        <Card className="w-full max-w-md border-zinc-800/70 bg-zinc-900/60 backdrop-blur-lg shadow-xl">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-4"></div>
            <p className="text-blue-200">Loading invitation details...</p>
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card className="w-full max-w-md border-red-800/30 bg-zinc-900/60 backdrop-blur-lg shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl text-center text-red-300">
              Error Loading Invitation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-red-300 mb-4">{loadError}</div>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-red-800/50 hover:bg-red-800/70"
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md border-zinc-800/70 bg-zinc-900/60 backdrop-blur-lg shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl text-center sm:text-left">
              Register as Guardian for{" "}
              <span className="text-blue-400">{walletName || "Unnamed Wallet"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="guardian-name" className="mb-1.5 block text-sm font-medium text-gray-300">
                  Tên Guardian
                </label>
                <Input
                  id="guardian-name"
                  value={guardianName}
                  onChange={(e) => {
                    setGuardianName(e.target.value);
                    setNameError("");
                  }}
                  onBlur={() => checkDuplicateName(guardianName)}
                  disabled={isRegistrationSuccess}
                  placeholder="Nhập tên guardian của bạn"
                  required
                  className="bg-zinc-800/60 border-zinc-700/50"
                />
                {nameError && (
                  <p className="mt-1.5 text-sm text-red-400">{nameError}</p>
                )}
                {isCheckingName && (
                  <p className="mt-1.5 text-sm text-blue-400">Đang kiểm tra tên...</p>
                )}
              </div>
              
              <div>
                <label htmlFor="recovery-phrase" className="mb-1.5 block text-sm font-medium text-gray-300">
                  Recovery Phrase
                </label>
                <Input
                  id="recovery-phrase"
                  type="password"
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  disabled={isRegistrationSuccess}
                  placeholder="Enter recovery phrase"
                  required
                  className="bg-zinc-800/60 border-zinc-700/50"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  This phrase will be used to recover your wallet in case of emergency
                </p>
              </div>

              {status && (
                <div
                  className={`mt-3 rounded-md p-3 text-sm ${
                    isRegistrationSuccess
                      ? "bg-green-900/30 text-green-300 border border-green-700/50"
                      : "bg-blue-900/20 text-blue-300 border border-blue-800/40"
                  }`}
                >
                  {status}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !guardianId || isRegistrationSuccess || nameError !== ""}
                className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {(() => {
                  if (isLoading) {
                    return (
                      <span className="flex items-center justify-center">
                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2"></span>
                        Processing...
                      </span>
                    );
                  } else if (isRegistrationSuccess) {
                    return "Registration Submitted";
                  } else {
                    return "Register";
                  }
                })()}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}
