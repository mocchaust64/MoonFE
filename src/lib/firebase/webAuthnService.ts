import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

import { db } from "./config";

// Định nghĩa interface cho ánh xạ WebAuthn credential
export interface WebAuthnCredentialMapping {
  credentialId: string;
  walletAddress: string;
  guardianPublicKey: number[]; // Lưu khóa công khai dưới dạng mảng số
  guardianId: number; // ID của guardian
}

export const normalizeCredentialId = (credentialId: string): string => {
  try {
    // Nếu là base64, chuyển sang hex
    if (credentialId.includes('=')) {
      const buffer = Buffer.from(credentialId, 'base64');
      return buffer.toString('hex');
    }
    // Nếu là hex, giữ nguyên
    return credentialId;
  } catch (error) {
    console.error('Lỗi khi chuyển đổi credential ID:', error);
    return credentialId;
  }
};


/**
 * Lưu ánh xạ giữa WebAuthn credential và địa chỉ ví
 * @param credentialId ID của credential WebAuthn
 * @param walletAddress Địa chỉ ví multisig
 * @param guardianPublicKey Khóa công khai WebAuthn của guardian dưới dạng mảng số
 * @returns Trả về true nếu lưu thành công
 */
export const saveWebAuthnCredentialMapping = async (
  credentialId: string,
  walletAddress: string,
  guardianPublicKey: number[],
  guardianId: number,
): Promise<boolean> => {
  try {
    // Chuẩn hóa credential ID
    const normalizedId = normalizeCredentialId(credentialId);
    const base64Id = Buffer.from(normalizedId, 'hex').toString('base64');

    // Tạo một document dưới collection webauthn_credentials
    await setDoc(doc(db, "webauthn_credentials", normalizedId), {
      credentialId: normalizedId,
      credentialIdBase64: base64Id,
      walletAddress,
      guardianPublicKey,
      guardianId,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    });

    console.log('Đã lưu ánh xạ WebAuthn credential thành công');
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu ánh xạ WebAuthn credential:', error);
    return false;
  }
};

/**
 * Lấy thông tin ví từ credential ID
 * @param credentialId ID của credential WebAuthn
 * @returns Thông tin ánh xạ hoặc null nếu không tìm thấy
 */
export const getWalletByCredentialId = async (
  credentialId: string
): Promise<WebAuthnCredentialMapping | null> => {
  try {
    // Chuẩn hóa credential ID
    const normalizedId = normalizeCredentialId(credentialId);
    
    // Thử tìm với ID đã chuẩn hóa
    const docRef = doc(db, "webauthn_credentials", normalizedId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as WebAuthnCredentialMapping;
    }

    // Nếu không tìm thấy, thử tìm với base64
    const q = query(
      collection(db, "webauthn_credentials"),
      where("credentialIdBase64", "==", credentialId)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as WebAuthnCredentialMapping;
    }
    
    console.log('Không tìm thấy ánh xạ cho credential ID này');
    return null;
  } catch (error) {
    console.error('Lỗi khi lấy thông tin ví từ credential ID:', error);
    return null;
  }
};

/**
 * Lấy tất cả credential đã đăng ký cho một ví
 * @param walletAddress Địa chỉ ví multisig
 * @returns Danh sách các ánh xạ credential
 */
export const getCredentialsByWallet = async (
  walletAddress: string,
): Promise<WebAuthnCredentialMapping[]> => {
  try {
    const q = query(
      collection(db, "webauthn_credentials"),
      where("walletAddress", "==", walletAddress),
    );

    const querySnapshot = await getDocs(q);
    const results: WebAuthnCredentialMapping[] = [];

    querySnapshot.forEach((doc) => {
      results.push(doc.data() as WebAuthnCredentialMapping);
    });

    return results;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách credentials cho ví:", error);
    return [];
  }
};

/**
 * Xóa một ánh xạ credential
 * @param credentialId ID của credential WebAuthn cần xóa
 * @returns Trả về true nếu xóa thành công
 */
export const deleteCredentialMapping = async (
  credentialId: string,
): Promise<boolean> => {
  try {
    // Mã hóa credentialId để tránh lỗi với ký tự đặc biệt
    const encodedCredentialId = encodeURIComponent(credentialId);
    const docRef = doc(db, "webauthn_credentials", encodedCredentialId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Lỗi khi xóa ánh xạ credential:", error);
    return false;
  }
};
