import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useCallback, useRef } from "react";

import { connection, program } from "@/lib/solana";

import { useWalletStore } from "@/store/walletStore";
import { getGuardiansFromBlockchain, Guardian } from "@/utils/guardianUtils";
import { getWalletMetadata } from "@/lib/firebase/walletService";

// Thời gian timeout cho mỗi request (15 giây)
const FETCH_TIMEOUT = 15000;

// Thời gian tối thiểu giữa các lần fetch (10 giây)
const MIN_FETCH_INTERVAL = 10000;

// Định nghĩa interface cho dữ liệu multisig account
interface MultisigData {
  threshold: number;
  guardianCount: number;
  name?: string;
  [key: string]: unknown;
}

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
  
  // Ref để theo dõi nếu component vẫn mounted
  const isMountedRef = useRef<boolean>(true);
  // Ref để theo dõi nếu đang fetch
  const isFetchingRef = useRef<boolean>(false);
  // Ref để theo dõi timeout ID
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  // Ref để theo dõi thời gian fetch gần nhất
  const lastFetchTimeRef = useRef<number>(0);

  // Kiểm tra xem có thể fetch lại hay không dựa trên thời gian
  const canFetchAgain = useCallback(() => {
    const now = Date.now();
    // Kiểm tra localStorage để đảm bảo tất cả các instance của hook đều tôn trọng thời gian chờ
    const storedLastFetchTime = Number(localStorage.getItem('moonwallet_last_fetch_time') || '0');
    const lastFetchTime = Math.max(lastFetchTimeRef.current, storedLastFetchTime);
    return (now - lastFetchTime) > MIN_FETCH_INTERVAL;
  }, []);

  // Hàm fetch với timeout
  const fetchWithTimeout = useCallback(async <T>(promise: Promise<T>): Promise<T> => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Fetch operation timed out"));
      }, FETCH_TIMEOUT);
    });
    
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      return result;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    }
  }, []);

  // Hàm lấy chỉ số dư ví
  const fetchBalanceOnly = useCallback(async (pubkey: PublicKey) => {
    // Thiết lập timeout cho balance fetch
    const solBalance = await fetchWithTimeout(connection.getBalance(pubkey));
    
    // Chỉ cập nhật nếu có sự thay đổi đáng kể
    if (isMountedRef.current && Math.abs(solBalance - balance * LAMPORTS_PER_SOL) > 0.00001) {
      setWalletData({
        balance: solBalance / LAMPORTS_PER_SOL,
        threshold,
        guardianCount,
        guardians,
        walletName,
      });
    }
    
    return solBalance;
  }, [setWalletData, balance, threshold, guardianCount, guardians, walletName, fetchWithTimeout]);

  // Hàm lấy tên ví từ metadata hoặc blockchain
  const getWalletNameFromSources = useCallback(async (
    pubkey: PublicKey, 
    multisigData: MultisigData, 
    currentWalletName: string
  ) => {
    // Mặc định tên wallet
    let updatedWalletName = "Unnamed Wallet";
    
    // Ưu tiên 1: Lấy từ blockchain nếu có
    if (multisigData.name) {
      return multisigData.name;
    } 
    
    // Ưu tiên 2: Giữ nguyên tên đang có nếu hợp lệ
    if (currentWalletName && currentWalletName !== "Unnamed Wallet") {
      return currentWalletName;
    }
    
    // Ưu tiên 3: Lấy từ Firebase
    try {
      const walletMetadata = await fetchWithTimeout(getWalletMetadata(pubkey.toString()));
      if (walletMetadata?.name) {
        updatedWalletName = walletMetadata.name;
      }
    } catch (error) {
      console.error("Error fetching wallet name from Firebase:", error);
    }
    
    return updatedWalletName;
  }, [fetchWithTimeout]);

  // Hàm cập nhật đầy đủ thông tin ví
  const updateWalletData = useCallback(async (
    pubkey: PublicKey, 
    solBalance: number,
    multisigData: MultisigData,
    updatedGuardians: Guardian[],
    updatedWalletName: string
  ) => {
    if (isMountedRef.current) {
      setWalletData({
        balance: solBalance / LAMPORTS_PER_SOL,
        threshold: multisigData.threshold,
        guardianCount: multisigData.guardianCount,
        guardians: updatedGuardians,
        walletName: updatedWalletName,
      });
    }
  }, [setWalletData]);

  // Fetch đầy đủ thông tin ví
  const fetchFullWalletInfo = useCallback(async (pubkey: PublicKey, solBalance: number) => {
    // Lấy thông tin ví từ blockchain
    const accountInfo = await fetchWithTimeout(connection.getAccountInfo(pubkey));
    if (!accountInfo) {
      throw new Error("Multisig account not found");
    }

    // Giải mã dữ liệu ví
    const multisigData = program.coder.accounts.decode(
      "multiSigWallet",
      accountInfo.data,
    ) as MultisigData;

    // Lấy danh sách guardians
    if (!multisigPDA) {
      throw new Error("MultisigPDA is null or undefined");
    }
    const updatedGuardians = await fetchWithTimeout(getGuardiansFromBlockchain(multisigPDA));
    
    // Lấy tên ví
    const updatedWalletName = await getWalletNameFromSources(pubkey, multisigData, walletName);
    
    // Cập nhật dữ liệu vào store
    await updateWalletData(pubkey, solBalance, multisigData, updatedGuardians, updatedWalletName);
    
  }, [multisigPDA, fetchWithTimeout, getWalletNameFromSources, updateWalletData, walletName]);

  // Hàm fetch chính - đã giảm độ phức tạp
  const fetchWalletData = useCallback(async (fetchFull = false, forceUpdate = false) => {
    // Kiểm tra các điều kiện tiên quyết
    if (!multisigPDA || isFetchingRef.current || !isMountedRef.current) {
      return;
    }

    // Kiểm tra thời gian giữa các lần fetch
    if (!forceUpdate && !canFetchAgain()) {
      console.log("Bỏ qua fetch, đã fetch gần đây");
      return;
    }

    try {
      // Đánh dấu đang fetch và cập nhật thời gian fetch
      isFetchingRef.current = true;
      const now = Date.now();
      lastFetchTimeRef.current = now;
      localStorage.setItem('moonwallet_last_fetch_time', now.toString());
      
      // Chỉ set loading khi fetch đầy đủ và chưa có dữ liệu
      if (fetchFull && balance === 0) {
        setLoading(true);
      }
      
      setError(null);
      
      // Chuyển multisigPDA thành PublicKey
      const pubkey = typeof multisigPDA === "string" 
        ? new PublicKey(multisigPDA) 
        : multisigPDA;

      // Lấy số dư ví
      const solBalance = await fetchBalanceOnly(pubkey);
      
      // Nếu chỉ fetch balance thì dừng ở đây
      if (!fetchFull) {
        return;
      }
      
      // Fetch đầy đủ thông tin ví
      await fetchFullWalletInfo(pubkey, solBalance);
      
    } catch (err) {
      if (isMountedRef.current) {
        console.error("Error fetching wallet data:", err);
        setError(err as Error);
      }
    } finally {
      if (isMountedRef.current) {
        // Luôn đặt loading false khi hoàn thành
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [
    multisigPDA, 
    setLoading, 
    setError, 
    balance, 
    fetchBalanceOnly, 
    fetchFullWalletInfo,
    canFetchAgain
  ]);

  // Thiết lập initial fetch khi component mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!multisigPDA) return;
    
    // Fetch dữ liệu ban đầu khi vừa mở app, nhưng tôn trọng thời gian fetch
    if (canFetchAgain()) {
      fetchWalletData(true);
    }
    
    // Đảm bảo loading không bị kẹt
    timeoutIdRef.current = setTimeout(() => {
      if (isLoading && isMountedRef.current) {
        console.log("Forcing loading state reset after timeout");
        setLoading(false);
      }
    }, FETCH_TIMEOUT + 1000);
    
    // Thêm event listener cho visibility change để fetch khi từ background sang foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && multisigPDA) {
        // Khi quay lại tab, cần fetch lại nhưng tôn trọng thời gian fetch
        if (canFetchAgain()) {
          fetchWalletData(true);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup khi component unmount
    return () => {
      isMountedRef.current = false;
      
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [multisigPDA, fetchWalletData, isLoading, setLoading, canFetchAgain]);

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
    // Các hàm để fetch theo demand
    fetchInfo: useCallback(() => fetchWalletData(true, true), [fetchWalletData]),
    fetchBalance: useCallback(() => fetchWalletData(false, false), [fetchWalletData]),
    formatAddress,
  };
}
