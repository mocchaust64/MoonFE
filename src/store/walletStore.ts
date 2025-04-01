import { PublicKey, Keypair } from "@solana/web3.js";
import { create, StateCreator } from "zustand";
import { persist, PersistOptions } from "zustand/middleware";

import { connection } from "@/lib/solana/connection";
import { Guardian, getGuardiansFromBlockchain } from "@/utils/guardianUtils";

interface WalletState {
  // Persistent data (need to be stored)
  multisigAddress: PublicKey | null;
  guardianPDA: PublicKey | null;
  existingGuardians: number[];
  isLoggedIn: boolean;

  // Temporary data (computed or session-only)
  pdaBalance: number;
  walletKeypair: Keypair | null;
  guardians: Guardian[];

  // Actions
  setMultisigAddress: (address: PublicKey | null) => void;
  setGuardianPDA: (pda: PublicKey | null) => void;
  setExistingGuardians: (guardians: number[]) => void;
  setIsLoggedIn: (status: boolean) => void;
  setWalletKeypair: (keypair: Keypair | null) => void;
  fetchPdaBalance: () => Promise<void>;
  fetchGuardians: () => Promise<void>;
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
      guardians: [],

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

      // Fetch guardians from blockchain
      fetchGuardians: async () => {
        const { multisigAddress } = get();
        if (!multisigAddress) {
          console.error(
            "fetchGuardians: MultisigAddress is null, cannot fetch guardians",
          );
          return;
        }

        try {
          console.log(
            "======= Bắt đầu tải danh sách guardians từ blockchain... =======",
          );
          console.log("MultisigAddress:", typeof multisigAddress);

          // Đảm bảo multisigAddress là PublicKey
          const multisigPubkey =
            typeof multisigAddress === "string"
              ? new PublicKey(multisigAddress)
              : multisigAddress;

          console.log(
            "MultisigAddress đã chuyển đổi:",
            multisigPubkey.toString(),
          );

          const guardians = await getGuardiansFromBlockchain(multisigPubkey);

          // Cập nhật danh sách guardians
          console.log(`Cập nhật store với ${guardians.length} guardians`);
          set({ guardians });

          // Cập nhật danh sách existingGuardians (chỉ lưu ID)
          const existingIds = guardians.map((g) => g.id);
          set({ existingGuardians: existingIds });

          console.log(
            `Danh sách existingGuardians đã cập nhật: [${existingIds.join(", ")}]`,
          );
        } catch (error) {
          console.error("Lỗi khi tải guardians:", error);
        }
      },

      reset: () =>
        set({
          multisigAddress: null,
          guardianPDA: null,
          existingGuardians: [],
          guardians: [],
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
        try {
          const state = JSON.parse(str);

          // Chuyển đổi lại các chuỗi thành đối tượng PublicKey
          const multisigAddress = state.state.multisigAddress
            ? new PublicKey(state.state.multisigAddress)
            : null;

          const guardianPDA = state.state.guardianPDA
            ? new PublicKey(state.state.guardianPDA)
            : null;

          return {
            ...state,
            state: {
              ...state.state,
              multisigAddress,
              guardianPDA,
              // Reset temporary data
              pdaBalance: 0,
              walletKeypair: null,
              guardians: [], // Reset guardians array
            },
          };
        } catch (error) {
          console.error("Error deserializing state:", error);
          // Return default state if deserialization fails
          return {
            version: 0,
            state: {
              multisigAddress: null,
              guardianPDA: null,
              existingGuardians: [],
              isLoggedIn: false,
              pdaBalance: 0,
              walletKeypair: null,
              guardians: [],
            },
          };
        }
      },
    },
  ),
);
