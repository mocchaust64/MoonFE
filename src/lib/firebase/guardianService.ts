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
} from "firebase/firestore";

import { GuardianData, InviteData } from "@/components/Wallet/Guardian/types";

import { db } from "./config";

// Lưu thông tin invitation khi tạo mã mời
export const saveInvitation = async (
  inviteData: Omit<InviteData, "createdAt">,
): Promise<string> => {
  try {
    const inviteRef = doc(collection(db, "invitations"));
    // Thêm trường inviteCode nếu chưa có
    const inviteCode = inviteData.inviteCode || inviteRef.id;

    await setDoc(inviteRef, {
      ...inviteData,
      inviteCode,
      createdAt: serverTimestamp(),
    });

    // Tạo document theo inviteCode để dễ truy vấn
    await setDoc(doc(db, "invitations_lookup", inviteCode), {
      inviteId: inviteRef.id,
      createdAt: serverTimestamp(),
    });

    return inviteCode;
  } catch (error) {
    console.error("Lỗi khi lưu invitation:", error);
    throw error;
  }
};

// Lấy thông tin invitation theo mã mời
export const getInvitation = async (
  inviteCode: string,
): Promise<InviteData | null> => {
  try {
    // Tìm trong bảng lookup
    const lookupRef = doc(db, "invitations_lookup", inviteCode);
    const lookupSnap = await getDoc(lookupRef);

    if (!lookupSnap.exists()) return null;

    // Lấy ID của document gốc
    const inviteId = lookupSnap.data().inviteId;
    const inviteRef = doc(db, "invitations", inviteId);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) return null;

    return inviteSnap.data() as InviteData;
  } catch (error) {
    console.error("Lỗi khi lấy invitation:", error);
    return null;
  }
};

// Lưu thông tin guardian khi đăng ký
export const saveGuardianData = async (
  guardianData: Omit<GuardianData, "createdAt">,
): Promise<void> => {
  try {
    const { inviteCode } = guardianData;
    // Lưu thông tin guardian
    await setDoc(doc(db, "guardians", inviteCode), {
      ...guardianData,
      createdAt: serverTimestamp(),
    });

    // Cập nhật trạng thái invitation
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
    console.error("Lỗi khi lưu guardian data:", error);
    throw error;
  }
};

// Lấy thông tin guardian theo mã mời
export const getGuardianData = async (
  inviteCode: string,
): Promise<GuardianData | null> => {
  try {
    const guardianRef = doc(db, "guardians", inviteCode);
    const guardianSnap = await getDoc(guardianRef);

    if (!guardianSnap.exists()) return null;

    return guardianSnap.data() as GuardianData;
  } catch (error) {
    console.error("Lỗi khi lấy guardian data:", error);
    return null;
  }
};

// Cập nhật trạng thái guardian sau khi hoàn tất
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

    // Cập nhật guardian
    await updateDoc(doc(db, "guardians", inviteCode), updateData);

    // Cập nhật invitation
    const lookupRef = doc(db, "invitations_lookup", inviteCode);
    const lookupSnap = await getDoc(lookupRef);

    if (lookupSnap.exists()) {
      const inviteId = lookupSnap.data().inviteId;
      await updateDoc(doc(db, "invitations", inviteId), { status });
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái guardian:", error);
    throw error;
  }
};

// Lấy danh sách mã mời đang chờ xử lý
export const getPendingInvites = async (
  multisigAddress: string,
): Promise<string[]> => {
  try {
    console.log(`Đang tìm các guardian chờ xác nhận cho ví ${multisigAddress}`);

    // Chỉ lọc theo multisigAddress và status, bỏ qua lọc theo ownerId
    const invitesQuery = query(
      collection(db, "invitations"),
      where("multisigAddress", "==", multisigAddress),
      where("status", "==", "ready"),
    );

    const querySnapshot = await getDocs(invitesQuery);
    console.log(
      `Tìm thấy ${querySnapshot.size} guardian đang chờ xác nhận cho ví ${multisigAddress}`,
    );

    return querySnapshot.docs.map((doc) => doc.data().inviteCode);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách mã mời:", error);
    return [];
  }
};

// Xóa guardian và invitation data cũ (có thể gọi bằng Cloud Function)
export const cleanupOldData = async (): Promise<void> => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Tìm các invitation cũ có trạng thái là pending hoặc ready
    const oldInvitesQuery = query(
      collection(db, "invitations"),
      where("createdAt", "<", thirtyMinutesAgo),
      where("status", "in", ["pending", "ready"]),
    );

    const querySnapshot = await getDocs(oldInvitesQuery);
    console.log(`Tìm thấy ${querySnapshot.size} invitation cần dọn dẹp.`);

    // Xóa từng invitation cũ
    const batch = querySnapshot.docs.map(async (docSnapshot) => {
      const inviteCode = docSnapshot.data().inviteCode;
      console.log(`Đang xóa dữ liệu cho invitation: ${inviteCode}`);

      // Xóa lookup
      await deleteDoc(doc(db, "invitations_lookup", inviteCode));

      // Xóa guardian data nếu có
      const guardianRef = doc(db, "guardians", inviteCode);
      const guardianSnap = await getDoc(guardianRef);
      if (guardianSnap.exists()) {
        await deleteDoc(guardianRef);
      }

      // Xóa invitation
      await deleteDoc(docSnapshot.ref);
    });

    await Promise.all(batch);
  } catch (error) {
    console.error("Lỗi khi dọn dẹp dữ liệu cũ:", error);
  }
};

// Xóa guardian, invitation và lookup data khi hoàn tất đăng ký
export const deleteGuardianData = async (
  inviteCode: string,
): Promise<boolean> => {
  try {
    console.log(`Đang xóa dữ liệu guardian với mã mời: ${inviteCode}`);

    // Xóa guardian data
    const guardianRef = doc(db, "guardians", inviteCode);
    const guardianSnap = await getDoc(guardianRef);
    if (guardianSnap.exists()) {
      await deleteDoc(guardianRef);
      console.log(`Đã xóa guardian data với mã mời: ${inviteCode}`);
    }

    // Tìm và xóa invitation
    const lookupRef = doc(db, "invitations_lookup", inviteCode);
    const lookupSnap = await getDoc(lookupRef);

    if (lookupSnap.exists()) {
      const inviteId = lookupSnap.data().inviteId;

      // Xóa invitation
      await deleteDoc(doc(db, "invitations", inviteId));
      console.log(`Đã xóa invitation với ID: ${inviteId}`);

      // Xóa lookup
      await deleteDoc(lookupRef);
      console.log(`Đã xóa invitation lookup với mã mời: ${inviteCode}`);
    }

    return true;
  } catch (error) {
    console.error("Lỗi khi xóa dữ liệu guardian:", error);
    return false;
  }
};
