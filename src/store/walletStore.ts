import { create } from "zustand";
import { persist } from "zustand/middleware";

import { Guardian } from "@/utils/guardianUtils";

interface WalletState {
  multisigPDA: string | null;
  balance: number;
  threshold: number;
  guardianCount: number;
  guardians: Guardian[];
  walletName: string;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: number;
}

interface WalletActions {
  setMultisigPDA: (pda: string | null) => void;
  setWalletData: (data: Partial<WalletState>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  reset: () => void;
}

const initialState: WalletState = {
  multisigPDA: null,
  balance: 0,
  threshold: 0,
  guardianCount: 0,
  guardians: [],
  walletName: "",
  isLoading: false,
  error: null,
  lastUpdated: 0,
};

export const useWalletStore = create<WalletState & WalletActions>()(
  persist(
    (set) => ({
      ...initialState,

      setMultisigPDA: (pda) => set({ multisigPDA: pda }),

      setWalletData: (data) =>
        set((state) => ({
          ...state,
          ...data,
          lastUpdated: Date.now(),
        })),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      reset: () => {
        // Clear localStorage data
        localStorage.removeItem("wallet-storage");
        localStorage.removeItem("moonwallet_last_fetch_time");
        // Reset state
        set(initialState);
      },
    }),
    {
      name: "wallet-storage",
      partialize: (state) => ({
        multisigPDA: state.multisigPDA,
        balance: state.balance,
        threshold: state.threshold,
        guardianCount: state.guardianCount,
        guardians: state.guardians,
        walletName: state.walletName,
        lastUpdated: state.lastUpdated,
      }),
    },
  ),
);
