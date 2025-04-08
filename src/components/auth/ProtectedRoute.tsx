"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

import { useWalletStore } from "@/store/walletStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { multisigPDA } = useWalletStore();

  useEffect(() => {
    // Kiểm tra xem có phải route protected không (nằm trong thư mục (app))
    const isProtectedRoute =
      pathname !== "/" &&
      pathname !== "/create-wallet" &&
      !pathname.startsWith("/guardian");

    // Nếu đã đăng nhập và đang ở trang chủ (/)
    if (multisigPDA && pathname === "/") {
      router.push("/dashboard");
    }
    // Nếu chưa đăng nhập và đang ở route protected
    else if (!multisigPDA && isProtectedRoute) {
      router.push("/");
    }
  }, [multisigPDA, router, pathname]);

  return <>{children}</>;
}

export default ProtectedRoute;
