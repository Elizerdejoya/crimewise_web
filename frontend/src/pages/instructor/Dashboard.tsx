import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { JwtTokenPayload } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Book, Calendar, FileText } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";

// Helper function to create auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const InstructorDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [recentExams, setRecentExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const decoded: JwtTokenPayload = jwtDecode(token);
    const instructorId = decoded.id;

    // Fetch assigned courses
    fetch(`${API_BASE_URL}/api/relations/instructor-course`, {
      headers: getAuthHeaders(),
    })
      .then(res => {
        if (res.status === 401) {
          toast({
            title: "Authentication Error",
            description: "Please log in again.",
            variant: "destructive",
          });
          return [];
        }
        return res.json();
      })
      .then(data => setCourses(data.filter((c: any) => c.instructor_id === instructorId)))
      .catch(err => console.error('Error fetching courses:', err));

    // Fetch question bank (backend now filters by instructor automatically)
    fetch(`${API_BASE_URL}/api/questions`, {
      headers: getAuthHeaders(),
    })
      .then(res => {
        if (res.status === 401) {
          toast({
            title: "Authentication Error",
            description: "Please log in again.",
            variant: "destructive",
          });
          return [];
        }
        return res.json();
      })
      .then(data => setQuestions(data))
      .catch(err => console.error('Error fetching questions:', err));

    // Fetch exams with details for dashboard
    fetch(`${API_BASE_URL}/api/exams?instructorId=${instructorId}&includeDetails=true`, {
      headers: getAuthHeaders(),
    })
      .then(res => {
        if (res.status === 401) {
          toast({
            title: "Authentication Error",
            description: "Please log in again.",
            variant: "destructive",
          });
          return [];
        }
        return res.json();
      })
      .then(data => {
        const now = new Date();
        // Filter upcoming exams (future exams)
        const upcoming = data.filter((e: any) => {
          const examDate = new Date(e.start || e.date);
          return examDate > now;
        });
        
        // Filter recent exams (past exams, limited to last 10)
        const recent = data
          .filter((e: any) => {
            const examDate = new Date(e.start || e.date);
            return examDate <= now;
          })
          .sort((a: any, b: any) => {
            const dateA = new Date(a.start || a.date);
            const dateB = new Date(b.start || b.date);
            return dateB.getTime() - dateA.getTime(); // Most recent first
          })
          .slice(0, 10); // Limit to 10 most recent
        
        setExams(upcoming);
        setRecentExams(recent);
      })
      .catch(err => {
        console.error('Error fetching exams:', err);
        // Fallback to basic exam fetch if detailed fetch fails
        fetch(`${API_BASE_URL}/api/exams?instructorId=${instructorId}`, {
          headers: getAuthHeaders(),
        })
          .then(res => res.json())
          .then(data => {
            const now = new Date();
            const upcoming = data.filter((e: any) => {
              const examDate = new Date(e.start || e.date);
              return examDate > now;
            });
            const recent = data
              .filter((e: any) => {
                const examDate = new Date(e.start || e.date);
                return examDate <= now;
              })
              .sort((a: any, b: any) => {
                const dateA = new Date(a.start || a.date);
                const dateB = new Date(b.start || b.date);
                return dateB.getTime() - dateA.getTime();
              })
              .slice(0, 10);
            setExams(upcoming);
            setRecentExams(recent);
          })
          .catch(fallbackErr => console.error('Fallback fetch also failed:', fallbackErr));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Instructor Dashboard</h2>
          <p className="text-muted-foreground">
            Manage your courses, exams, and view student performance.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-medium">Assigned Courses</CardTitle>
                <CardDescription>Courses you're teaching</CardDescription>
              </div>
              <Book className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courses.length}</div>
              <p className="text-xs text-muted-foreground">
                {courses.map((c: any) => c.course).join(", ") || "No courses assigned"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-medium">Upcoming Exams</CardTitle>
                <CardDescription>Scheduled in the next 7 days</CardDescription>
              </div>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{exams.length}</div>
              <p className="text-xs text-muted-foreground">
                {exams.slice(0, 2).map((e: any) => e.name || "Untitled Exam").join(", ") || "No upcoming exams"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-medium">Question Bank</CardTitle>
                <CardDescription>Questions you've created</CardDescription>
              </div>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{questions.length}</div>
              <p className="text-xs text-muted-foreground">
                {questions.filter((q: any) => q.type === "forensic").length} forensic document questions
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Recent Exams</CardTitle>
              <CardDescription>
                Results from recently completed examinations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm border-b">
                    <th className="pb-2">Exam Name</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Class</th>
                    <th className="pb-2">Participants</th>
                    <th className="pb-2">Avg. Score</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentExams.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-4">No recent exams</td></tr>
                  ) : recentExams.map((exam: any) => (
                    <tr key={exam.id} className="border-b">
                      <td className="py-3">{exam.name || "Untitled Exam"}</td>
                      <td className="py-3">
                        {exam.start ? exam.start.split("T")[0] : (exam.date ? exam.date.split("T")[0] : "-")}
                      </td>
                      <td className="py-3">{exam.class_id || exam.class || "-"}</td>
                      <td className="py-3">{exam.participants || 0}</td>
                      <td className="py-3">
                        {exam.avgScore !== undefined && exam.avgScore !== null ? `${exam.avgScore}%` : "-"}
                      </td>
                      <td className="py-3 text-right">
                        <a 
                          href={`/instructor/exams/${exam.id}/details`} 
                          className="text-primary hover:underline"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InstructorDashboard;
