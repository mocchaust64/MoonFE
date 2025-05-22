import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Lấy IP từ các header khác nhau
  const ip = 
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('true-client-ip') ||
    'unknown';

  // Thêm IP vào header để sử dụng ở các route handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-client-ip', ip);

  // Log IP để debug
  console.log('Middleware detected IP:', ip);
  console.log('All headers:', Object.fromEntries(requestHeaders.entries()));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: "/api/wallet/check-ip",
};
