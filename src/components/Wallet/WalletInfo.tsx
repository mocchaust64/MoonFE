"use client";

import { useState, useEffect, useCallback } from "react";

import { connection } from "@/lib/solana/connection";
import { useWalletStore } from "@/store/walletStore";

interface WalletInfo {
  threshold: number;
  guardianCount: number;
  recoveryNonce: bigint;
  bump: number;
  transactionNonce: bigint;
  lastTransactionTimestamp: bigint;
}

export default function WalletInfo() {
  const { multisigAddress, pdaBalance, fetchPdaBalance } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);

  const loadWalletInfo = useCallback(async () => {
    if (!multisigAddress) return;

    try {
      setIsLoading(true);
      setError("");

      // Load balance
      await fetchPdaBalance();

      // Load account info
      const accountInfo = await connection.getAccountInfo(multisigAddress);
      if (!accountInfo) {
        throw new Error("Không tìm thấy thông tin ví");
      }

      // Parse account data
      const data = accountInfo.data.slice(8); // Skip discriminator
      const threshold = data[0];
      const guardianCount = data[1];
      const recoveryNonce = new DataView(
        data.buffer,
        data.byteOffset + 2,
        8,
      ).getBigUint64(0, true);
      const bump = data[10];
      const transactionNonce = new DataView(
        data.buffer,
        data.byteOffset + 11,
        8,
      ).getBigUint64(0, true);
      const lastTransactionTimestamp = new DataView(
        data.buffer,
        data.byteOffset + 19,
        8,
      ).getBigInt64(0, true);

      setWalletInfo({
        threshold,
        guardianCount,
        recoveryNonce,
        bump,
        transactionNonce,
        lastTransactionTimestamp,
      });
    } catch (error) {
      console.error("Lỗi khi tải thông tin ví:", error);
    } finally {
      setIsLoading(false);
    }
  }, [multisigAddress, fetchPdaBalance]);

  useEffect(() => {
    if (multisigAddress) {
      loadWalletInfo();
    }
  }, [multisigAddress, loadWalletInfo]);

  return (
    <div className="wallet-info-section rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-2xl font-bold">Thông tin ví Moon Wallet</h2>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600">Địa chỉ ví:</p>
          <p className="font-mono break-all">{multisigAddress?.toString()}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Số dư:</p>
          <p className="font-mono">{pdaBalance} SOL</p>
        </div>

        {walletInfo && (
          <>
            <div>
              <p className="text-sm text-gray-600">Threshold:</p>
              <p className="font-mono">{walletInfo.threshold}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Số lượng Guardian:</p>
              <p className="font-mono">{walletInfo.guardianCount}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Recovery Nonce:</p>
              <p className="font-mono">{walletInfo.recoveryNonce.toString()}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Transaction Nonce:</p>
              <p className="font-mono">
                {walletInfo.transactionNonce.toString()}
              </p>
            </div>
          </>
        )}

        <button
          onClick={loadWalletInfo}
          disabled={isLoading || !multisigAddress}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
        >
          {isLoading ? "Đang tải..." : "Cập nhật thông tin"}
        </button>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
