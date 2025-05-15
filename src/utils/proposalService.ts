import { Timestamp, updateDoc, doc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Proposal as BaseProposal } from "@/lib/firebase/proposalService";

// Mở rộng interface Proposal để hỗ trợ các trường mới
interface Proposal extends BaseProposal {
  params?: {
    token_mint?: string;
    token_amount?: number;
    amount?: number;
    destination?: string;
  };
  tokenMint?: string | null;
  extraData?: {
    tokenMint?: string;
    [key: string]: unknown;
  };
}

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
    
    // Chuẩn hóa dữ liệu proposal trước khi lưu
    const updateData: {
      status: string;
      executedAt: Timestamp;
      transactionSignature?: string;
      params?: {
        token_mint?: string;
        token_amount?: number;
        amount?: number;
        destination?: string;
      };
    } = {
      status: proposal.status,
      executedAt: Timestamp.now()
    };
    
    if (proposal.transactionSignature) {
      updateData.transactionSignature = proposal.transactionSignature;
    }

    // Chuẩn hóa dữ liệu token cho đề xuất transfer_token
    if (proposal.action === 'transfer_token') {
      // Đảm bảo params tồn tại
      if (!updateData.params) updateData.params = {};
      
      // Chuẩn hóa token_mint
      if (proposal.params?.token_mint) {
        updateData.params.token_mint = proposal.params.token_mint;
      } else if (typeof proposal.tokenMint === 'string') {
        updateData.params.token_mint = proposal.tokenMint;
      } else if (proposal.extraData?.tokenMint) {
        updateData.params.token_mint = proposal.extraData.tokenMint;
      }
      
      // Chuẩn hóa token_amount nếu có
      if (proposal.params?.token_amount) {
        updateData.params.token_amount = proposal.params.token_amount;
      }
      
      console.log("Đã chuẩn hóa dữ liệu token khi cập nhật:", {
        token_mint: updateData.params.token_mint,
        token_amount: updateData.params.token_amount
      });
    }
    
    await updateDoc(docRef, updateData);
    console.log(`Đã cập nhật đề xuất ID ${proposal.proposalId}`);
  } catch (error) {
    console.error(`Lỗi khi cập nhật đề xuất:`, error);
    throw error;
  }
}; 