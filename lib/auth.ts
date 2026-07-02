import { redirect } from "next/navigation";
import { ensureAssetColumns } from "@/lib/asset-schema";
import { getSessionUser } from "@/lib/session";

export async function getUser() {
  return getSessionUser();
}

export async function requireUser() {
  const user = await getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "admin") {
    redirect("/library");
  }

  await ensureAssetColumns();

  return user;
}
