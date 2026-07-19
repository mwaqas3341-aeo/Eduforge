import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getCurrentSession();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold mb-3">eduforge</h1>
      <p className="text-slate-600 mb-8 max-w-md">
        Generate school result cards from an Excel sheet — pick your school,
        subjects, and marks, and get PDF cards for every student.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="px-5 py-2.5 rounded-lg border border-slate-300 font-medium"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
