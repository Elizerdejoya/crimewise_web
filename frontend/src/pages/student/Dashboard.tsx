import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { JwtTokenPayload } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Calendar, FileText } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { authenticatedFetch } from "@/lib/auth";

const StudentDashboard = () => {
  const [profile, setProfile] = useState<any>(null);
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const decoded: JwtTokenPayload = jwtDecode(token);
    const studentId = decoded.id;

    // Fetch student profile with batch and class information
    authenticatedFetch(`${API_BASE_URL}/api/students/full`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        const student = data.find((s: any) => s.id === studentId);
        if (student) {
          setProfile({
            ...student,
            batch: student.batch_name || "-",
            class: student.class_name || "-"
          });
        }
      })
      .catch((err) => {
        console.error('Error fetching profile:', err);
        toast({
          title: "Error",
          description: "Failed to fetch profile information.",
          variant: "destructive",
        });
      });

    // Fetch upcoming exams for student using the new endpoint
    authenticatedFetch(`${API_BASE_URL}/api/exams/student/${studentId}/upcoming`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setUpcomingExams(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Error fetching upcoming exams:', err);
        toast({
          title: "Error",
          description: "Failed to fetch upcoming exams.",
          variant: "destructive",
        });
      });

    // Fetch recent results for student
    authenticatedFetch(`${API_BASE_URL}/api/exams/student/${studentId}/results`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => setRecentResults(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error('Error fetching results:', err);
        toast({
          title: "Error",
          description: "Failed to fetch exam results.",
          variant: "destructive",
        });
      });

    setLoading(false);
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Student Dashboard
          </h2>
          <p className="text-muted-foreground">
            Your academic profile, upcoming exams, and results
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>My Profile</CardTitle>
              <CardDescription>Your academic information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Student ID</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.id || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.name || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Batch</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.batch || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Class</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.class || "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Upcoming Exams</CardTitle>
                <CardDescription>Scheduled in the next 7 days</CardDescription>
              </div>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {upcomingExams.length === 0 ? (
                  <div className="text-muted-foreground text-center">
                    No upcoming exams
                  </div>
                ) : (
                  upcomingExams.map((exam: any) => (
                    <div
                      key={exam.id}
                      className="flex justify-between items-center p-3 border rounded-md bg-background"
                    >
                      <div>
                        <p className="font-medium">{exam.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exam.start?.split("T")[0]} • {exam.duration} mins
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {exam.course_name || exam.course_code || "Course"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Instructor: {exam.instructor_name}
                        </p>
                      </div>
                      <Button size="sm">Enter Token</Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Recent Results</CardTitle>
                <CardDescription>Your examination performance</CardDescription>
              </div>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm border-b">
                    <th className="pb-2">Exam</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Course</th>
                    <th className="pb-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(recentResults) && recentResults.length > 0 ? (
                    recentResults.map((result: any) => (
                      <tr key={result.id} className="border-b">
                        <td className="py-3">
                          {result.examName || result.exam_id}
                        </td>
                        <td className="py-3">{result.date}</td>
                        <td className="py-3">
                          {result.course || result.course_id}
                        </td>
                        <td className="py-3">{result.score}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
                        No results
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
