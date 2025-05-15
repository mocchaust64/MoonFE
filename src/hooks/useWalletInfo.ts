import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useCallback, useRef } from "react";

import { connection, program } from "@/lib/solana";

import { useWalletStore } from "@/store/walletStore";
import { getGuardiansFromBlockchain, Guardian } from "@/utils/guardianUtils";
import { getWalletMetadata } from "@/lib/firebase/walletService";

// Thời gian tối thiểu giữa các lần fetch (30 giây)
const REFRESH_INTERVAL = 30000;
// Thời gian giữa các lần fetch đầy đủ (5 phút)
const FULL_REFRESH_INTERVAL = 300000;
// Thời gian timeout cho mỗi request (15 giây)
const FETCH_TIMEOUT = 15000;

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
  // Ref để theo dõi thời gian fetch lần cuối
  const lastFetchTimeRef = useRef<number>(0);
  // Ref để theo dõi thời gian fetch đầy đủ lần cuối
  const lastFullFetchTimeRef = useRef<number>(0);
  // Ref để theo dõi interval ID
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  // Ref để theo dõi timeout ID
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

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
  const fetchBalanceOnly = useCallback(async (pubkey: PublicKey, now: number) => {
    // Thiết lập timeout cho balance fetch
    const solBalance = await fetchWithTimeout(connection.getBalance(pubkey));
    
    // Cập nhật thời gian fetch
    lastFetchTimeRef.current = now;
    
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
  const fetchFullWalletInfo = useCallback(async (pubkey: PublicKey, now: number, solBalance: number) => {
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
    
    // Cập nhật thời gian fetch đầy đủ
    lastFullFetchTimeRef.current = now;
    
    // Cập nhật dữ liệu vào store
    await updateWalletData(pubkey, solBalance, multisigData, updatedGuardians, updatedWalletName);
    
  }, [multisigPDA, fetchWithTimeout, getWalletNameFromSources, updateWalletData, walletName]);

  // Hàm fetch chính - đã giảm độ phức tạp
  const fetchWalletData = useCallback(async (fetchFull = false) => {
    // Kiểm tra các điều kiện tiên quyết
    if (!multisigPDA || isFetchingRef.current || !isMountedRef.current) {
      return;
    }

    const now = Date.now();
    
    // Kiểm tra thời gian cho phép refresh
    if (!fetchFull && now - lastFetchTimeRef.current < REFRESH_INTERVAL) {
      return;
    }
    
    // Nếu chưa đến thời gian fetch đầy đủ, chỉ fetch balance
    if (fetchFull && now - lastFullFetchTimeRef.current < FULL_REFRESH_INTERVAL) {
      fetchFull = false;
    }

    try {
      // Đánh dấu đang fetch
      isFetchingRef.current = true;
      
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
      const solBalance = await fetchBalanceOnly(pubkey, now);
      
      // Nếu chỉ fetch balance thì dừng ở đây
      if (!fetchFull) {
        return;
      }
      
      // Fetch đầy đủ thông tin ví
      await fetchFullWalletInfo(pubkey, now, solBalance);
      
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
    fetchFullWalletInfo
  ]);

  // Thiết lập polling khi component mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!multisigPDA) return;
    
    // Fetch dữ liệu ban đầu
    fetchWalletData(true);
    
    // Đảm bảo loading không bị kẹt
    timeoutIdRef.current = setTimeout(() => {
      if (isLoading && isMountedRef.current) {
        console.log("Forcing loading state reset after timeout");
        setLoading(false);
      }
    }, FETCH_TIMEOUT + 1000);
    
    // Thiết lập interval cho việc fetch định kỳ
    intervalIdRef.current = setInterval(() => {
      if (isMountedRef.current && !isFetchingRef.current) {
        // Kiểm tra xem đã đến lúc fetch đầy đủ chưa
        const now = Date.now();
        const shouldFetchFull = now - lastFullFetchTimeRef.current >= FULL_REFRESH_INTERVAL;
        
        fetchWalletData(shouldFetchFull);
      }
    }, REFRESH_INTERVAL);
    
    // Cleanup khi component unmount
    return () => {
      isMountedRef.current = false;
      
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [multisigPDA, fetchWalletData, isLoading, setLoading]);

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
    // Các hàm
    fetchInfo: useCallback(() => fetchWalletData(true), [fetchWalletData]),
    fetchBalance: useCallback(() => fetchWalletData(false), [fetchWalletData]),
    formatAddress,
  };
}
