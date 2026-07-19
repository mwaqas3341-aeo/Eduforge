import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Public search endpoint (no auth required — needed during signup, before
// a session exists). Returns at most 20 matches to keep it dropdown-sized.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  let query = supabaseAdmin
    .from("govt_schools")
    .select("id, name, district")
    .order("name")
    .limit(20);

  if (q.length > 0) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }

  return NextResponse.json({ schools: data ?? [] });
}
