import { NextResponse } from "next/server";
import { checkIPCreatedWallet, saveIPRecord } from "@/lib/firebase/ipService";
import type { NextRequest } from "next/server";

const getClientIP = (req: Request) => {
  const headers = req.headers;
  const ip = 
    headers.get('x-real-ip') || // Nginx proxy
    headers.get('x-forwarded-for')?.split(',')[0] || // Standard proxy
    headers.get('cf-connecting-ip') || // Cloudflare
    headers.get('true-client-ip') || // Akamai
    'unknown';
  return ip;
};

export async function POST(req: Request) {
  try {
    // Lấy IP từ request headers
    const ip = getClientIP(req);

    const { walletAddress } = await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }

    // Kiểm tra xem IP đã tạo ví chưa
    const hasCreatedWallet = await checkIPCreatedWallet(ip);

    if (hasCreatedWallet) {
      return NextResponse.json({
        canReceiveSOL: false,
        message: "This IP has already created a wallet"
      });
    }

    // Lưu thông tin IP và ví
    await saveIPRecord(ip, walletAddress);

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