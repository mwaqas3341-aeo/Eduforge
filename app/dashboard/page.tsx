import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("full_name, school_type, private_school_name, govt_school_id")
    .eq("id", session.userId)
    .single();

  const { data: usage } = await supabaseAdmin
    .from("usage")
    .select("free_credits_total, free_credits_used, paid_credits_total, paid_credits_used")
    .eq("user_id", session.userId)
    .single();

  const remaining = usage
    ? usage.free_credits_total -
      usage.free_credits_used +
      (usage.paid_credits_total - usage.paid_credits_used)
    : 0;

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold">
          Welcome{user?.full_name ? `, ${user.full_name}` : ""}
        </h1>
        <form action="/api/auth/logout" method="post">
          <button className="text-sm text-slate-600 underline">Log out</button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <p className="text-sm text-slate-600">Remaining generation credits</p>
        <p className="text-2xl font-bold">{remaining}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm text-slate-600">
          Next step: subject selection, marks configuration, and Excel
          template download land here (Step 2 of the build).
        </p>
      </div>
    </main>
  );
}
