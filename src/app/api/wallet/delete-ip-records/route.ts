import { NextResponse } from "next/server";
import { deleteAllIPRecords } from "@/lib/firebase/ipService";

export async function POST() {
  try {
    await deleteAllIPRecords();
    return NextResponse.json({
      success: true,
      message: "All IP records have been deleted"
    });
  } catch (error) {
    console.error("Error deleting IP records:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 