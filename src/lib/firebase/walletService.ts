import { 
  collection, doc, setDoc, getDoc, query, 
  where, getDocs, updateDoc, serverTimestamp 
} from "firebase/firestore";
import { db } from "./config";

// Định nghĩa interface cho thông tin ví
export interface WalletMetadata {
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  customFields?: Record<string, any>;
}

/**
 * Lưu thông tin metadata của ví vào Firebase
 * @param walletAddress Địa chỉ ví dưới dạng chuỗi
 * @param metadata Thông tin metadata của ví
 * @returns Trả về true nếu lưu thành công
 */
export const saveWalletMetadata = async (
  walletAddress: string,
  metadata: WalletMetadata
): Promise<boolean> => {
  try {
    // Chuẩn hóa địa chỉ ví để sử dụng làm ID document
    const normalizedAddress = walletAddress.toString();
    
    // Tạo dữ liệu cần lưu
    const walletData: WalletMetadata = {
      ...metadata,
      updatedAt: new Date().toISOString()
    };
    
    // Nếu là lần đầu tạo, thêm createdAt
    const docRef = doc(db, "wallets", normalizedAddress);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      walletData.createdAt = new Date().toISOString();
    }
    
    // Lưu dữ liệu vào Firestore
    await setDoc(docRef, walletData, { merge: true });
    
    console.log(`Đã lưu metadata cho ví ${normalizedAddress}`);
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu metadata ví:', error);
    return false;
  }
};

/**
 * Lấy thông tin metadata của ví từ Firebase
 * @param walletAddress Địa chỉ ví dưới dạng chuỗi
 * @returns Thông tin metadata hoặc null nếu không tìm thấy
 */
export const getWalletMetadata = async (
  walletAddress: string
): Promise<WalletMetadata | null> => {
  try {
    const normalizedAddress = walletAddress.toString();
    const docRef = doc(db, "wallets", normalizedAddress);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as WalletMetadata;
    }
    
    return null;
  } catch (error) {
    console.error('Lỗi khi lấy metadata ví:', error);
    return null;
  }
};

/**
 * Cập nhật thông tin metadata của ví
 * @param walletAddress Địa chỉ ví dưới dạng chuỗi
 * @param metadata Thông tin metadata cần cập nhật
 * @returns Trả về true nếu cập nhật thành công
 */
export const updateWalletMetadata = async (
  walletAddress: string,
  metadata: Partial<WalletMetadata>
): Promise<boolean> => {
  try {
    const normalizedAddress = walletAddress.toString();
    
    // Thêm thời gian cập nhật
    const updateData = {
      ...metadata,
      updatedAt: new Date().toISOString()
    };
    
    await updateDoc(doc(db, "wallets", normalizedAddress), updateData);
    
    console.log(`Đã cập nhật metadata cho ví ${normalizedAddress}`);
    return true;
  } catch (error) {
    console.error('Lỗi khi cập nhật metadata ví:', error);
    return false;
  }
}; 