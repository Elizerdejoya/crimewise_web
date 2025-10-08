import { useState, useEffect, useMemo, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Download,
  FileSearch,
  Trash2,
  PencilIcon,
  X,
  Search,
  MoreVertical,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { API_BASE_URL } from "@/lib/config";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const ExamResults = () => {
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [editingExam, setEditingExam] = useState<any>(null);
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

  // Fetch exam data with optimized loading
  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoading(false);
        return;
      }
      const decoded: { id: string } = jwtDecode(token);
      const instructorId = decoded.id;

      // Try to get all exams with details in a single optimized query
      let res = await fetch(`${API_BASE_URL}/api/exams?instructorId=${instructorId}&includeDetails=true`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        toast({
          title: "Authentication Error",
          description: "Please log in again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      let data;
      if (res.ok) {
        data = await res.json();
      } else {
        // Fallback to the old method if the optimized endpoint fails
        console.warn("Optimized endpoint failed, falling back to individual queries");
        res = await fetch(`${API_BASE_URL}/api/exams?instructorId=${instructorId}`, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const basicData = await res.json();
        
        // If no exams, set empty results and return
        if (!basicData || basicData.length === 0) {
          setResults([]);
          setIsLoading(false);
          return;
        }

        // Fallback: fetch details for each exam (limited concurrency)
        const BATCH_SIZE = 3;
        const examsWithDetails = [];
        const totalBatches = Math.ceil(basicData.length / BATCH_SIZE);
        
        for (let i = 0; i < basicData.length; i += BATCH_SIZE) {
          const batch = basicData.slice(i, i + BATCH_SIZE);
          const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
          
          setLoadingProgress(Math.round((currentBatch / totalBatches) * 100));
          
          const batchPromises = batch.map(async (exam: any) => {
            try {
              const detailsRes = await fetch(`${API_BASE_URL}/api/exams/results/${exam.id}`, {
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
                }
              });

              if (detailsRes.ok) {
                const details = await detailsRes.json();
                return { ...exam, ...details };
              } else {
                return { ...exam, participants: 0, avgScore: null, results: [] };
              }
            } catch (error) {
              console.error(`Error fetching details for exam ${exam.id}:`, error);
              return { ...exam, participants: 0, avgScore: null, results: [] };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          examsWithDetails.push(...batchResults);
          setResults([...examsWithDetails]);
        }

        data = examsWithDetails;
      }

      // If no exams, set empty results and return
      if (!data || data.length === 0) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      // Set results
      setResults(data);
      setLoadingProgress(100);
    } catch (error) {
      console.error("Error fetching exams:", error);
      toast({ 
        title: "Error", 
        description: "Failed to fetch exam results. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  // Debounce search term to prevent excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Filter and sort results with improved search
  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;

    // Apply search filter with better error handling
    if (debouncedSearchTerm.trim()) {
      try {
        const searchLower = debouncedSearchTerm.toLowerCase();
        filtered = results.filter((exam) => {
          // Safely check each field with null/undefined protection
          const examName = (exam.name || exam.examName || "").toString().toLowerCase();
          const className = (exam.class || exam.class_id || "").toString().toLowerCase();
          const examToken = (exam.token || "").toString().toLowerCase();
          const questionTitle = (exam.question_title || "").toString().toLowerCase();
          
          return (
            examName.includes(searchLower) ||
            className.includes(searchLower) ||
            examToken.includes(searchLower) ||
            questionTitle.includes(searchLower)
          );
        });
      } catch (error) {
        console.error("Error in search filter:", error);
        // If search fails, return all results
        filtered = results;
      }
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal, bVal;

        switch (sortColumn) {
          case "name":
            aVal = (a.name || a.examName || "").toLowerCase();
            bVal = (b.name || b.examName || "").toLowerCase();
            break;
          case "class":
            aVal = (a.class || a.class_id || "").toLowerCase();
            bVal = (b.class || b.class_id || "").toLowerCase();
            break;
          case "date":
            aVal = new Date(a.start || a.date || 0).getTime();
            bVal = new Date(b.start || b.date || 0).getTime();
            break;
          case "participants":
            aVal = a.participants || 0;
            bVal = b.participants || 0;
            break;
          case "avgScore":
            aVal = a.avgScore !== undefined ? a.avgScore : -1;
            bVal = b.avgScore !== undefined ? b.avgScore : -1;
            break;
          case "token":
            aVal = (a.token || "").toLowerCase();
            bVal = (b.token || "").toLowerCase();
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [results, debouncedSearchTerm, sortColumn, sortDirection]);

  // Filter results based on search term (keeping for backward compatibility)
  const filteredResults = useMemo(() => {
    return filteredAndSortedResults;
  }, [filteredAndSortedResults]);

  // Handle delete exam
  const handleDeleteExam = async (examId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exams/${examId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });

      if (response.status === 401) {
        toast({
          title: "Authentication Error",
          description: "Please log in again.",
          variant: "destructive",
        });
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete exam");
      }

      toast({ title: "Success", description: "Exam deleted successfully" });
      // Refetch exams or filter them out locally
      setResults(results.filter((exam) => exam.id !== examId));
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete exam", variant: "destructive" });
    }
  };

  // Handle update exam
  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingExam) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/exams/${editingExam.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          name: editingExam.name || editingExam.examName,
          duration: editingExam.duration,
          status: editingExam.status || "active"
        })
      });

      if (response.status === 401) {
        toast({
          title: "Authentication Error",
          description: "Please log in again.",
          variant: "destructive",
        });
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update exam");
      }

      toast({ title: "Success", description: "Exam updated successfully" });
      // Update the exam in local state
      setResults(results.map((exam) =>
        exam.id === editingExam.id ? { ...exam, ...editingExam } : exam
      ));
      setEditingExam(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update exam", variant: "destructive" });
    }
  };

  const handleDownloadPDF = (examId: number) => {
    const exam = results.find(r => r.id === examId);
    if (!exam) return;

    const doc = new jsPDF();

    // Add title and exam information
    doc.text(`Exam Results: ${exam.name || exam.examName}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Date: ${exam.start ? exam.start.split("T")[0] : exam.date}`, 14, 22);
    doc.text(`Class: ${exam.class || exam.class_id}`, 14, 27);
    doc.text(`Token: ${exam.token}`, 14, 32);
    doc.text(`Participants: ${exam.participants || 0}`, 14, 37);
    doc.text(`Average Score: ${exam.avgScore !== undefined ? `${exam.avgScore}` : '-'}`, 14, 42);

    // Add student results if available
    if (exam.results && Array.isArray(exam.results) && exam.results.length > 0) {
      if (exam.question_type === "forensic" && exam.answer_key) {
        // Process forensic exam results
        const tableRows = exam.results.map((res: any) => {
          let parsedAnswer = [];
          let parsedKey = [];
          let columns = [];
          try {
            parsedAnswer = JSON.parse(res.answer || "[]");
            parsedKey = JSON.parse(exam.answer_key || "[]");
            columns = parsedKey.length > 0 ? Object.keys(parsedKey[0]).filter(k => k !== 'points') : [];
          } catch { parsedAnswer = []; parsedKey = []; columns = []; }

          const raw_total = parsedKey.length * columns.length;
          let raw_score = 0;
          let totalPoints = 0;
          let earnedPoints = 0;

          parsedKey.forEach((row: any, rowIdx: number) => {
            // Get row points if available
            const rowPoints = row.points !== undefined ? Number(row.points) : 1;
            totalPoints += rowPoints;

            // Check each column for correctness
            let allCorrectForRow = true;
            columns.forEach((col: string) => {
              const studentAns = (parsedAnswer[rowIdx]?.[col] || "").toString().trim().toLowerCase();
              const correctAns = (row[col] || "").toString().trim().toLowerCase();
              if (studentAns === correctAns) {
                raw_score++;
              } else {
                allCorrectForRow = false;
              }
            });

            // Award points if all answers in the row are correct
            if (allCorrectForRow) {
              earnedPoints += rowPoints;
            }
          });

          const percent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
          return [
            res.student_name || res.student_id,
            raw_score,
            raw_total,
            `${earnedPoints}/${totalPoints}`,
            `${percent}`
          ];
        });

        autoTable(doc, {
          head: [["Student", "Raw Score", "Raw Total", "Points", "Percentage"]],
          body: tableRows,
          startY: 50,
        });
      } else {
        // Regular exam results
        autoTable(doc, {
          head: [["Student", "Score", "Date Taken"]],
          body: exam.results.map((r: any) => [
            r.student_name || r.student_id,
            r.score !== undefined ? `${r.score}/${exam.totalItemScore || exam.points || 100} (${Math.round((r.score / (exam.totalItemScore || exam.points || 100)) * 100)}%)` : '-',
            r.date || '-'
          ]),
          startY: 50,
        });
      }
    } else {
      doc.text("No results available", 14, 50);
    }

    doc.save(`exam_results_${examId}.pdf`);
    toast({ title: "PDF Exported", description: "Exam results PDF downloaded." });
  };

  const handleViewDetails = (examId: number) => {
    const exam = results.find(r => r.id === examId);
    if (!exam) return;

    const printWindow = window.open('', '', 'height=800,width=1200');
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Popup blocked. Please allow popups for this site.",
        variant: "destructive"
      });
      return;
    }

    // Generate CSS styles for the print window
    const styles = `
      body { font-family: Arial, sans-serif; margin: 20px; }
      h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
      h2 { color: #555; font-size: 20px; margin-top: 20px; margin-bottom: 10px; }
      .info-container { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
      .info-item { margin-bottom: 10px; }
      .info-label { font-weight: bold; color: #555; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
      .correct { color: green; }
      .incorrect { color: red; }
      .print-btn { 
        background-color: #4CAF50; 
        color: white; 
        padding: 10px 15px; 
        border: none;
        cursor: pointer;
        font-size: 16px;
        margin: 20px 0;
      }
      .print-btn:hover { background-color: #45a049; }
      .no-print { display: none; }
      @media print {
        .no-print { display: none; }
        button { display: none; }
        body { margin: 0; padding: 15px; }
      }
    `;

    // Format date for display
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      return dateStr.split('T')[0];
    };

    // Calculate the total item score
    const totalItemScore = exam.points ||
      (exam.question_type === "forensic" && exam.answer_key ?
        (() => {
          try {
            const parsedKey = JSON.parse(exam.answer_key || "[]");
            if (Array.isArray(parsedKey) && parsedKey.length > 0) {
              return parsedKey.reduce((sum: number, row: any) =>
                sum + (Number(row.points) || 1), 0);
            }
            return '-';
          } catch {
            return '-';
          }
        })() : '-');

    // Start writing HTML content
    printWindow.document.write(`
      <html>
        <head>
          <title>Exam Results: ${exam.name || 'Exam Details'}</title>
          <style>${styles}</style>
        </head>
        <body>
          <h1>Exam Results: ${exam.name || exam.examName || 'Untitled Exam'}</h1>
          
          <div class="info-container">
            <div class="info-item">
              <span class="info-label">Date:</span> 
              ${formatDate(exam.start || exam.date)}
            </div>
            <div class="info-item">
              <span class="info-label">Class:</span> 
              ${exam.class || exam.class_id || '-'}
            </div>
            <div class="info-item">
              <span class="info-label">Duration:</span> 
              ${exam.duration || '-'}
            </div>
            <div class="info-item">
              <span class="info-label">Token:</span> 
              <span style="font-family: monospace;">${exam.token || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Participants:</span> 
              ${exam.participants || 0}
            </div>
            <div class="info-item">
              <span class="info-label">Average Score:</span> 
              ${exam.avgScore !== undefined ? `${exam.avgScore}` : '-'}
            </div>
            <div class="info-item">
              <span class="info-label">Total Item Score:</span> 
              ${totalItemScore}
            </div>
            <div class="info-item">
              <span class="info-label">Question Title:</span> 
              ${exam.question_title || '-'}
            </div>
          </div>
    `);

    // Add question text if available
    if (exam.question_text) {
      printWindow.document.write(`
        <h2>Question</h2>
        <p>${exam.question_text}</p>
      `);
    }

    // Add student results if available
    if (exam.results && Array.isArray(exam.results) && exam.results.length > 0) {
      printWindow.document.write(`
        <h2>Student Results</h2>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Score</th>
              <th>Date Taken</th>
              <th>Tab Switches</th>
              ${exam.question_type === 'forensic' ? '<th>Raw Score</th><th>Raw Total</th><th>Conclusion</th>' : ''}
            </tr>
          </thead>
          <tbody>
      `);

      // Process and display each student's results
      exam.results.forEach((res: any) => {
        let rawScore = '';
        let rawTotal = '';

        // Calculate raw scores for forensic questions
        if (exam.question_type === 'forensic' && exam.answer_key) {
          let parsedAnswer = [];
          let parsedKey = [];
          let columns = [];

          try {
            parsedAnswer = JSON.parse(res.answer || "[]");
            parsedKey = JSON.parse(exam.answer_key || "[]");
            columns = parsedKey.length > 0 ? Object.keys(parsedKey[0]).filter(k => k !== 'points') : [];
          } catch { parsedAnswer = []; parsedKey = []; columns = []; }

          let correctCount = 0;
          let totalCount = 0;

          parsedKey.forEach((row: any, rowIdx: number) => {
            columns.forEach((col: string) => {
              totalCount++;
              const studentAns = (parsedAnswer[rowIdx]?.[col] || "").toString().trim().toLowerCase();
              const correctAns = (row[col] || "").toString().trim().toLowerCase();
              if (studentAns === correctAns) {
                correctCount++;
              }
            });
          });

          rawScore = correctCount.toString();
          rawTotal = totalCount.toString();
        }

        printWindow.document.write(`
          <tr>
            <td>${res.student_name || res.student_id}</td>
            <td>${res.score !== undefined ? `${res.score}/${exam.totalItemScore || exam.points || 100} (${Math.round((res.score / (exam.totalItemScore || exam.points || 100)) * 100)}%)` : '-'}</td>
            <td>${formatDate(res.date)}</td>
            <td>${res.tab_switches !== undefined ? res.tab_switches : '-'}</td>
            ${exam.question_type === 'forensic' ? `<td>${rawScore}</td><td>${rawTotal}</td>` : ''}
            ${exam.question_type === 'forensic' ? (() => {
            // Get student's conclusion from their answer
            let studentConclusion = '';
            let expectedConclusion = '';
            try {
              const parsed = JSON.parse(res.answer || "{}");
              if (parsed.conclusion) {
                studentConclusion = parsed.conclusion;
              }

              const parsedKey = JSON.parse(exam.answer_key || "{}");
              if (parsedKey.explanation && parsedKey.explanation.conclusion) {
                expectedConclusion = parsedKey.explanation.conclusion;
              }
            } catch (e) { /* ignore */ }

            const conclusionMatch = studentConclusion && expectedConclusion && studentConclusion === expectedConclusion;
            const conclusionStyle = conclusionMatch ? 'color: green;' : (studentConclusion && expectedConclusion ? 'color: red;' : '');

            return `<td style="${conclusionStyle}">${studentConclusion ? `${studentConclusion.charAt(0).toUpperCase() + studentConclusion.slice(1)} ${conclusionMatch ? '✓' : (expectedConclusion ? '✗' : '')}` : '-'}</td>`;
          })() : ''}
          </tr>
        `);
      });

      printWindow.document.write(`
          </tbody>
        </table>
      `);
    } else {
      printWindow.document.write('<p>No student results available.</p>');
    }

    // Add detailed forensic answer breakdown if available
    if (exam.question_type === 'forensic' && exam.results && exam.results.length > 0 && exam.answer_key) {
      const firstResult = exam.results[0];
      let parsedKey = [];
      try {
        parsedKey = JSON.parse(exam.answer_key || "[]");
      } catch { parsedKey = []; }

      if (parsedKey.length > 0) {
        printWindow.document.write(`
          <h2>Forensic Question Details</h2>
          <p>Question requires students to identify characteristics about specimens.</p>
        `);

        // Determine if we have points per row
        const hasPointsPerRow = 'points' in parsedKey[0];
        const columns = Object.keys(parsedKey[0]).filter(k => k !== 'points');

        printWindow.document.write(`
          <table>
            <thead>
              <tr>
                <th>Row #</th>
                ${columns.map(col => `<th>${col.replace(/([A-Z])/g, ' $1')}</th>`).join('')}
                ${hasPointsPerRow ? '<th>Points Value</th>' : ''}
              </tr>
            </thead>
            <tbody>
        `);

        parsedKey.forEach((row: any, idx: number) => {
          printWindow.document.write(`
            <tr>
              <td>${idx + 1}</td>
              ${columns.map(col => `<td>${row[col] || ''}</td>`).join('')}
              ${hasPointsPerRow ? `<td>${row.points || 1}</td>` : ''}
            </tr>
          `);
        });

        printWindow.document.write(`
            </tbody>
          </table>
        `);
      }
    }

    // Finish the HTML document
    printWindow.document.write(`
          <button class="print-btn" onclick="window.print();">Print Report</button>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  // Format date for table display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return dateStr.split("T")[0];
  };

  // Sortable header component
  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => {
    const isSorted = sortColumn === column;
    const isAsc = isSorted && sortDirection === "asc";
    const isDesc = isSorted && sortDirection === "desc";

    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center justify-between">
          <span>{children}</span>
          <div className="flex flex-col ml-1">
            <ChevronUp
              className={`h-3 w-3 ${isAsc ? 'text-primary' : 'text-muted-foreground/50'}`}
            />
            <ChevronDown
              className={`h-3 w-3 -mt-1 ${isDesc ? 'text-primary' : 'text-muted-foreground/50'}`}
            />
          </div>
        </div>
      </TableHead>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Exam Results</h2>
            <p className="text-muted-foreground">
              View and analyze your examination results
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search exams..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => {
                try {
                  setSearchTerm(e.target.value);
                } catch (error) {
                  console.error("Error updating search term:", error);
                }
              }}
              onKeyDown={(e) => {
                // Prevent form submission on Enter
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Table View */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader column="name">Exam Name</SortableHeader>
                  <SortableHeader column="class">Class</SortableHeader>
                  <SortableHeader column="date">Date</SortableHeader>
                  <SortableHeader column="participants">Participants</SortableHeader>
                  <SortableHeader column="avgScore">Avg Score</SortableHeader>
                  <SortableHeader column="token">Token</SortableHeader>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <div className="space-y-4">
                        <div>Loading exam data...</div>
                        {loadingProgress > 0 && (
                          <div className="w-full max-w-md mx-auto">
                            <Progress value={loadingProgress} className="w-full" />
                            <div className="text-sm text-muted-foreground mt-2">
                              {loadingProgress}% complete
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      {searchTerm ? "No matching exams found" : "No exams available"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResults.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.name || exam.examName || "Untitled Exam"}</TableCell>
                      <TableCell>{exam.class || exam.class_id || "-"}</TableCell>
                      <TableCell>{formatDate(exam.start || exam.date)}</TableCell>
                      <TableCell>{exam.participants || 0}</TableCell>
                      <TableCell>{exam.avgScore !== undefined && exam.avgScore !== null ? `${exam.avgScore}` : '-'}</TableCell>
                      <TableCell><span className="font-mono">{exam.token}</span></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleViewDetails(exam.id)}>
                              <FileSearch className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPDF(exam.id)}>
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditingExam(exam)}>
                              <PencilIcon className="mr-2 h-4 w-4" />
                              Edit Exam
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setSelectedExam(exam)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Exam
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Exam Dialog */}
        {editingExam && (
          <Dialog open={!!editingExam} onOpenChange={(open) => !open && setEditingExam(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Exam</DialogTitle>
                <DialogDescription>
                  Make changes to the exam information below.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateExam}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="exam-name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="exam-name"
                      value={editingExam.name || editingExam.examName || ""}
                      onChange={(e) => setEditingExam({ ...editingExam, name: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="exam-duration" className="text-right">
                      Duration (min)
                    </Label>
                    <Input
                      id="exam-duration"
                      type="number"
                      value={editingExam.duration || ""}
                      onChange={(e) => setEditingExam({ ...editingExam, duration: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="exam-status" className="text-right">
                      Status
                    </Label>
                    <select
                      id="exam-status"
                      value={editingExam.status || "active"}
                      onChange={(e) => setEditingExam({ ...editingExam, status: e.target.value })}
                      className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit">Save Changes</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Confirmation Dialog */}
        {selectedExam && (
          <AlertDialog open={!!selectedExam} onOpenChange={(open) => !open && setSelectedExam(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the exam "{selectedExam.name || selectedExam.examName}" and all associated results.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    handleDeleteExam(selectedExam.id);
                    setSelectedExam(null);
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ExamResults;
