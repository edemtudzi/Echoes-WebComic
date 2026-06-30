"use server";

import { redirect } from "next/navigation";
import { one } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clearSession, setSession } from "@/lib/session";

export async function signUp(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  let createdUser:
    | {
        id: string;
        email: string;
        display_name: string;
        role: "reader" | "moderator" | "admin";
      }
    | null = null;

  try {
    createdUser = await one<{
      id: string;
      email: string;
      display_name: string;
      role: "reader" | "moderator" | "admin";
    }>(
      `insert into public.app_users (email, password_hash, display_name)
       values ($1, $2, $3)
       returning id, email, display_name, role`,
      [email, hashPassword(password), displayName || "Reader"]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create account.";
    redirect(`/sign-up?error=${encodeURIComponent(message)}`);
  }

  if (!createdUser) {
    redirect(`/sign-up?error=${encodeURIComponent("Could not create account.")}`);
  }

  await setSession({
    id: createdUser.id,
    email: createdUser.email,
    displayName: createdUser.display_name,
    role: createdUser.role
  });

  redirect("/library");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await one<{
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
    role: "reader" | "moderator" | "admin";
  }>(
    `select id, email, display_name, password_hash, role
     from public.app_users
     where lower(email) = lower($1)`,
    [email]
  );

  if (!user || !verifyPassword(password, user.password_hash)) {
    redirect(`/sign-in?error=${encodeURIComponent("Invalid email or password.")}`);
  }

  await setSession({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role
  });

  redirect("/library");
}

export async function signOut() {
  await clearSession();
  redirect("/");
}
