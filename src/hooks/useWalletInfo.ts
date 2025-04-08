import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useCallback } from "react";

import { connection } from "@/lib/solana";
import { program } from "@/lib/solana";
import { useWalletStore } from "@/store/walletStore";
import { getGuardiansFromBlockchain } from "@/utils/guardianUtils";

// Key để lưu trữ thời gian fetch lần cuối trong localStorage
const LAST_FETCH_TIME_KEY = "moonwallet_last_fetch_time";

export function useWalletInfo() {
  const {
    multisigPDA,
    setWalletData,
    setLoading,
    setError,
    balance,
    threshold,
    guardianCount,
    guardians,
    walletName,
    lastUpdated,
    isLoading,
    error,
  } = useWalletStore();

  // Fetch full wallet info
  const fetchInfo = useCallback(async () => {
    if (!multisigPDA) return;

    setLoading(true);
    setError(null);

    try {
      const pubkey =
        typeof multisigPDA === "string"
          ? new PublicKey(multisigPDA)
          : multisigPDA;

      // Get balance
      const solBalance = await connection.getBalance(pubkey);

      // Get guardians
      const guardians = await getGuardiansFromBlockchain(multisigPDA);

      // Get and decode MultiSigWallet account data
      const accountInfo = await connection.getAccountInfo(pubkey);
      if (!accountInfo) {
        throw new Error("Multisig account not found");
      }

      const multisigData = program.coder.accounts.decode(
        "multiSigWallet",
        accountInfo.data,
      );

      setWalletData({
        balance: solBalance / LAMPORTS_PER_SOL,
        threshold: multisigData.threshold,
        guardianCount: multisigData.guardianCount,
        guardians,
        walletName: multisigData.name || "Unnamed Wallet",
      });

      // Lưu thời gian fetch lần cuối vào localStorage
      localStorage.setItem(LAST_FETCH_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.error("Error fetching wallet info:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [multisigPDA, setWalletData, setLoading, setError]);

  // Subscribe to account changes
  useEffect(() => {
    if (!multisigPDA) return;

    const pubkey =
      typeof multisigPDA === "string"
        ? new PublicKey(multisigPDA)
        : multisigPDA;

    console.log("Setting up WebSocket subscription for:", pubkey.toString());

    let previousData: Buffer | null = null;

    // Subscribe to account changes
    const subscriptionId = connection.onAccountChange(
      pubkey,
      (accountInfo) => {
        // Compare new data with previous data
        if (!previousData || !accountInfo.data.equals(previousData)) {
          console.log("Account data changed, fetching full wallet info");
          previousData = accountInfo.data;
          fetchInfo();
        } else {
          console.log("Account data unchanged, skipping fetch");
        }
      },
      "confirmed",
    );

    // Always fetch when multisigPDA changes
    console.log("Fetching initial wallet info");
    fetchInfo().then(() => {
      // Store initial data after fetch
      connection.getAccountInfo(pubkey).then((info) => {
        if (info) {
          previousData = info.data;
        }
      });
    });

    return () => {
      console.log("Cleaning up WebSocket subscription");
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [multisigPDA, fetchInfo]);

  const formatAddress = useCallback((address: string) => {
    if (!address) return "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }, []);

  return {
    // Return cached data
    multisigPDA,
    balance,
    threshold,
    guardianCount,
    guardians,
    walletName,
    lastUpdated,
    isLoading,
    error,
    // Functions
    fetchInfo,
    formatAddress,
  };
}
