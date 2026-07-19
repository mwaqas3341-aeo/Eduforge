import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session?.isAdmin) redirect("/dashboard");

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Admin</h1>
      <p className="text-sm text-slate-600">
        Subject approvals, activity categories, grade bands, remark
        templates, govt schools, and payment approvals will be built here.
      </p>
    </main>
  );
}
