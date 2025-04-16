import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
} from '@solana/web3.js';
import { getWebAuthnAssertion } from "../utils/webauthnUtils"; 
import { formatLamportsToSOL, formatTimestamp, shortenAddress } from "../utils/uiHelpers";
import { createApproveProposalTx, createExecuteProposalTx } from "../utils/transactionUtils";
import { getWalletByCredentialId } from "../lib/firebase/webAuthnService";
import { getGuardianPDA } from "../utils/credentialUtils";
import { useWalletInfo } from "../hooks/useWalletInfo"

// Component hiển thị một người ký với trạng thái
const SignerItem: React.FC<{
  signer: string;
  isCurrent: boolean;
  hasSigned: boolean;
}> = ({ signer, isCurrent, hasSigned }) => {
  return (
    <div className={`signer-item ${isCurrent ? 'current' : ''}`}>
      <div className={`avatar ${hasSigned ? 'signed' : ''}`}>
        {hasSigned ? '✓' : signer.substring(0, 2)}
      </div>
      <div className="signer-info">
        <div className="signer-address">
          {shortenAddress(signer)}
          {isCurrent && <span className="current-badge">Bạn</span>}
        </div>
        <div className="signer-status">
          {hasSigned ? 'Đã ký' : 'Chưa ký'}
        </div>
      </div>
    </div>
  );
};

const ProposalDetail: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const proposalId = params?.proposalId as string;
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { multisigPDA } = useWalletInfo();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [signingLoading, setSigningLoading] = useState<boolean>(false);
  const [executingLoading, setExecutingLoading] = useState<boolean>(false);
  const [proposal, setProposal] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [action, setAction] = useState<'sign' | 'execute' | null>(null);
  
  // Các hàm helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  
  // Lấy thông tin chi tiết đề xuất
  useEffect(() => {
    const fetchProposalDetails = async () => {
      if (!multisigPDA || !publicKey || !proposalId) {
        return;
      }
      
      try {
        setLoading(true);
        
        // Gọi API để lấy chi tiết đề xuất
        // Đây là giả lập, thay bằng code thực khi có API
        const mockProposal = {
          id: parseInt(proposalId),
          proposalType: 'transfer',
          status: 'pending',
          timestamp: Date.now() - 3600000, // 1 giờ trước
          creator: publicKey.toBase58(),
          signers: [publicKey.toBase58()],
          requiredSignatures: 2,
          destination: 'GH7UD54ZVbvVVuGMHvAh7ALDzwGyiCGzxzLhcBmYmXyR',
          amount: 0.1 * 1e9, // 0.1 SOL in lamports
          tokenMint: null,
          description: 'Chuyển SOL',
          executed: false,
          accountData: {
            proposalPDA: 'Khe19niRtR2AjP6Xhp4wQv52kcnQXdKH5TXcdcfLucr',
            nonce: 1,
            guardians: ['Fy7WiqBy6MuWfnVjiPE8HQqkeLnyaLwBsk8cyyJ5WD8X', publicKey.toBase58()]
          }
        };
        
        setProposal(mockProposal);
        setLoading(false);
      } catch (error) {
        console.error('Lỗi khi lấy chi tiết đề xuất:', error);
        setError('Không thể tải chi tiết đề xuất. Vui lòng thử lại sau.');
        setLoading(false);
      }
    };
    
    fetchProposalDetails();
  }, [multisigPDA, publicKey, proposalId]);
  
  // Kiểm tra nếu người dùng hiện tại đã ký
  const hasCurrentUserSigned = () => {
    if (!publicKey || !proposal) return false;
    return proposal.signers.includes(publicKey.toBase58());
  };
  
  // Kiểm tra nếu đủ chữ ký để thực thi
  const hasEnoughSignatures = () => {
    if (!proposal) return false;
    return proposal.signers.length >= proposal.requiredSignatures;
  };
  
  // Hiển thị chip trạng thái với màu phù hợp
  const renderStatusChip = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="status-chip pending">⏳ Đang chờ</span>;
      case 'executed':
        return <span className="status-chip success">✓ Đã thực thi</span>;
      case 'rejected':
        return <span className="status-chip error">✕ Đã từ chối</span>;
      default:
        return <span className="status-chip">{status}</span>;
    }
  };
  
  // Xử lý ký đề xuất
  const handleSign = async () => {
    if (!publicKey || !multisigPDA || !proposal) {
      setError('Không đủ thông tin để ký đề xuất.');
      return;
    }
    
    try {
      setSigningLoading(true);
      setError(null);
      
      // Lấy proposalId từ proposal
      const proposalIdValue = proposal.id;
      
      // Lấy timestamp hiện tại
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Tạo message template để ký - guardianId sẽ được cập nhật sau khi người dùng chọn credential
      const messageTemplate = `approve:proposal_${proposalIdValue},timestamp:${timestamp}`;
      console.log('Template message để ký:', messageTemplate);
      
      // Yêu cầu người dùng xác thực trực tiếp với WebAuthn - không chỉ định credential ID
      // allowEmpty = true cho phép người dùng chọn từ danh sách các credential đã đăng ký
      const assertion = await getWebAuthnAssertion('', messageTemplate, true);
      
      // Lấy credential ID từ assertion hoặc clientDataJSON
      const clientDataObj = JSON.parse(new TextDecoder().decode(assertion.clientDataJSON));
      const credentialId = clientDataObj.credential?.id;
      
      if (!credentialId) {
        throw new Error('Không nhận được credential ID từ WebAuthn');
      }
      
      console.log('Đã nhận credential ID từ WebAuthn:', credentialId);
      
      // Lấy thông tin guardian từ Firebase dựa trên credential đã chọn
      const guardianInfo = await getWalletByCredentialId(credentialId);
      if (!guardianInfo) {
        throw new Error('Không tìm thấy thông tin guardian trong Firebase');
      }
      
      // Sử dụng guardianId từ Firebase
      if (!guardianInfo.guardianId) {
        throw new Error('Không tìm thấy guardianId trong thông tin guardian');
      }
      
      const guardianId = guardianInfo.guardianId;
      console.log('Guardian ID từ Firebase:', guardianId);
      
      // Tính guardianPDA dựa trên multisigPDA và guardianId
      const multisigPublicKey = new PublicKey(multisigPDA);
      const guardianPDA = getGuardianPDA(multisigPublicKey, guardianId);
      
      // Lấy WebAuthn public key từ Firebase
      if (!guardianInfo.guardianPublicKey || guardianInfo.guardianPublicKey.length === 0) {
        throw new Error('Không tìm thấy WebAuthn public key trong Firebase');
      }
      
      // Lưu WebAuthn public key vào localStorage để hàm getWebAuthnPublicKey có thể tìm thấy
      const normalizedCredentialId = Buffer.from(credentialId, 'base64').toString('hex');
      const credentialSpecificKey = `guardianPublicKey_${normalizedCredentialId}`;
      localStorage.setItem(credentialSpecificKey, Buffer.from(guardianInfo.guardianPublicKey).toString('hex'));
      console.log(`Đã lưu WebAuthn public key vào localStorage với key: ${credentialSpecificKey}`);
      
      // Tạo transaction để ký đề xuất
      const tx = await createApproveProposalTx(
        new PublicKey(proposal.accountData.proposalPDA),
        new PublicKey(multisigPDA),
        guardianPDA,
        guardianId,
        publicKey,
        assertion.signature,
        assertion.authenticatorData,
        assertion.clientDataJSON,
        proposalIdValue,
        timestamp,
        credentialId
      );
      
      // Gửi transaction
      const signature = await sendTransaction(tx, connection, {
        skipPreflight: false,  // Thay đổi để bắt lỗi sớm
        preflightCommitment: 'confirmed'
      });
      console.log('Đã ký đề xuất, signature:', signature);
      
      // Cập nhật UI
      setSuccess('Ký đề xuất thành công!');
      
      // Cập nhật danh sách người ký
      setProposal({
        ...proposal,
        signers: [...proposal.signers, publicKey.toBase58()]
      });
      
      setSigningLoading(false);
    } catch (error: any) {
      console.error('Lỗi khi ký đề xuất:', error);
      
      // Xử lý và hiển thị lỗi chi tiết từ blockchain
      let errorMessage = "Không thể ký đề xuất";
      
      // Lấy logs từ kết quả simulation nếu có
      if (error.logs) {
        console.error("Logs từ blockchain:", error.logs);
        errorMessage += "\n\nChi tiết từ blockchain:\n" + error.logs.join('\n');
      }
      
      // Lấy thông tin chi tiết từ transaction nếu có signature
      if (error.signature) {
        try {
          const txInfo = await connection.getTransaction(error.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
          
          if (txInfo?.meta?.logMessages) {
            console.error("Chi tiết logs từ blockchain:", txInfo.meta.logMessages);
            errorMessage += "\n\nLogs chi tiết:\n" + txInfo.meta.logMessages.join('\n');
          }
        } catch (e) {
          console.error("Không thể lấy thông tin giao dịch:", e);
        }
      }
      
      // Phân tích thông tin lỗi cụ thể để hiển thị thông báo dễ hiểu
      if (error.message.includes("custom program error: 0x")) {
        // Trích xuất mã lỗi
        const errorMatch = error.message.match(/custom program error: (0x[0-9a-fA-F]+)/);
        if (errorMatch && errorMatch[1]) {
          const errorCode = errorMatch[1];
          
          // Thêm giải thích cho mã lỗi cụ thể
          switch (errorCode) {
            case "0x1":
              errorMessage = "Lỗi khởi tạo không hợp lệ";
              break;
            case "0x2":
              errorMessage = "Lỗi tham số không hợp lệ";
              break;
            case "0x3":
              errorMessage = "Đề xuất đã tồn tại";
              break;
            case "0x4":
              errorMessage = "Đề xuất không tồn tại";
              break;
            case "0x5":
              errorMessage = "Guardian không hợp lệ";
              break;
            case "0x6":
              errorMessage = "Chữ ký không hợp lệ";
              break;
            case "0x7":
              errorMessage = "Không đủ chữ ký để thực thi";
              break;
            case "0x8":
              errorMessage = "Đề xuất đã được thực thi";
              break;
            default:
              errorMessage = `Lỗi chương trình: ${errorCode}`;
          }
        }
      } else if (error.message.includes("Instruction #")) {
        errorMessage = `Lỗi instruction: ${error.message}`;
        if (error.message.includes("Instruction #1 Failed")) {
          errorMessage += "\nĐể biết thêm chi tiết, vui lòng kiểm tra logs ở console hoặc xem trên Solana Explorer";
        }
      } else {
        errorMessage += `: ${error.message}`;
      }
      
      setError(errorMessage);
      setSigningLoading(false);
    }
  };
  
  // Xử lý thực thi đề xuất
  const handleExecute = async () => {
    if (!publicKey || !multisigPDA || !proposal) {
      setError('Không đủ thông tin để thực thi đề xuất.');
      return;
    }
    
    try {
      setExecutingLoading(true);
      setError(null);
      
      // Tạo transaction để thực thi đề xuất
      const tx = await createExecuteProposalTx(
        new PublicKey(proposal.accountData.proposalPDA),
        new PublicKey(multisigPDA),
        publicKey,
        proposal.destination ? new PublicKey(proposal.destination) : undefined
      );
      
      // Gửi transaction
      const signature = await sendTransaction(tx, connection, {
        skipPreflight: false,  // Thay đổi để bắt lỗi sớm
        preflightCommitment: 'confirmed'
      });
      console.log('Đã thực thi đề xuất, signature:', signature);
      
      // Cập nhật UI
      setSuccess('Thực thi đề xuất thành công!');
      setProposal({
        ...proposal,
        status: 'executed',
        executed: true
      });
      
      setExecutingLoading(false);
    } catch (error: any) {
      console.error('Lỗi khi thực thi đề xuất:', error);
      
      // Xử lý và hiển thị lỗi chi tiết từ blockchain
      let errorMessage = "Không thể thực thi đề xuất";
      
      // Lấy logs từ kết quả simulation nếu có
      if (error.logs) {
        console.error("Logs từ blockchain:", error.logs);
        errorMessage += "\n\nChi tiết từ blockchain:\n" + error.logs.join('\n');
      }
      
      // Lấy thông tin chi tiết từ transaction nếu có signature
      if (error.signature) {
        try {
          const txInfo = await connection.getTransaction(error.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
          
          if (txInfo?.meta?.logMessages) {
            console.error("Chi tiết logs từ blockchain:", txInfo.meta.logMessages);
            errorMessage += "\n\nLogs chi tiết:\n" + txInfo.meta.logMessages.join('\n');
          }
        } catch (e) {
          console.error("Không thể lấy thông tin giao dịch:", e);
        }
      }
      
      // Phân tích thông tin lỗi cụ thể để hiển thị thông báo dễ hiểu
      if (error.message.includes("custom program error: 0x")) {
        // Trích xuất mã lỗi
        const errorMatch = error.message.match(/custom program error: (0x[0-9a-fA-F]+)/);
        if (errorMatch && errorMatch[1]) {
          const errorCode = errorMatch[1];
          
          // Thêm giải thích cho mã lỗi cụ thể
          switch (errorCode) {
            case "0x1":
              errorMessage = "Lỗi khởi tạo không hợp lệ";
              break;
            case "0x2":
              errorMessage = "Lỗi tham số không hợp lệ";
              break;
            case "0x3":
              errorMessage = "Đề xuất đã tồn tại";
              break;
            case "0x4":
              errorMessage = "Đề xuất không tồn tại";
              break;
            case "0x5":
              errorMessage = "Guardian không hợp lệ";
              break;
            case "0x6":
              errorMessage = "Chữ ký không hợp lệ";
              break;
            case "0x7":
              errorMessage = "Không đủ chữ ký để thực thi đề xuất";
              break;
            case "0x8":
              errorMessage = "Đề xuất đã được thực thi trước đó";
              break;
            default:
              errorMessage = `Lỗi chương trình: ${errorCode}`;
          }
        }
      } else if (error.message.includes("Instruction #")) {
        errorMessage = `Lỗi instruction: ${error.message}`;
        if (error.message.includes("Instruction #1 Failed")) {
          errorMessage += "\nĐể biết thêm chi tiết, vui lòng kiểm tra logs ở console hoặc xem trên Solana Explorer";
        }
      } else {
        errorMessage += `: ${error.message}`;
      }
      
      setError(errorMessage);
      setExecutingLoading(false);
    }
  };
  
  // Mở hộp thoại xác nhận
  const openConfirmDialog = (actionType: 'sign' | 'execute') => {
    setAction(actionType);
    setConfirmOpen(true);
  };
  
  // Xử lý hành động xác nhận
  const handleConfirmedAction = () => {
    setConfirmOpen(false);
    if (action === 'sign') {
      handleSign();
    } else if (action === 'execute') {
      handleExecute();
    }
  };
  
  const goBack = () => {
    router.push('/proposals');
  };
  
  
  if (error && !proposal) {
    return (
      <div className="error-container">
        <div className="error-message">{error}</div>
        <button className="back-button" onClick={goBack}>
          ← Quay lại danh sách đề xuất
        </button>
      </div>
    );
  }
  
  if (!proposal) {
    return (
      <div className="error-container">
        <div className="warning-message">
          Không tìm thấy đề xuất với ID: {proposalId}
        </div>
        <button className="back-button" onClick={goBack}>
          ← Quay lại danh sách đề xuất
        </button>
      </div>
    );
  }
  
  return (
    <div className="proposal-detail">
      <div className="header">
        <button className="back-button" onClick={goBack}>
          ← Quay lại
        </button>
        <h1>Chi tiết đề xuất</h1>
      </div>

      {success && (
        <div className="success-message">
          {success}
          <button className="close-button" onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
          <button className="close-button" onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="proposal-card">
        <div className="proposal-header">
          <div className="proposal-title">
            <h2>{proposal.proposalType === 'transfer' ? 'Chuyển tiền' : proposal.proposalType}</h2>
            {renderStatusChip(proposal.status)}
          </div>
          <div className="proposal-id">ID: {proposal.id}</div>
        </div>

        <hr />

        <div className="proposal-content">
          <div className="proposal-details">
            <h3>Chi tiết giao dịch</h3>

            {proposal.proposalType === 'transfer' && (
              <>
                <div className="detail-item">
                  <label>Số tiền</label>
                  <div className="amount">{formatLamportsToSOL(proposal.amount)} SOL</div>
                </div>

                <div className="detail-item">
                  <label>Địa chỉ người nhận</label>
                  <div className="address-container">
                    <code>{proposal.destination}</code>
                    <button className="copy-button" onClick={() => copyToClipboard(proposal.destination)}>
                      Sao chép
                    </button>
                  </div>
                </div>

                {proposal.description && (
                  <div className="detail-item">
                    <label>Mô tả</label>
                    <div>{proposal.description}</div>
                  </div>
                )}
              </>
            )}

            <div className="detail-item">
              <label>Thời gian tạo</label>
              <div>{formatTimestamp(proposal.timestamp)}</div>
            </div>

            <div className="detail-item">
              <label>Người tạo</label>
              <div className="creator">
                {shortenAddress(proposal.creator)}
                {proposal.creator === publicKey?.toBase58() && (
                  <span className="current-badge">Bạn</span>
                )}
              </div>
            </div>
          </div>

          <div className="signature-status">
            <h3>Trạng thái chữ ký</h3>

            <div className="progress-bar">
              <div 
                className="progress" 
                style={{width: `${(proposal.signers.length / proposal.requiredSignatures) * 100}%`}}
              ></div>
              <span className="progress-text">
                {proposal.signers.length}/{proposal.requiredSignatures}
              </span>
            </div>

            <div className="signers-list">
              <h4>Danh sách người ký</h4>
              {proposal.accountData.guardians.map((guardian: string) => (
                <SignerItem 
                  key={guardian}
                  signer={guardian}
                  isCurrent={publicKey?.toBase58() === guardian}
                  hasSigned={proposal.signers.includes(guardian)}
                />
              ))}
            </div>

            {proposal.status === 'pending' && (
              <div className="action-buttons">
                {!hasCurrentUserSigned() && (
                  <button 
                    className="sign-button"
                    onClick={() => openConfirmDialog('sign')}
                    disabled={signingLoading}
                  >
                    {signingLoading ? 'Đang xử lý...' : 'Ký đề xuất'}
                  </button>
                )}

                {(hasCurrentUserSigned() && hasEnoughSignatures() && !proposal.executed) && (
                  <button 
                    className="execute-button"
                    onClick={() => openConfirmDialog('execute')}
                    disabled={executingLoading}
                  >
                    {executingLoading ? 'Đang xử lý...' : 'Thực thi giao dịch'}
                  </button>
                )}

                {(hasCurrentUserSigned() && !hasEnoughSignatures()) && (
                  <div className="info-message">
                    Bạn đã ký đề xuất này. Cần thêm {proposal.requiredSignatures - proposal.signers.length} chữ ký để thực thi.
                  </div>
                )}
              </div>
            )}

            {proposal.status === 'executed' && (
              <div className="success-message">
                Giao dịch đã được thực thi thành công.
              </div>
            )}

            {proposal.status === 'rejected' && (
              <div className="error-message">
                Giao dịch đã bị từ chối.
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>{action === 'sign' ? 'Xác nhận ký đề xuất' : 'Xác nhận thực thi giao dịch'}</h2>
            <p>
              {action === 'sign' 
                ? 'Bạn có chắc chắn muốn ký đề xuất này? Hành động này không thể hoàn tác.'
                : 'Bạn có chắc chắn muốn thực thi giao dịch này? Hành động này sẽ chuyển tiền và không thể hoàn tác.'}
            </p>

            {action === 'execute' && proposal.proposalType === 'transfer' && (
              <div className="transaction-details">
                <h3>Chi tiết giao dịch:</h3>
                <p>Số tiền: <strong>{formatLamportsToSOL(proposal.amount)} SOL</strong></p>
                <p>Người nhận: <strong>{shortenAddress(proposal.destination)}</strong></p>
              </div>
            )}

            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setConfirmOpen(false)}>
                Hủy
              </button>
              <button 
                className={`confirm-button ${action === 'sign' ? 'sign' : 'execute'}`}
                onClick={handleConfirmedAction}
              >
                {action === 'sign' ? 'Ký đề xuất' : 'Thực thi giao dịch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalDetail; 