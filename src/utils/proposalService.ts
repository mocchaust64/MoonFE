import { Timestamp, updateDoc, doc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Proposal } from "@/lib/firebase/proposalService";

/**
 * Cập nhật đề xuất trong Firebase
 * @param proposal Đề xuất cần cập nhật
 */
export const updateProposalInFirebase = async (proposal: Proposal): Promise<void> => {
  try {
    // Tìm đề xuất dựa trên multisigAddress và proposalId
    const q = query(
      collection(db, 'proposals'),
      where('multisigAddress', '==', proposal.multisigAddress),
      where('proposalId', '==', proposal.proposalId)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      throw new Error(`Không tìm thấy đề xuất với ID ${proposal.proposalId}`);
    }
    
    // Lấy tham chiếu đến document
    const docRef = doc(db, 'proposals', querySnapshot.docs[0].id);
    
    // Cập nhật dữ liệu
    const updateData: {
      status: string;
      executedAt: Timestamp;
      transactionSignature?: string;
    } = {
      status: proposal.status,
      executedAt: Timestamp.now()
    };
    
    if (proposal.transactionSignature) {
      updateData.transactionSignature = proposal.transactionSignature;
    }
    
    await updateDoc(docRef, updateData);
    console.log(`Đã cập nhật đề xuất ID ${proposal.proposalId}`);
  } catch (error) {
    console.error(`Lỗi khi cập nhật đề xuất:`, error);
    throw error;
  }
}; 