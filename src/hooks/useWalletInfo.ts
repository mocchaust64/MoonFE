import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useCallback, useRef, useState } from "react";

import { connection } from "@/lib/solana";
import { program } from "@/lib/solana";
import { useWalletStore } from "@/store/walletStore";
import { getGuardiansFromBlockchain } from "@/utils/guardianUtils";
import { getWalletMetadata } from "@/lib/firebase/walletService";

// Key để lưu trữ thời gian fetch lần cuối trong localStorage
const LAST_FETCH_TIME_KEY = "moonwallet_last_fetch_time";
// Thời gian tối thiểu giữa các lần fetch (10 giây)
const MIN_FETCH_INTERVAL = 10000;

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
  
  // Sử dụng useRef để theo dõi subscription ID
  const subscriptionIdRef = useRef<number | null>(null);
  // Ref để theo dõi dữ liệu account trước đó
  const previousDataRef = useRef<Buffer | null>(null);
  // Ref để theo dõi thời gian fetch lần cuối
  const lastFetchTimeRef = useRef<number>(0);
  // Ref để theo dõi nếu component vẫn mounted
  const isMountedRef = useRef<boolean>(true);
  // Ref để theo dõi nếu đang fetch
  const isFetchingRef = useRef<boolean>(false);
  // Ref để theo dõi nếu đã có dữ liệu ban đầu
  const hasInitialDataRef = useRef<boolean>(false);
  // Ref để theo dõi thời gian cập nhật thông tin đầy đủ cuối cùng
  const lastFullUpdateRef = useRef<number>(0);
  // State để đảm bảo re-render không gây lặp vô hạn
  const [fetchCount, setFetchCount] = useState(0);

  // Chỉ tải số dư ví
  const fetchBalance = useCallback(async () => {
    if (!multisigPDA || isFetchingRef.current) return;

    // Kiểm tra thời gian giữa các lần fetch để tránh gọi quá nhiều
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
      return;
    }

    try {
      // Đánh dấu đang fetch để tránh gọi đồng thời
      isFetchingRef.current = true;
      
      const pubkey =
        typeof multisigPDA === "string"
          ? new PublicKey(multisigPDA)
          : multisigPDA;

      // Chỉ lấy số dư
      const solBalance = await connection.getBalance(pubkey);
      
      // Cập nhật số dư nếu component vẫn mounted
      if (isMountedRef.current) {
        setWalletData({
          balance: solBalance / LAMPORTS_PER_SOL,
          // Giữ nguyên các giá trị khác
          threshold,
          guardianCount,
          guardians,
          walletName,
        });
        
        // Lưu thời gian fetch lần cuối vào localStorage
        localStorage.setItem(LAST_FETCH_TIME_KEY, now.toString());
        lastFetchTimeRef.current = now;
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error("Error fetching balance:", err);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [multisigPDA, setWalletData, threshold, guardianCount, guardians, walletName]);
  
  // Fetch đầy đủ thông tin ví
  const fetchFullInfo = useCallback(async (force = false) => {
    if (!multisigPDA || isFetchingRef.current) return;

    // Kiểm tra thời gian giữa các lần fetch full info (60 giây, trừ khi force)
    const now = Date.now();
    if (!force && now - lastFullUpdateRef.current < 60000) {
      // Nếu chưa đến thời gian fetch full, chỉ fetch balance
      fetchBalance();
      return;
    }

    // Đánh dấu đang fetch để tránh gọi đồng thời
    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;
    lastFullUpdateRef.current = now;
    
    // Tăng fetchCount để biết hook đã thực hiện fetch
    setFetchCount(prev => prev + 1);
    
    if (!isMountedRef.current) {
      isFetchingRef.current = false;
      return;
    }

    // Chỉ đặt loading=true nếu chưa có dữ liệu ban đầu
    if (!hasInitialDataRef.current) {
      setLoading(true);
    }
    
    setError(null);

    try {
      const pubkey =
        typeof multisigPDA === "string"
          ? new PublicKey(multisigPDA)
          : multisigPDA;

      // Get balance
      const solBalance = await connection.getBalance(pubkey);

      // Get and decode MultiSigWallet account data
      const accountInfo = await connection.getAccountInfo(pubkey);
      if (!accountInfo) {
        throw new Error("Multisig account not found");
      }
      
      // Cập nhật previous data
      previousDataRef.current = accountInfo.data;

      const multisigData = program.coder.accounts.decode(
        "multiSigWallet",
        accountInfo.data,
      );

      // Get guardians (chỉ khi cần thiết để giảm số lần gọi API)
      const guardians = await getGuardiansFromBlockchain(multisigPDA);

      // Lấy tên ví từ blockchain hoặc Firebase
      let walletName = "Unnamed Wallet";
      
      // Thử lấy tên từ blockchain trước (có thể không có trong IDL mới)
      if (multisigData.name) {
        walletName = multisigData.name;
      } else {
        // Nếu không có trong blockchain, thử lấy từ Firebase
        try {
          const walletMetadata = await getWalletMetadata(pubkey.toString());
          if (walletMetadata && walletMetadata.name) {
            walletName = walletMetadata.name;
          }
        } catch (firebaseError) {
          console.error("Error fetching wallet name from Firebase:", firebaseError);
        }
      }

      // Chỉ cập nhật state nếu component vẫn mounted
      if (isMountedRef.current) {
        // Đánh dấu là đã có dữ liệu
        hasInitialDataRef.current = true;
        
        setWalletData({
          balance: solBalance / LAMPORTS_PER_SOL,
          threshold: multisigData.threshold,
          guardianCount: multisigData.guardianCount,
          guardians,
          walletName: walletName,
        });

        // Lưu thời gian fetch lần cuối vào localStorage
        localStorage.setItem(LAST_FETCH_TIME_KEY, now.toString());
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error("Error fetching wallet info:", err);
        setError(err as Error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [multisigPDA, setWalletData, setLoading, setError, fetchBalance]);

  // Kiểm tra xem có dữ liệu ban đầu từ localStorage không
  useEffect(() => {
    // Kiểm tra nếu đã có dữ liệu trong store
    if (multisigPDA && balance > 0) {
      hasInitialDataRef.current = true;
    }
  }, [multisigPDA, balance]);

  // Subscribe to account changes
  useEffect(() => {
    // Đánh dấu component đã mount
    isMountedRef.current = true;
    
    if (!multisigPDA) return;

    const pubkey =
      typeof multisigPDA === "string"
        ? new PublicKey(multisigPDA)
        : multisigPDA;
    
    // Reset các ref khi multisigPDA thay đổi
    previousDataRef.current = null;
    lastFetchTimeRef.current = 0;
    lastFullUpdateRef.current = 0;
    
    // Nếu đã có subscription, hủy nó trước
    if (subscriptionIdRef.current !== null) {
      connection.removeAccountChangeListener(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
    }

    // Thiết lập một subscription duy nhất
    let timeoutId: NodeJS.Timeout | null = null;
    
    const subscriptionId = connection.onAccountChange(
      pubkey,
      (accountInfo) => {
        // Hủy bỏ timeout trước đó nếu có
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Kiểm tra dữ liệu mới với dữ liệu trước đó
        const hasStructuralChange = !previousDataRef.current || 
          accountInfo.data.length !== previousDataRef.current.length ||
          !accountInfo.data.slice(8, 16).equals(previousDataRef.current.slice(8, 16)); // Kiểm tra thay đổi threshold và guardianCount
          
        // Debounce: Đặt timeout để đợi một khoảng thời gian trước khi fetch
        timeoutId = setTimeout(() => {
          if (isMountedRef.current) {
            if (hasStructuralChange) {
              // Nếu có thay đổi quan trọng, fetch đầy đủ
              fetchFullInfo(true);
            } else {
              // Nếu chỉ có số dư thay đổi, chỉ fetch số dư
              fetchBalance();
            }
          }
        }, 300); // 300ms debounce
      },
      "confirmed",
    );
    
    // Lưu ID của subscription mới
    subscriptionIdRef.current = subscriptionId;

    // Fetch dữ liệu ban đầu đầy đủ một lần
    fetchFullInfo(true);

    // Thiết lập interval để cập nhật số dư định kỳ
    const balanceInterval = setInterval(() => {
      if (isMountedRef.current) {
        fetchBalance();
      }
    }, 30000); // Cập nhật số dư mỗi 30 giây

    // Cleanup khi component unmount hoặc dependencies thay đổi
    return () => {
      // Đánh dấu component đã unmount
      isMountedRef.current = false;
      
      // Hủy timeout nếu có
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Hủy subscription
      if (subscriptionIdRef.current !== null) {
        connection.removeAccountChangeListener(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
      
      // Hủy interval
      clearInterval(balanceInterval);
    };
  }, [multisigPDA, fetchFullInfo, fetchBalance]);

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
    isLoading: isLoading && !hasInitialDataRef.current, // Chỉ hiển thị loading nếu chưa có dữ liệu ban đầu
    error,
    fetchCount, // Thêm để theo dõi số lần fetch
    // Functions
    fetchInfo: useCallback(() => fetchFullInfo(true), [fetchFullInfo]), // Force fetch
    fetchBalance, // Thêm hàm fetch riêng cho balance
    formatAddress,
  };
}
