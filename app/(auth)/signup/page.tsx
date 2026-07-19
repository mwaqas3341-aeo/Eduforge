"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type GovtSchool = { id: string; name: string; district: string | null };

export default function SignupPage() {
  const router = useRouter();
  const [schoolType, setSchoolType] = useState<"govt" | "private">("govt");
  const [govtQuery, setGovtQuery] = useState("");
  const [govtResults, setGovtResults] = useState<GovtSchool[]>([]);
  const [selectedGovtSchool, setSelectedGovtSchool] = useState<GovtSchool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function searchGovtSchools(q: string) {
    setGovtQuery(q);
    setSelectedGovtSchool(null);
    if (q.trim().length < 2) {
      setGovtResults([]);
      return;
    }
    const res = await fetch(`/api/govt-schools?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setGovtResults(data.schools ?? []);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      full_name: form.get("full_name"),
      father_name: form.get("father_name"),
      address: form.get("address"),
      cnic: form.get("cnic"),
      cell_no: form.get("cell_no"),
      email: form.get("email"),
      password: form.get("password"),
      school_type: schoolType,
    };

    if (schoolType === "govt") {
      if (!selectedGovtSchool) {
        setError("Please select your government school from the list.");
        return;
      }
      payload.govt_school_id = selectedGovtSchool.id;
    } else {
      payload.private_school_name = form.get("private_school_name");
    }

    setSubmitting(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Signup failed.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4"
      >
        <h1 className="text-xl font-bold">Create your account</h1>

        <Field name="full_name" label="Full Name" required />
        <Field name="father_name" label="Father Name" required />
        <Field name="address" label="Address" required />
        <Field name="cnic" label="CNIC (XXXXX-XXXXXXX-X)" required placeholder="35202-1234567-1" />
        <Field name="cell_no" label="Cell No." required />
        <Field name="email" label="Email" type="email" required />
        <Field
          name="password"
          label="Password"
          type="password"
          required
          hint="At least 8 characters, with letters and numbers."
        />

        <div>
          <label className="block text-sm font-medium mb-1">School Type</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSchoolType("govt")}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                schoolType === "govt"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "border-slate-300"
              }`}
            >
              Public / Govt
            </button>
            <button
              type="button"
              onClick={() => setSchoolType("private")}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                schoolType === "private"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "border-slate-300"
              }`}
            >
              Private
            </button>
          </div>
        </div>

        {schoolType === "govt" ? (
          <div>
            <label className="block text-sm font-medium mb-1">
              Search your school
            </label>
            <input
              value={govtQuery}
              onChange={(e) => searchGovtSchools(e.target.value)}
              placeholder="Start typing school name..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            {govtResults.length > 0 && (
              <ul className="mt-1 border border-slate-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                {govtResults.map((s) => (
                  <li
                    key={s.id}
                    onClick={() => {
                      setSelectedGovtSchool(s);
                      setGovtQuery(s.name);
                      setGovtResults([]);
                    }}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                  >
                    {s.name}
                    {s.district ? ` — ${s.district}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {selectedGovtSchool && (
              <p className="text-xs text-green-700 mt-1">
                Selected: {selectedGovtSchool.name}
              </p>
            )}
          </div>
        ) : (
          <Field name="private_school_name" label="Your School's Name" required />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-medium disabled:opacity-60"
        >
          {submitting ? "Creating account..." : "Sign up"}
        </button>

        <p className="text-sm text-center text-slate-600">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-slate-900 underline">
            Log in
          </a>
        </p>
      </form>
    </main>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
