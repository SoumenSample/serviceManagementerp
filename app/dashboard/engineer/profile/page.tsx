import { getAuth } from "@/lib/auth-server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default async function EngineerProfilePage() {
  const auth = await getAuth();
  if (!auth) return <div className="p-6">Unauthorized</div>;
  await connectDB();
  const user = await User.findById(auth.sub).lean() as unknown as { name: string; email: string; mobile?: string; employeeId?: string; designation?: string; role: string; profileImage?: string; isActive: boolean } | null;
  if (!user) return <div className="p-6">User not found</div>;
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16"><AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          <div><CardTitle>{user.name}</CardTitle><p className="text-sm text-muted-foreground">{user.email}</p><Badge variant="outline" className="mt-1">{user.role}</Badge></div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Employee ID</span><span className="font-mono">{user.employeeId || "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Designation</span><span>{user.designation || "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span>{user.mobile || "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span>{user.role}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Active</span><Badge variant={user.isActive ? "default" : "secondary"}>{user.isActive ? "Active" : "Inactive"}</Badge></div>
          <p className="text-xs text-muted-foreground pt-2">Role, permissions and employeeId cannot be changed here (authorized admin only).</p>
        </CardContent>
      </Card>
    </div>
  );
}
