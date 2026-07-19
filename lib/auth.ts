import bcrypt from "bcryptjs";

// CNIC formats accepted from the user: with or without dashes.
// Normalized storage format is always XXXXX-XXXXXXX-X.
const CNIC_DIGITS_ONLY = /^\d{13}$/;
const CNIC_FORMATTED = /^\d{5}-\d{7}-\d{1}$/;

export function normalizeCnic(raw: string): string | null {
  const trimmed = raw.trim();

  if (CNIC_FORMATTED.test(trimmed)) return trimmed;

  const digitsOnly = trimmed.replace(/-/g, "");
  if (CNIC_DIGITS_ONLY.test(digitsOnly)) {
    return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5, 12)}-${digitsOnly.slice(12)}`;
  }

  return null; // invalid format
}

// At least 8 characters, and must contain both a letter and a number.
export function isPasswordValid(password: string): boolean {
  if (password.length < 8) return false;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

export function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type SignupInput = {
  full_name: string;
  father_name: string;
  address: string;
  cnic: string;
  cell_no: string;
  email: string;
  password: string;
  school_type: "govt" | "private";
  govt_school_id?: string;
  private_school_name?: string;
};

export function validateSignupInput(input: Partial<SignupInput>): {
  valid: boolean;
  errors: string[];
  normalizedCnic?: string;
} {
  const errors: string[] = [];

  if (!input.full_name?.trim()) errors.push("Full name is required.");
  if (!input.father_name?.trim()) errors.push("Father name is required.");
  if (!input.address?.trim()) errors.push("Address is required.");
  if (!input.cell_no?.trim()) errors.push("Cell number is required.");

  let normalizedCnic: string | undefined;
  if (!input.cnic?.trim()) {
    errors.push("CNIC is required.");
  } else {
    const n = normalizeCnic(input.cnic);
    if (!n) {
      errors.push("CNIC must be 13 digits (format: XXXXX-XXXXXXX-X).");
    } else {
      normalizedCnic = n;
    }
  }

  if (!input.email?.trim() || !isEmailValid(input.email)) {
    errors.push("A valid email address is required.");
  }

  if (!input.password || !isPasswordValid(input.password)) {
    errors.push(
      "Password must be at least 8 characters and include both letters and numbers."
    );
  }

  if (input.school_type !== "govt" && input.school_type !== "private") {
    errors.push("School type must be 'govt' or 'private'.");
  } else if (input.school_type === "govt" && !input.govt_school_id) {
    errors.push("Please select a government school.");
  } else if (
    input.school_type === "private" &&
    !input.private_school_name?.trim()
  ) {
    errors.push("Please enter your private school's name.");
  }

  return { valid: errors.length === 0, errors, normalizedCnic };
}
