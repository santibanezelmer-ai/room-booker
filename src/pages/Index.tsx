import { useAuth } from "@/hooks/useAuth";
import AuthPage from "@/pages/AuthPage";
import TeacherDashboard from "@/pages/TeacherDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function Index() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  if (role === "admin") return <AdminDashboard />;
  return <TeacherDashboard />;
}
