// Stub auth for dashboard development - replace with real auth logic
export type User = {
  name: string
  email: string
  role: string
}

export async function getCurrentUser(): Promise<User | null> {
  // TODO: replace with real session/JWT check (e.g., cookies, next-auth)
  // Returning mock user so dashboard builds and renders without login page
  return {
    name: "Demo User",
    email: "demo@espsoln.local",
    role: "admin",
  }
}
