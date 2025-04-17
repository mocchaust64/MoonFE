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
  inviteCode: string;
  onComplete?: () => void;
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
  const [guardianId, setGuardianId] = useState<number | null>(null);
  const [isRegistrationSuccess, setIsRegistrationSuccess] = useState(false);
  const [walletName, setWalletName] = useState<string>("");
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameError, setNameError] = useState("");

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
        setStatus("Loading invitation details...");
        const invitation = await getInvitation(inviteCode);

        if (!invitation) {
          setStatus("Invitation not found. Please check your invite code.");
          return;
        }

        setGuardianId(invitation.guardianId);
        setWalletName(invitation.walletName);
        setStatus(`Invitation loaded. Guardian ID: ${invitation.guardianId}`);
        await checkGuardianStatus();
      } catch (error) {
        console.error("Error loading invitation:", error);
        setStatus("Error loading invitation details");
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
    <Card className="w-full max-w-md p-6">
      <CardHeader>
        <CardTitle>
          Register as Guardian for {walletName || "Unnamed Wallet"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Tên Guardian
            </label>
            <Input
              value={guardianName}
              onChange={(e) => {
                setGuardianName(e.target.value);
                setNameError("");
              }}
              onBlur={() => checkDuplicateName(guardianName)}
              disabled={isRegistrationSuccess}
              placeholder="Nhập tên guardian của bạn"
              required
            />
            {nameError && (
              <p className="mt-1 text-sm text-red-500">{nameError}</p>
            )}
            {isCheckingName && (
              <p className="mt-1 text-sm text-blue-500">Đang kiểm tra tên...</p>
            )}
          </div>
          
          <div>
            <label className="mb-1 block text-sm font-medium">
              Recovery Phrase
            </label>
            <Input
              type="password"
              value={recoveryPhrase}
              onChange={(e) => setRecoveryPhrase(e.target.value)}
              disabled={isRegistrationSuccess}
              placeholder="Enter recovery phrase"
              required
            />
          </div>

          {status && (
            <div
              className={`mt-2 rounded p-2 text-sm ${
                isRegistrationSuccess
                  ? "bg-green-100 text-green-800"
                  : "bg-secondary/50"
              }`}
            >
              {status}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || !guardianId || isRegistrationSuccess || nameError !== ""}
            className="w-full"
          >
            {isLoading
              ? "Processing..."
              : isRegistrationSuccess
                ? "Registration Submitted"
                : "Register"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
