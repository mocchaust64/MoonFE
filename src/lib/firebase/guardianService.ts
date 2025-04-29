import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  limit,
} from "firebase/firestore";

import { GuardianData, InviteData } from "@/types/guardian";

import { db } from "./config";

// Save invitation data when creating invite code
export const saveInvitation = async (
  inviteData: Omit<InviteData, "createdAt">,
): Promise<string> => {
  try {
    const inviteRef = doc(collection(db, "invitations"));
    // Add inviteCode if not provided
    const inviteCode = inviteData.inviteCode || inviteRef.id;

    await setDoc(inviteRef, {
      ...inviteData,
      inviteCode,
      createdAt: serverTimestamp(),
    });

    // Create lookup document for easy querying
    await setDoc(doc(db, "invitations_lookup", inviteCode), {
      inviteId: inviteRef.id,
      createdAt: serverTimestamp(),
    });

    return inviteCode;
  } catch (error) {
    console.error("Error saving invitation:", error);
    throw error;
  }
};

// Get invitation data by invite code
export const getInvitation = async (
  inviteCode: string,
): Promise<InviteData | null> => {
  try {
    // Find in lookup table
    const lookupRef = doc(db, "invitations_lookup", inviteCode);
    const lookupSnap = await getDoc(lookupRef);

    if (!lookupSnap.exists()) return null;

    // Get original document ID
    const inviteId = lookupSnap.data().inviteId;
    const inviteRef = doc(db, "invitations", inviteId);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) return null;

    return inviteSnap.data() as InviteData;
  } catch (error) {
    console.error("Error getting invitation:", error);
    return null;
  }
};

// Save guardian data during registration
export const saveGuardianData = async (
  guardianData: Omit<GuardianData, "createdAt">,
): Promise<void> => {
  try {
    const { inviteCode } = guardianData;
    // Save guardian info
    await setDoc(doc(db, "guardians", inviteCode), {
      ...guardianData,
      createdAt: serverTimestamp(),
    });

    // Update invitation status
    const lookupRef = doc(db, "invitations_lookup", inviteCode);
    const lookupSnap = await getDoc(lookupRef);

    if (lookupSnap.exists()) {
      const inviteId = lookupSnap.data().inviteId;
      const inviteRef = doc(db, "invitations", inviteId);
      await updateDoc(inviteRef, {
        status: "ready",
      });
    }
  } catch (error) {
    console.error("Error saving guardian data:", error);
    throw error;
  }
};

// Get guardian data by invite code
export const getGuardianData = async (
  inviteCode: string,
): Promise<GuardianData | null> => {
  try {
    const guardianRef = doc(db, "guardians", inviteCode);
    const guardianSnap = await getDoc(guardianRef);

    if (!guardianSnap.exists()) return null;

    return guardianSnap.data() as GuardianData;
  } catch (error) {
    console.error("Error getting guardian data:", error);
    return null;
  }
};

// Update guardian status after completion
export const updateGuardianStatus = async (
  inviteCode: string,
  status: "pending" | "ready" | "completed",
  txSignature?: string,
): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { status };
    if (status === "completed") {
      updateData.completedAt = serverTimestamp();
      if (txSignature) updateData.txSignature = txSignature;
    }

    // Update guardian
    await updateDoc(doc(db, "guardians", inviteCode), updateData);

    // Update invitation
    const lookupRef = doc(db, "invitations_lookup", inviteCode);
    const lookupSnap = await getDoc(lookupRef);

    if (lookupSnap.exists()) {
      const inviteId = lookupSnap.data().inviteId;
      await updateDoc(doc(db, "invitations", inviteId), { status });
    }
  } catch (error) {
    console.error("Error updating guardian status:", error);
    throw error;
  }
};

// Get list of pending invites
export const getPendingInvites = async (
  multisigPDA: string,
): Promise<string[]> => {
  try {
    console.log(`Finding pending guardians for wallet ${multisigPDA}`);

    const invitesQuery = query(
      collection(db, "invitations"),
      where("multisigPDA", "==", multisigPDA),
      where("status", "==", "ready"),
    );

    const querySnapshot = await getDocs(invitesQuery);
    console.log(
      `Found ${querySnapshot.size} pending guardians for wallet ${multisigPDA}`,
    );

    return querySnapshot.docs.map((doc) => doc.data().inviteCode);
  } catch (error) {
    console.error("Error getting pending invites:", error);
    return [];
  }
};

// Clean up old guardian and invitation data (can be called by Cloud Function)
export const cleanupOldData = async (): Promise<void> => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find old invitations with pending or ready status
    const oldInvitesQuery = query(
      collection(db, "invitations"),
      where("createdAt", "<", thirtyMinutesAgo),
      where("status", "in", ["pending", "ready"]),
    );

    const querySnapshot = await getDocs(oldInvitesQuery);
    console.log(`Found ${querySnapshot.size} invitations to clean up`);

    // Delete each old invitation
    const batch = querySnapshot.docs.map(async (docSnapshot) => {
      const inviteCode = docSnapshot.data().inviteCode;
      console.log(`Deleting data for invitation: ${inviteCode}`);

      // Delete lookup
      await deleteDoc(doc(db, "invitations_lookup", inviteCode));

      // Delete guardian data if exists
      const guardianRef = doc(db, "guardians", inviteCode);
      const guardianSnap = await getDoc(guardianRef);
      if (guardianSnap.exists()) {
        await deleteDoc(guardianRef);
      }

      // Delete invitation
      await deleteDoc(docSnapshot.ref);
    });

    await Promise.all(batch);
  } catch (error) {
    console.error("Error cleaning up old data:", error);
  }
};

// Delete guardian, invitation and lookup data after registration completion
export const deleteGuardianData = async (
  inviteCode: string,
): Promise<boolean> => {
  try {
    console.log(`Deleting guardian data for invite code: ${inviteCode}`);

    // Delete guardian data
    const guardianRef = doc(db, "guardians", inviteCode);
    const guardianSnap = await getDoc(guardianRef);
    if (guardianSnap.exists()) {
      await deleteDoc(guardianRef);
      console.log(`Deleted guardian data for invite code: ${inviteCode}`);
    }

    // Find and delete invitation
    const lookupRef = doc(db, "invitations_lookup", inviteCode);
    const lookupSnap = await getDoc(lookupRef);

    if (lookupSnap.exists()) {
      const inviteId = lookupSnap.data().inviteId;

      // Delete invitation
      await deleteDoc(doc(db, "invitations", inviteId));
      console.log(`Deleted invitation with ID: ${inviteId}`);

      // Delete lookup
      await deleteDoc(lookupRef);
      console.log(`Deleted invitation lookup for invite code: ${inviteCode}`);
    }

    return true;
  } catch (error) {
    console.error("Error deleting guardian data:", error);
    return false;
  }
};

/**
 * Tạo chuỗi ngẫu nhiên với độ dài xác định
 * @param length Độ dài chuỗi ngẫu nhiên
 * @returns Chuỗi ngẫu nhiên
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset.charAt(randomIndex);
  }
  return result;
}

/**
 * Lấy danh sách tất cả guardian của một ví, bao gồm cả những guardian đang chờ xác nhận
 * @param walletAddress Địa chỉ ví
 * @returns Danh sách guardians (bao gồm cả đang chờ xác nhận)
 */
export async function getAllGuardians(walletAddress: string) {
  try {
    // 1. Lấy danh sách guardian đã xác nhận
    const confirmedGuardiansQuery = query(
      collection(db, "guardians"),
      where("multisigAddress", "==", walletAddress)
    );
    const confirmedGuardiansSnapshot = await getDocs(confirmedGuardiansQuery);
    const confirmedGuardians = confirmedGuardiansSnapshot.docs.map((doc) => doc.data());
    
    // 2. Lấy danh sách lời mời đang chờ xác nhận
    const pendingInvitesQuery = query(
      collection(db, "guardian_invites"),
      where("multisigAddress", "==", walletAddress)
    );
    const pendingInvitesSnapshot = await getDocs(pendingInvitesQuery);
    const pendingGuardians = pendingInvitesSnapshot.docs.map((doc) => doc.data());
    
    // 3. Kết hợp cả hai danh sách
    return [...confirmedGuardians, ...pendingGuardians];
  } catch (error) {
    console.error("Lỗi khi lấy danh sách guardian:", error);
    return [];
  }
}

/**
 * Tìm ID guardian lớn nhất đã được sử dụng (bao gồm cả đang chờ xác nhận)
 * @param walletAddress Địa chỉ ví
 * @returns ID lớn nhất
 */
export async function getHighestGuardianId(walletAddress: string) {
  try {
    const allGuardians = await getAllGuardians(walletAddress);
    
    let highestId = 0;
    allGuardians.forEach(guardian => {
      // Đảm bảo ID là số
      const guardianId = typeof guardian.guardianId === 'number' 
        ? guardian.guardianId 
        : parseInt(guardian.guardianId, 10);
      
      if (!isNaN(guardianId) && guardianId > highestId) {
        highestId = guardianId;
      }
    });
    
    return highestId;
  } catch (error) {
    console.error("Lỗi khi tìm ID guardian cao nhất:", error);
    return 0;
  }
}

/**
 * Tạo mã mời guardian mới với ID không trùng lặp
 * @param walletAddress Địa chỉ ví
 * @param guardianName Tên guardian
 * @param guardianEmail Email guardian
 * @returns Mã lời mời
 */
export async function createGuardianInvitation(
  walletAddress: string,
  guardianName: string,
  guardianEmail: string
) {
  try {
    // Tìm ID lớn nhất đã sử dụng (bao gồm cả đang chờ xác nhận)
    const highestId = await getHighestGuardianId(walletAddress);
    
    // Tạo ID mới (tăng 1 từ ID cao nhất)
    const newGuardianId = highestId + 1;
    console.log(`Tạo guardian mới với ID: ${newGuardianId} (ID cao nhất hiện tại: ${highestId})`);
    
    // Tạo mã lời mời
    const inviteCode = generateRandomString(8);
    const inviteRef = doc(db, "guardian_invites", inviteCode);
    
    // Lưu thông tin lời mời vào Firebase
    await setDoc(inviteRef, {
      multisigAddress: walletAddress,
      guardianName,
      guardianEmail,
      guardianId: newGuardianId,
      inviteCode,
      status: "pending",
      createdAt: serverTimestamp()
    });
    
    // Gửi email thông báo (nếu cần)
    // ... existing email sending code ...
    
    return { inviteCode, guardianId: newGuardianId };
  } catch (error) {
    console.error("Lỗi khi tạo lời mời guardian:", error);
    throw error;
  }
}

// Lấy danh sách các guardian ID đang ở trạng thái pending cho một multisig wallet
export const getPendingGuardianIds = async (
  multisigPDA: string
): Promise<number[]> => {
  try {
    console.log(`Đang tìm các guardian ID đang chờ xác nhận cho ví ${multisigPDA}`);

    // Tìm trong collection invitations
    const invitesQuery = query(
      collection(db, "invitations"),
      where("multisigPDA", "==", multisigPDA)
    );

    const querySnapshot = await getDocs(invitesQuery);
    const pendingIds: number[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Thêm guardianId vào danh sách nếu có
      if (data.guardianId !== undefined) {
        pendingIds.push(Number(data.guardianId));
      }
    });

    console.log(`Tìm thấy ${pendingIds.length} guardian ID đang chờ xác nhận: ${pendingIds.join(', ')}`);
    return pendingIds;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách guardian ID đang chờ xác nhận:", error);
    return [];
  }
};

/**
 * Kiểm tra xem tên guardian đã tồn tại chưa
 * @param guardianName Tên guardian cần kiểm tra
 * @returns true nếu tên đã tồn tại, false nếu chưa
 */
export const checkGuardianNameExists = async (guardianName: string): Promise<boolean> => {
  try {
    if (!guardianName) return false;
    
    const q = query(
      collection(db, "guardians"),
      where("guardianName", "==", guardianName),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Lỗi khi kiểm tra tên guardian:", error);
    throw error;
  }
};

/**
 * Tìm kiếm guardians theo tên
 * @param username Tên guardian cần tìm
 * @returns Danh sách guardians có tên phù hợp
 */
export const searchGuardiansByUsername = async (
  username: string
): Promise<any[]> => {
  try {
    // Tạo giá trị username để tìm kiếm
    const searchName = username.toLowerCase().trim();
    
    // Firebase không hỗ trợ tìm kiếm không phân biệt chữ hoa/thường
    // nên ta cần lấy tất cả rồi lọc phía client
    const guardiansRef = collection(db, "guardians");
    const querySnapshot = await getDocs(guardiansRef);
    
    const guardians: any[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const guardianName = data.guardianName?.toLowerCase() ?? '';
      
      // Kiểm tra nếu tên guardian chứa chuỗi tìm kiếm
      if (guardianName.includes(searchName)) {
        guardians.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    return guardians;
  } catch (error) {
    console.error("Lỗi khi tìm kiếm guardians:", error);
    throw error;
  }
};
