"use server";

import { cookies } from "next/headers";

export async function login(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword) {
    return { error: "Admin credentials are not configured in the server." };
  }

  if (username === validUsername && password === validPassword) {
    // Set a simple cookie session
    (await cookies()).set("session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });
    // Store the username for display in the sidebar
    (await cookies()).set("username", username, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return { success: true };
  }

  return { error: "Invalid username or password" };
}

export async function logout() {
  (await cookies()).delete("session");
}
