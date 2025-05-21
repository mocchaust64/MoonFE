/**
 * Chuyển đổi từ lamports sang SOL
 */
export const formatLamportsToSOL = (lamports: number): string => {
  return (lamports / 1_000_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 9,
  });
};

/**
 * Định dạng timestamp thành chuỗi ngày giờ
 */
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Rút gọn địa chỉ công khai
 */
export const shortenAddress = (address: string, chars = 4): string => {
  if (!address) return '';
  
  const prefix = address.slice(0, chars);
  const suffix = address.slice(-chars);
  
  return `${prefix}...${suffix}`;
}; 