import { PublicKey, Keypair } from "@solana/web3.js";
import { create, StateCreator } from "zustand";
import { persist, PersistOptions } from "zustand/middleware";

import { connection } from "@/lib/solana/connection";

interface WalletState {
  // Persistent data (need to be stored)
  multisigAddress: PublicKey | null;
  guardianPDA: PublicKey | null;
  existingGuardians: number[];
  isLoggedIn: boolean;

  // Temporary data (computed or session-only)
  pdaBalance: number;
  walletKeypair: Keypair | null;

  // Actions
  setMultisigAddress: (address: PublicKey | null) => void;
  setGuardianPDA: (pda: PublicKey | null) => void;
  setExistingGuardians: (guardians: number[]) => void;
  setIsLoggedIn: (status: boolean) => void;
  setWalletKeypair: (keypair: Keypair | null) => void;
  fetchPdaBalance: () => Promise<void>;
  reset: () => void;
}

type WalletPersist = (
  config: StateCreator<WalletState>,
  options: PersistOptions<WalletState, WalletState> & {
    serialize?: (state: PersistedState) => string;
    deserialize?: (str: string) => PersistedState;
  },
) => StateCreator<WalletState>;

interface PersistedState {
  state: WalletState;
  version: number;
}

export const useWalletStore = create<WalletState>()(
  (persist as WalletPersist)(
    (set, get) => ({
      // Initial state
      multisigAddress: null,
      guardianPDA: null,
      existingGuardians: [],
      isLoggedIn: false,
      pdaBalance: 0,
      walletKeypair: null,

      // Actions
      setMultisigAddress: (address) => set({ multisigAddress: address }),
      setGuardianPDA: (pda) => set({ guardianPDA: pda }),
      setExistingGuardians: (guardians) =>
        set({ existingGuardians: guardians }),
      setIsLoggedIn: (status) => set({ isLoggedIn: status }),
      setWalletKeypair: (keypair) => set({ walletKeypair: keypair }),

      // Fetch PDA balance from blockchain
      fetchPdaBalance: async () => {
        const { multisigAddress } = get();
        if (!multisigAddress) return;

        try {
          const balance = await connection.getBalance(multisigAddress);
          set({ pdaBalance: balance / 1e9 }); // Convert lamports to SOL
        } catch (error) {
          console.error("Error fetching PDA balance:", error);
        }
      },

      reset: () =>
        set({
          multisigAddress: null,
          guardianPDA: null,
          existingGuardians: [],
          isLoggedIn: false,
          pdaBalance: 0,
          walletKeypair: null,
        }),
    }),
    {
      name: "wallet-storage",
      // Custom serialization for PublicKey
      serialize: (state: PersistedState) => {
        const serializedState = {
          ...state,
          state: {
            ...state.state,
            multisigAddress: state.state.multisigAddress?.toString() || null,
            guardianPDA: state.state.guardianPDA?.toString() || null,
            // Don't persist temporary data
            pdaBalance: 0,
            walletKeypair: null,
          },
        };
        return JSON.stringify(serializedState);
      },
      // Custom deserialization for PublicKey
      deserialize: (str: string) => {
        const state = JSON.parse(str);
        return {
          ...state,
          state: {
            ...state.state,
            multisigAddress: state.state.multisigAddress
              ? new PublicKey(state.state.multisigAddress)
              : null,
            guardianPDA: state.state.guardianPDA
              ? new PublicKey(state.state.guardianPDA)
              : null,
            // Reset temporary data
            pdaBalance: 0,
            walletKeypair: null,
          },
        };
      },
    },
  ),
);
