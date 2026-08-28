"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  normalizeMemberships,
  resolveMembership,
  TENANT_COOKIE_NAME,
} from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function readCredential(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function login(formData: FormData): Promise<never> {
  const email = readCredential(formData, "email");
  const password = readCredential(formData, "password");

  if (!email || !password) {
    redirect("/login?error=missing-credentials");
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    redirect("/login?error=invalid-credentials");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    await supabase.auth.signOut();
    redirect("/login?error=invalid-session");
  }

  const { data, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, status, created_at, is_tenant_admin")
    .eq("user_id", user.id);

  if (membershipError) {
    await supabase.auth.signOut();
    redirect("/login?error=membership-check-failed");
  }

  const resolution = resolveMembership(normalizeMemberships(data), undefined);
  if (resolution.kind !== "active") {
    await supabase.auth.signOut();
    redirect(`/login?reason=${resolution.kind}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE_NAME, resolution.membership.tenantId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/app");
}

export async function logout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(TENANT_COOKIE_NAME);
  redirect("/login");
}
