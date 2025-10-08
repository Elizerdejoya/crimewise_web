import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Book,
  Users,
  Layers,
  FileText,
  UserCheck,
  CalendarClock,
  BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";
import { getCurrentUser, authenticatedFetch } from "@/lib/auth";

const statsCards = [
  { title: "Batches", key: "batches", description: "Total batches", icon: Layers, color: "bg-blue-100 text-blue-700" },
  { title: "Classes", key: "classes", description: "Active classes", icon: BookOpen, color: "bg-purple-100 text-purple-700" },
  { title: "Courses", key: "courses", description: "Available courses", icon: Book, color: "bg-green-100 text-green-700" },
  { title: "Instructors", key: "instructors", description: "Teaching staff", icon: UserCheck, color: "bg-amber-100 text-amber-700" },
  { title: "Students", key: "students", description: "Enrolled students", icon: Users, color: "bg-pink-100 text-pink-700" },
  { title: "Questions", key: "questions", description: "In question bank", icon: FileText, color: "bg-indigo-100 text-indigo-700" },
  { title: "Results", key: "results", description: "Exam results", icon: CalendarClock, color: "bg-rose-100 text-rose-700" },
  { title: "Users", key: "users", description: "System users", icon: Users, color: "bg-teal-100 text-teal-700" },
];

const AdminDashboard = () => {
  const [counts, setCounts] = useState<any>({});
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const currentUser = getCurrentUser();

  useEffect(() => {
    // Fetch overview counts
    authenticatedFetch(`${API_BASE_URL}/api/admin/overview-counts`, {
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setCounts(data);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch overview counts:", err);
        // Don't show error toast as authenticatedFetch handles auth errors
        if (!err.message.includes("Authentication failed") && !err.message.includes("Token expired")) {
          toast({
            title: "Error",
            description: "Failed to fetch dashboard data.",
            variant: "destructive",
          });
        }
      });

    // Fetch recent exams
    authenticatedFetch(`${API_BASE_URL}/api/admin/recent-exams?limit=10`, {
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setRecentExams(data);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch recent exams:", err);
        // Don't show error toast for recent exams as it's not critical
        // and authenticatedFetch handles auth errors
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of the CrimeWiseSystem platform statistics.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <div className={`p-2 rounded-full ${card.color}`}>
                  <card.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts[card.key] ?? "-"}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Exams Section */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Exams</CardTitle>
            <CardDescription>
              Recently completed examinations across all instructors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm border-b">
                  <th className="pb-2">Exam Name</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Instructor</th>
                  <th className="pb-2">Participants</th>
                  <th className="pb-2">Avg. Score</th>
                </tr>
              </thead>
              <tbody>
                {recentExams.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4">No recent exams</td></tr>
                ) : recentExams.map((exam: any) => (
                  <tr key={exam.id} className="border-b">
                    <td className="py-3">{exam.name || "Untitled Exam"}</td>
                    <td className="py-3">
                      {exam.start ? exam.start.split("T")[0] : (exam.date ? exam.date.split("T")[0] : "-")}
                    </td>
                    <td className="py-3">{exam.instructor_name || "-"}</td>
                    <td className="py-3">{exam.participants || 0}</td>
                    <td className="py-3">
                      {exam.avgScore !== undefined && exam.avgScore !== null ? `${exam.avgScore}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
