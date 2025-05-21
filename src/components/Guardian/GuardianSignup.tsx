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
        setNameError("This guardian name already exists. Please choose a different name.");
      }
    } catch (error) {
      console.error("Error checking name:", error);
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
        throw new Error("Please enter Guardian name");
      }

      const exists = await checkGuardianNameExists(guardianName);
      if (exists) {
        setNameError("This guardian name already exists. Please choose a different name.");
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
        <Card className="w-full max-w-md p-6 border bg-white/10 backdrop-blur-sm shadow-sm">
          <CardContent className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4"></div>
            <p className="text-primary">Loading invitation details...</p>
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card className="w-full max-w-md p-6 border bg-white/10 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-center text-destructive">
              Error Loading Information
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-destructive mb-4">{loadError}</div>
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
              className="bg-white/20 hover:bg-white/30"
            >
              Reload Page
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md p-6 border bg-white/10 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">
              Register as Guardian for {walletName || "Unnamed Wallet"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Guardian Name
                </label>
                <Input
                  value={guardianName}
                  onChange={(e) => {
                    setGuardianName(e.target.value);
                    setNameError("");
                  }}
                  onBlur={() => checkDuplicateName(guardianName)}
                  disabled={isRegistrationSuccess}
                  placeholder="Enter your guardian name"
                  className="bg-white/20"
                  required
                />
                {nameError && (
                  <p className="mt-1.5 text-sm text-destructive">{nameError}</p>
                )}
                {isCheckingName && (
                  <p className="mt-1.5 text-sm text-muted-foreground">Checking name...</p>
                )}
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Recovery Phrase
                </label>
                <Input
                  type="password"
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  disabled={isRegistrationSuccess}
                  placeholder="Enter recovery phrase"
                  className="bg-white/20"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This phrase will be used to recover your wallet in case of emergency
                </p>
              </div>

              {status && (
                <div
                  className={`p-3 rounded text-sm ${
                    isRegistrationSuccess
                      ? "bg-green-100/30 text-green-800 backdrop-blur-sm"
                      : "bg-white/20 text-foreground backdrop-blur-sm"
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
      )}
    </>
  );
}
