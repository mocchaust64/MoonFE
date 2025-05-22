import { 
  collection, 
  doc, 
  setDoc, 
  query, 
  where, 
  getDocs
} from "firebase/firestore";
import { db } from "./config";

// Interface cho IP record
export interface IPRecord {
  ip: string;
  walletAddress: string;
  createdAt: string;
}

/**
 * Kiểm tra xem IP đã tạo ví chưa
 * @param ip Địa chỉ IP cần kiểm tra
 * @returns true nếu IP đã tạo ví, false nếu chưa
 */
export const checkIPCreatedWallet = async (ip: string): Promise<boolean> => {
  try {
    const q = query(
      collection(db, "ip_records"),
      where("ip", "==", ip)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Lỗi khi kiểm tra IP:", error);
    throw error;
  }
};

/**
 * Lưu thông tin IP và ví
 * @param ip Địa chỉ IP
 * @param walletAddress Địa chỉ ví
 */
export const saveIPRecord = async (ip: string, walletAddress: string): Promise<void> => {
  try {
    const ipRecordRef = doc(db, "ip_records", `${ip}_${walletAddress}`);
    await setDoc(ipRecordRef, {
      ip,
      walletAddress,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Lỗi khi lưu IP record:", error);
    throw error;
  }
};

