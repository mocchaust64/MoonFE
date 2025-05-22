"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { searchGuardiansByUsername } from "@/lib/firebase/guardianService"; 
import { hashRecoveryPhrase } from "@/utils/guardianUtils";
import { createWebAuthnCredential } from "@/utils/webauthnUtils";
import { GuardianData } from "@/types/guardian";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, User, KeySquare, ArrowLeft, ArrowRight, Shield, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

interface RecoveryFormProps {
  readonly currentStep: "search" | "create";
  readonly onStepChange: (step: "search" | "create") => void;
}

export function RecoveryForm({ currentStep, onStepChange }: RecoveryFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newRecoveryPhrase, setNewRecoveryPhrase] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianData | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Function to search for guardian by username and verify recovery phrase (Step 1)
  const handleSearch = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      if (!username) {
        setError("Please enter your guardian name");
        return;
      }
      
      if (!recoveryPhrase) {
        setError("Please enter your recovery key");
        return;
      }
      
      // Search for guardian
      const results = await searchGuardiansByUsername(username);
      
      if (!results || results.length === 0) {
        setError("No guardian found with this username");
        return;
      }
      
      // Select the first guardian (usually there will be only one result)
      setSelectedGuardian(results[0]);
      
      // Set default name for the new guardian as the old name
      setNewUsername(results[0].guardianName || username);
      
      // Move to the credential creation step
      onStepChange("create");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error while searching");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to create new credentials and recover access (Step 2)
  const handleRecover = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      if (!selectedGuardian) {
        setError("No guardian selected");
        return;
      }
      
      if (!newUsername) {
        setError("Please enter a new guardian name");
        return;
      }
      
      if (!newRecoveryPhrase) {
        setError("Please create a new recovery key");
        return;
      }
      
      // 1. Hash old recovery phrase for verification
      const hashedOldRecoveryBytes = await hashRecoveryPhrase(recoveryPhrase);
      
      // 2. Create WebAuthn credential with the new name
      const webAuthnResult = await createWebAuthnCredential(newUsername);
      
      // 3. Create a new ID for the guardian
      const newGuardianId = selectedGuardian.guardianId + 1; // Create new ID by incrementing the old ID
      
      // 4. Call API to perform recovery with the new ID
      const response = await fetch("/api/wallet/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          multisigPDA: selectedGuardian.multisigPDA,
          oldGuardianId: selectedGuardian.guardianId,
          newGuardianId: newGuardianId, // Use new ID
          recoveryPhrase: Array.from(hashedOldRecoveryBytes), // Use old recovery phrase for verification
          webauthnCredentialId: webAuthnResult.credentialId,
          webauthnPublicKey: webAuthnResult.publicKey,
          newGuardianName: newUsername, // Add new name
          newRecoveryPhrase: newRecoveryPhrase // Add new recovery phrase
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error when recovering access");
      }
      
      // Save credential info to localStorage
      localStorage.setItem('current_credential_id', webAuthnResult.credentialId);
      localStorage.setItem('current_guardian_id', newGuardianId.toString());
      
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error during recovery");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Display different steps based on currentStep
  return (
    <Card className="w-full border border-gray-200 bg-white shadow-sm">
      <CardHeader className="border-b border-gray-100">
        <CardTitle className="text-xl text-gray-900 flex items-center">
          {currentStep === "search" && (
            <>
              <User className="mr-2 h-5 w-5 text-blue-500" />
              <span>Verify Account</span>
            </>
          )}
          {currentStep === "create" && (
            <>
              <Shield className="mr-2 h-5 w-5 text-blue-500" />
              <span>Create New Credentials</span>
            </>
          )}
        </CardTitle>
        <CardDescription className="text-gray-500">
          {currentStep === "search" && "Enter your information to search and verify your account"}
          {currentStep === "create" && "Create new credentials to recover your access"}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 pb-5">
        {currentStep === "search" && (
          <motion.div 
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your guardian name"
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">Enter the name you set when registering as a guardian</p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="recovery-phrase" className="block text-sm font-medium text-gray-700 mb-1">Recovery Key</label>
              <div className="relative">
                <KeySquare className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <Input
                  id="recovery-phrase"
                  type="password"
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  placeholder="Enter your recovery key"
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">Enter the recovery key provided when you created your guardian</p>
            </div>
            
            <Button 
              onClick={handleSearch}
              disabled={isLoading || !username || !recoveryPhrase}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </motion.div>
        )}
        
        {currentStep === "create" && !isSuccess && (
          <motion.div 
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-blue-700 font-medium">Account Information:</p>
              {selectedGuardian && (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-gray-600">
                    <span className="text-gray-500">Guardian name:</span> {selectedGuardian.guardianName}
                  </p>
                  <p className="text-gray-600">
                    <span className="text-gray-500">Guardian ID:</span> {selectedGuardian.guardianId}
                  </p>
                  <p className="text-gray-600">
                    <span className="text-gray-500">Wallet address:</span> {selectedGuardian.multisigPDA.slice(0, 8)}...{selectedGuardian.multisigPDA.slice(-8)}
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="new-username" className="block text-sm font-medium text-gray-700 mb-1">New Guardian Name</label>
              <div className="relative">
                <UserPlus className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <Input
                  id="new-username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter new guardian name"
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">Choose a new name for your guardian</p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="new-recovery-phrase" className="block text-sm font-medium text-gray-700 mb-1">New Recovery Key</label>
              <div className="relative">
                <KeySquare className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <Input
                  id="new-recovery-phrase"
                  type="password"
                  value={newRecoveryPhrase}
                  onChange={(e) => setNewRecoveryPhrase(e.target.value)}
                  placeholder="Create new recovery key"
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">Create a new recovery key to protect your account</p>
            </div>
            
            <div className="py-2">
              <p className="text-gray-600 text-sm">
                You will create new credentials with a new name and recovery key to replace the old information.
                Your device will request authentication (fingerprint, Face ID...).
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => onStepChange("search")}
                className="border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button 
                onClick={handleRecover}
                disabled={isLoading || !newUsername || !newRecoveryPhrase}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    <span>Recover Access</span>
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
        
        {currentStep === "create" && isSuccess && (
          <motion.div 
            className="space-y-5 text-center py-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-green-600 mb-2">Recovery Successful!</h3>
              <p className="text-gray-600 text-sm">
                Your access has been recovered with new credentials. You can now access your wallet.
              </p>
            </div>
            
            <Button 
              onClick={() => router.push("/(app)/dashboard")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </motion.div>
        )}
        
        {error && (
          <div className="mt-4 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 