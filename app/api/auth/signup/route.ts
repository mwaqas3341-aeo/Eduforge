import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashPassword, validateSignupInput } from "@/lib/auth";
import { createSession, setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { valid, errors, normalizedCnic } = validateSignupInput(body);
  if (!valid || !normalizedCnic) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  // Check CNIC / email uniqueness up front for a clean error message
  // (the DB unique constraints are the real source of truth/backstop).
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("users")
    .select("id")
    .or(`cnic.eq.${normalizedCnic},email.eq.${body.email.trim().toLowerCase()}`)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      { error: "An account with this CNIC or email already exists." },
      { status: 409 }
    );
  }

  const password_hash = await hashPassword(body.password);

  const insertPayload: Record<string, unknown> = {
    full_name: body.full_name.trim(),
    father_name: body.father_name.trim(),
    address: body.address.trim(),
    cnic: normalizedCnic,
    cell_no: body.cell_no.trim(),
    email: body.email.trim().toLowerCase(),
    password_hash,
    school_type: body.school_type,
  };

  if (body.school_type === "govt") {
    insertPayload.govt_school_id = body.govt_school_id;
  } else {
    insertPayload.private_school_name = body.private_school_name.trim();
  }

  const { data: user, error: insertError } = await supabaseAdmin
    .from("users")
    .insert(insertPayload)
    .select("id, is_admin")
    .single();

  if (insertError || !user) {
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 500 });
  }

  // Initialize their usage row (10 free credits, per design doc §8).
  // Defaults are already set at the column level in 001_schema.sql,
  // this insert just creates the row tied to the new user.
  const { error: usageError } = await supabaseAdmin
    .from("usage")
    .insert({ user_id: user.id });

  if (usageError) {
    // Not fatal to signup itself, but worth surfacing in logs.
    console.error("Failed to initialize usage row for user", user.id, usageError);
  }

  const token = await createSession({ userId: user.id, isAdmin: user.is_admin });
  await setSessionCookie(token);

  return NextResponse.json({ success: true });
}
