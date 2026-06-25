import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { globalSearch } from "@/lib/queries/search";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await globalSearch(user, q, 6);
  return NextResponse.json({ results });
}
