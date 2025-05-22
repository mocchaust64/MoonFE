import { NextResponse } from "next/server";
import { checkIPCreatedWallet, saveIPRecord } from "@/lib/firebase/ipService";
import type { NextRequest } from "next/server";

const getClientIP = (req: Request) => {
  const headers = req.headers;
  console.log('All headers:', Object.fromEntries(headers.entries()));
  
  // Ưu tiên lấy IP từ header x-client-ip được set bởi middleware
  const ip = headers.get('x-client-ip') || 'unknown';
    
  console.log('Detected IP:', ip);
  return ip;
};

export async function POST(req: Request) {
  try {
    // Lấy IP từ request headers
    const ip = getClientIP(req);
    console.log('Using IP for check:', ip);

    const { walletAddress } = await req.json();
    console.log('Wallet address:', walletAddress);

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }

    // Kiểm tra xem IP đã tạo ví chưa
    const hasCreatedWallet = await checkIPCreatedWallet(ip);
    console.log('Has created wallet:', hasCreatedWallet);

    if (hasCreatedWallet) {
      return NextResponse.json({
        canReceiveSOL: false,
        message: "This IP has already created a wallet"
      });
    }

    // Lưu thông tin IP và ví
    await saveIPRecord(ip, walletAddress);
    console.log('Saved IP record for:', ip);

    return NextResponse.json({
      canReceiveSOL: true,
      message: "First wallet creation for this IP"
    });

  } catch (error) {
    console.error("Error checking IP:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export function middleware(request: NextRequest) {
  const ip = getClientIP(request);
  request.headers.set('x-client-ip', ip);
  return NextResponse.next();
} 