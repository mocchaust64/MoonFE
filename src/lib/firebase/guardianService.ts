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
