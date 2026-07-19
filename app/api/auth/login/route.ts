import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeCnic, verifyPassword } from "@/lib/auth";
import { createSession, setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.cnic || !body?.password) {
    return NextResponse.json(
      { error: "CNIC and password are required." },
      { status: 400 }
    );
  }

  const normalizedCnic = normalizeCnic(body.cnic);
  if (!normalizedCnic) {
    return NextResponse.json({ error: "Invalid CNIC format." }, { status: 400 });
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, password_hash, is_admin")
    .eq("cnic", normalizedCnic)
    .maybeSingle();

  // Generic error message on purpose — don't reveal whether the CNIC exists.
  const genericError = NextResponse.json(
    { error: "Invalid CNIC or password." },
    { status: 401 }
  );

  if (error || !user) return genericError;

  const passwordOk = await verifyPassword(body.password, user.password_hash);
  if (!passwordOk) return genericError;

  const token = await createSession({ userId: user.id, isAdmin: user.is_admin });
  await setSessionCookie(token);

  return NextResponse.json({ success: true, isAdmin: user.is_admin });
}
