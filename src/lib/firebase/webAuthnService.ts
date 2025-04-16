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

import { PublicKey } from "@solana/web3.js";
import { db } from "./config";

// Định nghĩa interface cho ánh xạ WebAuthn credential
export interface WebAuthnCredentialMapping {
  credentialId: string;
  walletAddress: string;
  guardianPublicKey: number[]; // Lưu khóa công khai dưới dạng mảng số
  guardianId: number; // ID của guardian
  guardianName?: string; // Tên của guardian
  threshold?: number; // Ngưỡng ký của ví multisig
  createdAt: string; // Thời gian tạo
  lastUsed?: string; // Thời gian sử dụng cuối cùng
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
 * @param guardianId ID của guardian
 * @param guardianName Tên của guardian (nếu có)
 * @param threshold Ngưỡng ký của ví đa chữ ký
 * @param isOwner Guardian có là owner hay không (mặc định là true)
 * @returns Trả về true nếu lưu thành công
 */
export const saveWebAuthnCredentialMapping = async (
  credentialId: string,
  walletAddress: string,
  guardianPublicKey: number[] | Uint8Array,
  guardianId: number,
  guardianName?: string,
  threshold?: number,
  isOwner: boolean = true,
): Promise<boolean> => {
  try {
    // Chuẩn hóa credential ID
    const normalizedId = normalizeCredentialId(credentialId);
    const base64Id = Buffer.from(normalizedId, 'hex').toString('base64');

    // Chuẩn hóa guardianPublicKey thành mảng number[]
    const publicKeyArray = Array.isArray(guardianPublicKey) 
      ? guardianPublicKey 
      : Array.from(guardianPublicKey);
    
    // Chuẩn hóa guardianId thành số
    const guardianIdNumber = Number(guardianId);
    
    console.log(`Lưu WebAuthn credential với thông tin: `, {
      credentialId: normalizedId,
      walletAddress,
      publicKeyLength: publicKeyArray.length,
      guardianId: guardianIdNumber,
      threshold
    });

    // Tạo dữ liệu cơ bản
    const credentialData: any = {
      credentialId: normalizedId,
      credentialIdBase64: base64Id,
      walletAddress,
      guardianPublicKey: publicKeyArray,
      guardianId: guardianIdNumber,
      isOwner,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    // Thêm guardianName nếu có
    if (guardianName) {
      credentialData.guardianName = guardianName;
    }
    
    // Kiểm tra và thêm threshold, báo lỗi nếu không tồn tại
    if (threshold !== undefined) {
      console.log(`Lưu threshold vào WebAuthn credential mapping: ${threshold}`);
      credentialData.threshold = threshold;
    } else {
      console.warn("Threshold không được xác định! Có thể gây ra vấn đề khi ký đề xuất.");
    }

    // Tạo một document dưới collection webauthn_credentials
    await setDoc(doc(db, "webauthn_credentials", normalizedId), credentialData);

    console.log('Đã lưu ánh xạ WebAuthn credential thành công');
    
    // Lưu thông tin credential vào localStorage
    try {
      localStorage.setItem(
        "webauthn_credential_" + credentialId,
        JSON.stringify({
          credentialId,
          walletAddress,
          guardianPublicKey: publicKeyArray,
          guardianId: guardianIdNumber,
          threshold
        })
      );
      localStorage.setItem('current_credential_id', credentialId);
      localStorage.setItem('current_guardian_id', guardianIdNumber.toString());
      console.log("Đã lưu thông tin credential và guardianId vào localStorage");
    } catch (storageError) {
      console.warn("Không thể lưu thông tin vào localStorage:", storageError);
    }
    
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

/**
 * Lấy thông tin WebAuthn public key của guardian theo multisigAddress và guardianId
 * @param multisigAddress Địa chỉ ví multisig
 * @param guardianId ID của guardian
 * @returns Public key của guardian (dạng Uint8Array) hoặc null nếu không tìm thấy
 */
export async function getGuardianWebAuthnPublicKey(
  multisigPDA: PublicKey | string,
  guardianId: number
): Promise<Uint8Array | null> {
  try {
    // Chuẩn hóa input
    const multisigAddress = typeof multisigPDA === 'string' 
      ? multisigPDA 
      : multisigPDA.toString();
    
    const guardianIdNumber = Number(guardianId);
    
    console.log(`Đang lấy WebAuthn public key cho guardian ID ${guardianIdNumber} của ví ${multisigAddress}`);
    
    // Kiểm tra thông tin trong localStorage trước
    const storedCredentialId = localStorage.getItem('current_credential_id');
    if (storedCredentialId) {
      const localStorageKey = "webauthn_credential_" + storedCredentialId;
      const localMapping = localStorage.getItem(localStorageKey);
      
      if (localMapping) {
        try {
          const mappingData = JSON.parse(localMapping);
          console.log("Thông tin WebAuthn từ localStorage:", {
            credentialId: storedCredentialId,
            guardianId: mappingData.guardianId,
            walletAddress: mappingData.walletAddress
          });
          
          // Kiểm tra nếu guardianId khớp và walletAddress khớp
          if (mappingData.guardianId === guardianIdNumber && 
              mappingData.walletAddress === multisigAddress &&
              mappingData.guardianPublicKey && 
              Array.isArray(mappingData.guardianPublicKey)) {
            
            console.log("Sử dụng thông tin guardian từ localStorage");
            const publicKeyArray = new Uint8Array(mappingData.guardianPublicKey);
            console.log(`Public key từ localStorage: ${Buffer.from(publicKeyArray).toString('hex')}`);
            return publicKeyArray;
          }
        } catch (e) {
          console.error("Lỗi khi parse thông tin credential từ localStorage:", e);
        }
      }
    }
    
    // Tìm thông tin guardian trong Firebase
    const guardiansRef = collection(db, "webauthn_credentials");
    const q = query(
      guardiansRef,
      where("walletAddress", "==", multisigAddress),
      where("guardianId", "==", guardianIdNumber)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.error(`Không tìm thấy guardian với ID ${guardianIdNumber} cho ví ${multisigAddress}`);
      return null;
    }
    
    // Lấy dữ liệu của guardian đầu tiên tìm thấy
    const guardianCredential = querySnapshot.docs[0].data();
    
    console.log(`Tìm thấy thông tin guardian từ Firebase:`, guardianCredential);
    
    // Debug thông tin guardianPublicKey
    if (guardianCredential.guardianPublicKey) {
      console.log("Kiểu dữ liệu guardianPublicKey:", typeof guardianCredential.guardianPublicKey);
      console.log("Là mảng?", Array.isArray(guardianCredential.guardianPublicKey));
      console.log("Độ dài:", guardianCredential.guardianPublicKey.length);
      
      // Xem 5 phần tử đầu tiên (nếu có) để debug
      if (Array.isArray(guardianCredential.guardianPublicKey) && guardianCredential.guardianPublicKey.length > 0) {
        console.log("Một số giá trị từ guardianPublicKey:", 
          guardianCredential.guardianPublicKey.slice(0, 5));
      }
    }
    
    // Lấy public key từ thông tin guardian
    if (!guardianCredential.guardianPublicKey || !Array.isArray(guardianCredential.guardianPublicKey)) {
      console.error(`Guardian ID ${guardianIdNumber} không có public key hợp lệ`);
      return null;
    }
    
    // Chuyển đổi public key từ mảng số thành Uint8Array
    const publicKeyArray = new Uint8Array(guardianCredential.guardianPublicKey);
    console.log(`Đã lấy được public key: ${Buffer.from(publicKeyArray).toString('hex')}`);
    
    // Thử lưu vào localStorage để lần sau nhanh hơn
    try {
      localStorage.setItem(
        `guardian_pubkey_${multisigAddress}_${guardianIdNumber}`,
        JSON.stringify(Array.from(publicKeyArray))
      );
    } catch (e) {
      console.warn("Không thể lưu public key vào localStorage:", e);
    }
    
    return publicKeyArray;
  } catch (error) {
    console.error(`Lỗi khi lấy WebAuthn public key:`, error);
    return null;
  }
}
