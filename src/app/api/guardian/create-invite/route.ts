import { NextResponse } from "next/server";
import { createGuardianInvitation } from "@/lib/firebase/guardianService";

export async function POST(request: Request) {
  try {
    const { multisigPDA, guardianName, guardianEmail } = await request.json();

    if (!multisigPDA || !guardianName || !guardianEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Sử dụng hàm createGuardianInvitation mới để tránh trùng ID
    const { inviteCode, guardianId } = await createGuardianInvitation(
      multisigPDA,
      guardianName,
      guardianEmail
    );

    return NextResponse.json({
      success: true,
      inviteCode,
      guardianId,
      message: `Đã tạo lời mời cho guardian "${guardianName}" với ID: ${guardianId}`
    });
  } catch (error: any) {
    console.error("Error creating guardian invitation:", error);
    return NextResponse.json(
      { error: "Failed to create invitation", details: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
} 