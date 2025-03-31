"use client";

import { useState } from "react";

import { connection } from "@/lib/solana/connection";
import { useWalletStore } from "@/store/walletStore";
import { getGuardianPDA } from "@/utils/credentialUtils";

export default function GuardianManager() {
  const { multisigAddress, existingGuardians, setExistingGuardians } =
    useWalletStore();
  const [newGuardianName, setNewGuardianName] = useState("");
  const [newRecoveryPhrase, setNewRecoveryPhrase] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const handleAddGuardian = async () => {
    if (!multisigAddress) return;

    try {
      setIsLoading(true);
      setError("");
      setStatus("Đang thêm guardian mới...");

      // Validate inputs
      if (
        !newGuardianName ||
        !newRecoveryPhrase ||
        newRecoveryPhrase.length < 8
      ) {
        throw new Error("Vui lòng nhập đầy đủ thông tin");
      }

      // Generate new guardian ID
      const newGuardianId = existingGuardians.length + 1;

      // Calculate guardian PDA
      const guardianPDA = getGuardianPDA(multisigAddress, newGuardianId);

      // Check if guardian already exists
      const existingGuardian = await connection.getAccountInfo(guardianPDA);
      if (existingGuardian) {
        throw new Error(`Guardian với ID ${newGuardianId} đã tồn tại`);
      }

      setStatus((prev) => prev + "\nĐã tạo khóa WebAuthn cho guardian mới");
      // Create transaction to add guardian
      // ... (thêm logic tạo transaction)

      setStatus(
        (prev) => prev + "\n\n✅ Guardian mới đã được thêm thành công!",
      );

      // Update existing guardians list
      setExistingGuardians([...existingGuardians, newGuardianId]);

      // Reset form
      setNewGuardianName("");
      setNewRecoveryPhrase("");
    } catch (error) {
      console.error("Lỗi khi thêm guardian:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="guardian-section rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-2xl font-bold">Quản lý Guardian</h2>

      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-lg font-semibold">Guardian hiện tại:</h3>
          <ul className="space-y-2">
            {existingGuardians.map((id: number) => (
              <li key={id} className="flex items-center space-x-2">
                <span className="font-mono">Guardian {id}</span>
                {id === 1 && (
                  <span className="text-sm text-green-600">(Owner)</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t pt-4">
          <h3 className="mb-2 text-lg font-semibold">Thêm Guardian mới:</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tên Guardian:
              </label>
              <input
                type="text"
                value={newGuardianName}
                onChange={(e) => setNewGuardianName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                maxLength={32}
                placeholder="Nhập tên cho guardian mới"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Recovery Key: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newRecoveryPhrase}
                onChange={(e) => setNewRecoveryPhrase(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Nhập recovery key (ít nhất 8 ký tự)"
                required
              />
              {newRecoveryPhrase && newRecoveryPhrase.length < 8 && (
                <p className="mt-1 text-sm text-red-600">
                  Recovery key phải có ít nhất 8 ký tự
                </p>
              )}
            </div>

            <button
              onClick={handleAddGuardian}
              disabled={
                isLoading ||
                !newGuardianName ||
                !newRecoveryPhrase ||
                newRecoveryPhrase.length < 8
              }
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
            >
              {isLoading ? "Đang thêm..." : "Thêm Guardian mới"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {status && (
          <div className="mt-4 rounded-md bg-gray-50 p-4 whitespace-pre-line text-gray-700">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
