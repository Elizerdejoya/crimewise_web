import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  FilePlus2,
  RefreshCw,
  Edit2,
  Trash2,
  Copy,
  Printer,
  FileSpreadsheet,
  FileText,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/lib/config";

// Get current user from localStorage
const getCurrentUser = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload;
  } catch (e) {
    return null;
  }
};

// Create auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const StudentsPage = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddStep1Open, setIsAddStep1Open] = useState(false);
  const [isAddStep2Open, setIsAddStep2Open] = useState(false);
  const [addStudentCount, setAddStudentCount] = useState(1);
  const [addStudentRows, setAddStudentRows] = useState<
    {
      id: string;
      name: string;
      email: string;
      password: string;
      studentId: string;
      class_id: string;
      course_id: string;
    }[]
  >([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editRows, setEditRows] = useState<
    {
      id: number;
      name: string;
      email: string;
      studentId: string;
      password?: string;
      class_id?: string;
      course_id?: string;
    }[]
  >([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedRows, setImportedRows] = useState<
    { name: string; email: string; studentId: string; password: string; class_id: string; course_id: string }[]
  >([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [sortBy, setSortBy] = useState<"name" | "email" | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const currentUser = getCurrentUser();

  // Fetch students, classes, and courses from backend
  useEffect(() => {
    fetchStudents();
    fetchClasses();
    fetchCourses();
  }, []);

  const fetchStudents = () => {
    fetch(`${API_BASE_URL}/api/students`, {
      cache: "no-store",
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (res.status === 401) {
          toast({
            title: "Authentication Error",
            description: "Please log in again.",
            variant: "destructive",
          });
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        // Ensure data is an array
        if (Array.isArray(data)) {
          console.log('Fetched students data:', data);
          console.log('Sample student object:', data[0]);
          setStudents(data);
        } else {
          console.error("API returned non-array data:", data);
          setStudents([]);
          toast({
            title: "Error",
            description: "Invalid data format received from server.",
            variant: "destructive",
          });
        }
      })
      .catch((err) => {
        console.error("[Students][Fetch] Error:", err);
        setStudents([]);
        toast({
          title: "Error",
          description: "Failed to fetch students.",
          variant: "destructive",
        });
      });
  };

  const fetchClasses = () => {
    fetch(`${API_BASE_URL}/api/classes`, {
      cache: "no-store",
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClasses(data);
        }
      })
      .catch((err) => {
        console.error("[Classes][Fetch] Error:", err);
      });
  };

  const fetchCourses = () => {
    fetch(`${API_BASE_URL}/api/courses`, {
      cache: "no-store",
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCourses(data);
        }
      })
      .catch((err) => {
        console.error("[Courses][Fetch] Error:", err);
      });
  };

  // Filter and sort students based on search term and sort order
  let filteredStudents = (students || []).filter(
    (student) =>
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (sortBy === "name") {
    filteredStudents = filteredStudents.sort((a, b) => {
      if (sortOrder === "asc")
        return (a.name || "").localeCompare(b.name || "");
      else return (b.name || "").localeCompare(a.name || "");
    });
  } else if (sortBy === "email") {
    filteredStudents = filteredStudents.sort((a, b) => {
      if (sortOrder === "asc") return a.email.localeCompare(b.email);
      else return b.email.localeCompare(a.email);
    });
  }

  // Selection logic
  const isAllSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedIds.includes(s.id));
  const isIndeterminate = selectedIds.length > 0 && !isAllSelected;
  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(filteredStudents.map((s) => s.id));
  };
  const toggleSelectRow = (id: number) => {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    );
  };
  const clearSelection = () => setSelectedIds([]);

  // Toolbar button handlers
  const handleReload = () => {
    fetch(`${API_BASE_URL}/api/students/full`, {
      cache: "no-store",
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        // Ensure data is an array
        if (Array.isArray(data)) {
          setStudents(data);
          clearSelection();
        } else {
          console.error("API returned non-array data:", data);
          setStudents([]);
          toast({
            title: "Error",
            description: "Invalid data format received from server.",
            variant: "destructive",
          });
        }
      })
      .catch((err) => {
        console.error("[Students][Reload] Error:", err);
        setStudents([]);
        toast({
          title: "Error",
          description: "Failed to fetch students.",
          variant: "destructive",
        });
      });
  };

  const handleCopy = () => {
    if (selectedIds.length === 0) return;
    const rows = (students || []).filter((s) => selectedIds.includes(s.id));
    const text = rows
      .map(
        (r) =>
          `${r.id}\t${r.name || "-"}\t${r.email}\t${r.student_id || "-"}\t${classes.find((c) => c.id === r.class_id)?.name || "-"
          }\t${courses.find((c) => c.id === r.course_id)?.name || "-"}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Selected rows copied to clipboard.",
    });
  };

  const handlePrint = () => {
    if (selectedIds.length === 0) return;
    const rows = (students || []).filter((s) => selectedIds.includes(s.id));
    const printWindow = window.open("", "", "height=600,width=800");
    if (printWindow) {
      printWindow.document.write(
        "<html><head><title>Print Students</title></head><body>"
      );
      printWindow.document.write(
        '<table border="1"><tr><th>ID</th><th>Name</th><th>Email</th><th>Student ID</th><th>Class</th><th>Course</th></tr>'
      );
      rows.forEach((r) =>
        printWindow.document.write(
          `<tr><td>${r.id}</td><td>${r.name || "-"}</td><td>${r.email
          }</td><td>${r.student_id || "-"}</td><td>${classes.find((c) => c.id === r.class_id)?.name || "-"
          }</td><td>${courses.find((c) => c.id === r.course_id)?.name || "-"
          }</td></tr>`
        )
      );
      printWindow.document.write("</table></body></html>");
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExcel = () => {
    if (selectedIds.length === 0) return;
    const rows = (students || []).filter((s) => selectedIds.includes(s.id));
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        ID: r.id,
        Name: r.name || "-",
        Email: r.email,
        "Student ID": r.student_id || "-",
        Class: classes.find((c) => c.id === r.class_id)?.name || "-",
        Course: courses.find((c) => c.id === r.course_id)?.name || "-",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students.xlsx");
    toast({ title: "Excel Exported", description: "Excel file downloaded." });
  };

  const handlePDF = () => {
    if (selectedIds.length === 0) return;
    const rows = (students || []).filter((s) => selectedIds.includes(s.id));
    const doc = new jsPDF();
    doc.text("Student List", 14, 16);
    autoTable(doc, {
      head: [["ID", "Name", "Email", "Student ID", "Class", "Course"]],
      body: rows.map((r) => [
        r.id,
        r.name || "-",
        r.email,
        r.student_id || "-",
        classes.find((c) => c.id === r.class_id)?.name || "-",
        courses.find((c) => c.id === r.course_id)?.name || "-",
      ]),
      startY: 22,
    });
    doc.save("students.pdf");
    toast({ title: "PDF Exported", description: "PDF file downloaded." });
  };

  // Open edit modal and prefill selected rows
  const openEditModal = () => {
    const selected = (students || []).filter((s) => selectedIds.includes(s.id));
    setEditRows(
      selected.map((s) => ({
        id: s.id,
        name: s.name || "",
        email: s.email,
        studentId: s.student_id || "",
        class_id: s.class_id?.toString() || "",
        course_id: s.course_id?.toString() || "",
      }))
    );
    setIsEditModalOpen(true);
  };

  // Handle import file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Debug: Log what we're parsing
        console.log("Raw Excel data:", json);
        
        // Expect header row with column names
        const header = (json[0] as string[]).map((h) => h.toLowerCase());
        console.log("Excel headers found:", header);
        
        const nameIdx = header.findIndex((h) => h.includes("name"));
        const emailIdx = header.findIndex((h) => h.includes("email"));
        const studentIdIdx = header.findIndex(
          (h) => h.includes("student") && h.includes("id")
        );
        const classIdx = header.findIndex((h) => h.includes("class"));
        const courseIdx = header.findIndex((h) => h.includes("course"));

        console.log("Column indices found:", {
          name: nameIdx,
          email: emailIdx,
          studentId: studentIdIdx,
          class: classIdx,
          course: courseIdx
        });

        if (nameIdx === -1 || emailIdx === -1) {
          setImportError("File must contain 'Name' and 'Email' columns.");
          return;
        }

        // Generate default student IDs and passwords for import
        const rows = (json as any[][])
          .slice(1)
          .map((r, i) => {
            const name = (r[nameIdx] || "").toString().trim();
            const email = (r[emailIdx] || "").toString().trim();
            const studentId = studentIdIdx !== -1 && r[studentIdIdx]
              ? r[studentIdIdx].toString().trim()
              : `ST-${Math.floor(10000 + Math.random() * 90000)}`;
            
            // Map class name to class ID
            const class_id = classIdx !== -1 && r[classIdx] ? (() => {
              const className = r[classIdx].toString().trim();
              const foundClass = classes.find((c: any) => c.name === className);
              return foundClass ? foundClass.id.toString() : "";
            })() : "";
            
            // Map course name to course ID
            const course_id = courseIdx !== -1 && r[courseIdx] ? (() => {
              const courseName = r[courseIdx].toString().trim();
              const foundCourse = courses.find((c: any) => c.name === courseName);
              return foundCourse ? foundCourse.id.toString() : "";
            })() : "";
            
            return {
              name,
              email,
              studentId,
              password: "CRIMEWISE",
              class_id,
              course_id
            };
          })
          .filter((r) => r.name && r.email);

        console.log("Parsed student rows with class/course mapping:", rows);
        
        if (rows.length === 0) {
          setImportError("No valid student data found in file.");
        } else {
          setImportedRows(rows);
        }
      } catch (err) {
        setImportError(
          "Failed to parse file. Please upload a valid Excel or CSV file."
        );
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportSubmit = async () => {
    if (importedRows.length === 0) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/students/bulk`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          students: importedRows.map((r) => ({
            ...r,
            role: "student",
            password: "CRIMEWISE", // Default password
            status: "active",
            class_id: r.class_id || null,
            course_id: r.course_id || null,
          })),
        }),
      });
      if (res.ok) {
        toast({
          title: "Import Success",
          description: `${importedRows.length} students imported.`,
        });
        setIsImportModalOpen(false);
        setImportedRows([]);
        handleReload();
      } else {
        const error = await res.json();
        setImportError(error.error || "Failed to import students.");
      }
    } catch (err) {
      setImportError("Failed to import students.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-4">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setIsAddStep1Open(true)}>
              <FilePlus2 className="mr-1 h-4 w-4" /> Add Data
            </Button>
            <Button size="sm" onClick={() => setIsImportModalOpen(true)}>
              <Download className="mr-1 h-4 w-4" /> Import
            </Button>
            <Button size="sm" variant="outline" onClick={handleReload}>
              <RefreshCw className="mr-1 h-4 w-4" /> Reload
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={openEditModal}
              disabled={selectedIds.length === 0}
            >
              <Edit2 className="mr-1 h-4 w-4" /> Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setIsDeleteConfirmOpen(true)}
              disabled={selectedIds.length === 0}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              disabled={selectedIds.length === 0}
            >
              <Copy className="mr-1 h-4 w-4" /> Copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              disabled={selectedIds.length === 0}
            >
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExcel}
              disabled={selectedIds.length === 0}
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePDF}
              disabled={selectedIds.length === 0}
            >
              <FileText className="mr-1 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
        {/* Search */}
        <div className="flex items-center mb-2">
          <Input
            ref={searchInputRef}
            placeholder="Search students..."
            className="w-[250px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isIndeterminate;
                      }}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>
                    Name
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 p-0 h-4 w-4 align-middle"
                      onClick={() => {
                        setSortBy("name");
                        setSortOrder((order) =>
                          order === "asc" ? "desc" : "asc"
                        );
                      }}
                    >
                      {sortOrder === "asc" && sortBy === "name" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>
                    Email
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 p-0 h-4 w-4 align-middle"
                      onClick={() => {
                        setSortBy("email");
                        setSortOrder((order) =>
                          order === "asc" ? "desc" : "asc"
                        );
                      }}
                    >
                      {sortOrder === "asc" && sortBy === "email" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Course</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      No students found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow
                      key={student.id}
                      className={
                        selectedIds.includes(student.id) ? "bg-muted" : ""
                      }
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(student.id)}
                          onChange={() => toggleSelectRow(student.id)}
                        />
                      </TableCell>
                      <TableCell>{student.id}</TableCell>
                      <TableCell>{student.name || "-"}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.student_id}</TableCell>
                      <TableCell>
                        {classes.find((c) => c.id === student.class_id)?.name ||
                          student.class_id ||
                          "-"}
                      </TableCell>
                      <TableCell>
                        {courses.find((c) => c.id === student.course_id)
                          ?.name ||
                          student.course_id ||
                          "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add Data Modal Step 1 */}
        <Dialog open={isAddStep1Open} onOpenChange={setIsAddStep1Open}>
          <DialogContent className="max-w-[800px] w-full">
            <DialogHeader>
              <DialogTitle>Add Data - Step 1</DialogTitle>
              <DialogDescription>
                Enter the number of students to add (1-50).
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <Input
                type="number"
                min={1}
                max={50}
                value={addStudentCount}
                onChange={(e) =>
                  setAddStudentCount(
                    Math.max(1, Math.min(50, Number(e.target.value)))
                  )
                }
                placeholder="Number of students"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsAddStep1Open(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setAddStudentRows(
                      Array.from({ length: addStudentCount }, (_, i) => ({
                        id: `new-${i + 1}`,
                        name: "",
                        email: "",
                        password: "CRIMEWISE", // Default password
                        studentId: "", // New field
                        class_id: classes[0]?.id?.toString() || "",
                        course_id: courses[0]?.id?.toString() || "", // Added course_id
                      }))
                    );
                    setIsAddStep1Open(false);
                    setIsAddStep2Open(true);
                  }}
                >
                  Generate
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Data Modal Step 2 */}
        <Dialog open={isAddStep2Open} onOpenChange={setIsAddStep2Open}>
          <DialogContent className="max-w-[90vw] w-full">
            <DialogHeader>
              <DialogTitle>Add Data - Step 2</DialogTitle>
              <DialogDescription>
                Enter details for the {addStudentRows.length} new students.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Course</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addStudentRows.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>
                        <Input
                          value={row.name}
                          onChange={(e) =>
                            setAddStudentRows((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, name: e.target.value } : r
                              )
                            )
                          }
                          placeholder="Student name"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.email}
                          onChange={(e) =>
                            setAddStudentRows((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, email: e.target.value } : r
                              )
                            )
                          }
                          placeholder="Email address"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.studentId}
                          onChange={(e) =>
                            setAddStudentRows((rows) =>
                              rows.map((r, i) =>
                                i === idx
                                  ? { ...r, studentId: e.target.value }
                                  : r
                              )
                            )
                          }
                          placeholder="Student ID"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          value={row.password}
                          onChange={(e) =>
                            setAddStudentRows((rows) =>
                              rows.map((r, i) =>
                                i === idx
                                  ? { ...r, password: e.target.value }
                                  : r
                              )
                            )
                          }
                          placeholder="Password"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.class_id}
                          onValueChange={(v) =>
                            setAddStudentRows((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, class_id: v } : r
                              )
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((c: any) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.course_id}
                          onValueChange={(v) =>
                            setAddStudentRows((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, course_id: v } : r
                              )
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select course" />
                          </SelectTrigger>
                          <SelectContent>
                            {courses.map((c: any) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddStep2Open(false);
                  setAddStudentRows([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  console.log("[Add Students] Starting validation...");
                  console.log("[Add Students] Rows to validate:", addStudentRows);

                  if (
                    addStudentRows.some(
                      (r) =>
                        !r.name.trim() ||
                        !r.email.trim() ||
                        !r.studentId.trim() ||
                        !r.password.trim()
                    )
                  ) {
                    console.log("[Add Students] Validation failed: Missing required fields");
                    toast({
                      title: "Validation Error",
                      description:
                        "All student names, emails, student IDs, and passwords are required.",
                      variant: "destructive",
                    });
                    return;
                  }

                  console.log("[Add Students] Validation passed, sending to backend...");

                  // Send to backend
                  try {
                    const payload = {
                      students: addStudentRows.map((r) => ({
                        name: r.name,
                        email: r.email,
                        password: r.password,
                        studentId: r.studentId,
                        class_id: r.class_id,
                        course_id: r.course_id,
                        role: "student",
                        status: "active",
                      })),
                    };

                    console.log("[Add Students] Payload:", payload);

                    const res = await fetch(
                      `${API_BASE_URL}/api/students/bulk`,
                      {
                        method: "POST",
                        headers: getAuthHeaders(),
                        body: JSON.stringify(payload),
                      }
                    );

                    console.log("[Add Students] Response status:", res.status);

                    if (res.ok) {
                      const created = await res.json();
                      console.log("[Add Students] Success:", created);
                      setIsAddStep2Open(false);
                      setAddStudentRows([]);
                      toast({
                        title: "Students Added",
                        description: `${created.length} students added successfully.`,
                      });
                      handleReload();
                    } else {
                      const error = await res.json();
                      console.error("[Add Students] Backend error:", error);
                      toast({
                        title: "Error",
                        description: error.error || "Failed to add students.",
                        variant: "destructive",
                      });
                    }
                  } catch (err) {
                    console.error("[Add Students] Network error:", err);
                    toast({
                      title: "Error",
                      description: "Failed to add students.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Student Modal (multi-edit) */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-[90vw] w-full">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>
                Edit the details of the selected student(s).
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Course</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students
                    .filter((s) => selectedIds.includes(s.id))
                    .map((row, idx) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.id}</TableCell>
                        <TableCell>
                          <Input
                            value={(editRows[idx]?.name ?? row.name) || ""}
                            onChange={(e) =>
                              setEditRows((rows) => {
                                const newRows = [...rows];
                                newRows[idx] = {
                                  ...newRows[idx],
                                  name: e.target.value,
                                };
                                return newRows;
                              })
                            }
                            placeholder="Student name"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editRows[idx]?.email ?? row.email}
                            onChange={(e) =>
                              setEditRows((rows) => {
                                const newRows = [...rows];
                                newRows[idx] = {
                                  ...newRows[idx],
                                  email: e.target.value,
                                };
                                return newRows;
                              })
                            }
                            placeholder="Email address"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editRows[idx]?.studentId ?? row.student_id}
                            onChange={(e) =>
                              setEditRows((rows) => {
                                const newRows = [...rows];
                                newRows[idx] = {
                                  ...newRows[idx],
                                  studentId: e.target.value,
                                };
                                return newRows;
                              })
                            }
                            placeholder="Student ID"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="password"
                            value={editRows[idx]?.password ?? row.password}
                            onChange={(e) =>
                              setEditRows((rows) => {
                                const newRows = [...rows];
                                newRows[idx] = {
                                  ...newRows[idx],
                                  password: e.target.value,
                                };
                                return newRows;
                              })
                            }
                            placeholder="Password"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={
                              editRows[idx]?.class_id ||
                              row.class_id?.toString() ||
                              ""
                            }
                            onValueChange={(v) =>
                              setEditRows((rows) => {
                                const newRows = [...rows];
                                newRows[idx] = { ...newRows[idx], class_id: v };
                                return newRows;
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                            <SelectContent>
                              {classes.map((c: any) => (
                                <SelectItem key={c.id} value={c.id.toString()}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={
                              editRows[idx]?.course_id ||
                              row.course_id?.toString() ||
                              ""
                            }
                            onValueChange={(v) =>
                              setEditRows((rows) => {
                                const newRows = [...rows];
                                newRows[idx] = {
                                  ...newRows[idx],
                                  course_id: v,
                                };
                                return newRows;
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select course" />
                            </SelectTrigger>
                            <SelectContent>
                              {courses.map((c: any) => (
                                <SelectItem key={c.id} value={c.id.toString()}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  // Validate
                  if (
                    editRows.some(
                      (r) =>
                        !r.name ||
                        !r.name.trim() ||
                        !r.email ||
                        !r.email.trim() ||
                        !r.class_id
                    )
                  ) {
                    toast({
                      title: "Validation Error",
                      description: "All student names and emails are required.",
                      variant: "destructive",
                    });
                    return;
                  }
                  // Send to backend (bulk update)
                  try {
                    const updateData = {
                      students: editRows.map((r) => ({
                        id: r.id,
                        name: r.name,
                        email: r.email,
                        studentId: r.studentId,
                        class_id: r.class_id,
                        course_id: r.course_id,
                        role: "student",
                      })),
                    };
                    
                    console.log('Sending student update data:', updateData);
                    
                    const res = await fetch(
                      `${API_BASE_URL}/api/students/bulk`,
                      {
                        method: "PATCH", // Changed from PUT to PATCH to match backend
                        headers: getAuthHeaders(),
                        body: JSON.stringify(updateData),
                      }
                    );
                    if (res.ok) {
                      const result = await res.json();
                      toast({
                        title: "Students Updated",
                        description: `${result.results?.updated?.length || 0
                          } student(s) updated successfully.`,
                      });

                      // Show additional information if there were issues
                      if (
                        result.results?.notFound?.length > 0 ||
                        result.results?.errors?.length > 0
                      ) {
                        console.log("Update had issues:", result.results);

                        if (result.results?.notFound?.length > 0) {
                          toast({
                            title: "Warning",
                            description: `${result.results.notFound.length} student(s) not found in database.`,
                            variant: "destructive",
                          });
                        }

                        if (result.results?.errors?.length > 0) {
                          toast({
                            title: "Some Updates Failed",
                            description: `${result.results.errors.length} student(s) could not be updated due to errors.`,
                            variant: "destructive",
                          });
                        }
                      }

                      setIsEditModalOpen(false);
                      setEditRows([]);
                      handleReload();
                    } else {
                      const error = await res.json();
                      toast({
                        title: "Error",
                        description:
                          error.error || "Failed to update students.",
                        variant: "destructive",
                      });
                    }
                  } catch (err) {
                    toast({
                      title: "Error",
                      description: "Failed to update students.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={isDeleteConfirmOpen}
          onOpenChange={setIsDeleteConfirmOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the selected student(s)? This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setIsDeleteConfirmOpen(false);
                  try {
                    // Debug: Log what we're working with
                    console.log('Selected IDs before conversion:', selectedIds);
                    console.log('Selected IDs types:', selectedIds.map(id => ({ id, type: typeof id })));
                    
                    // Convert IDs to numbers like other delete operations
                    const idsToDelete = selectedIds.map(id => Number(id));
                    console.log('IDs after conversion:', idsToDelete);
                    console.log('IDs after conversion types:', idsToDelete.map(id => ({ id, type: typeof id })));
                    
                    const res = await fetch(
                      `${API_BASE_URL}/api/students/bulk-delete`,
                      {
                        method: "POST",
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ ids: idsToDelete }),
                      }
                    );
                    console.log('Delete response status:', res.status);
                    
                    if (res.ok) {
                      const result = await res.json();
                      console.log('Delete response:', result);
                      
                      // Handle detailed results like other delete operations
                      if (result.deletedCount !== undefined) {
                        if (result.constraintErrors && result.constraintErrors.length > 0) {
                          toast({
                            title: "Partial Delete",
                            description: `${result.deletedCount} student(s) deleted. ${result.constraintErrors.length} could not be deleted due to dependencies.`,
                            variant: "destructive",
                          });
                        } else {
                          toast({
                            title: "Students Deleted",
                            description: `${result.deletedCount} student(s) deleted successfully.`,
                          });
                        }
                      } else {
                        toast({
                          title: "Delete Success",
                          description: "Selected student(s) deleted.",
                        });
                      }
                      setSelectedIds([]);
                      handleReload();
                    } else {
                      const error = await res.json();
                      console.error('Delete error:', error);
                      console.error('Error details:', {
                        status: res.status,
                        statusText: res.statusText,
                        error: error
                      });
                      toast({
                        title: "Delete Failed",
                        description:
                          error.error || "Failed to delete students.",
                        variant: "destructive",
                      });
                    }
                  } catch (err) {
                    toast({
                      title: "Delete Failed",
                      description: "Failed to delete students.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Students Modal */}
        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Students</DialogTitle>
              <DialogDescription>
                Upload an Excel or CSV file with columns: Name, Email, Student ID (optional), Class (optional), Course (optional).
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div>
                <Label>File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleImportFile}
                />
              </div>
              {importError && (
                <div className="text-destructive text-sm">{importError}</div>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleImportSubmit}>Import</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default StudentsPage;
