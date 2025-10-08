import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { JwtTokenPayload } from "@/lib/types";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Eye, ArrowUpDown, ArrowUp, ArrowDown, FileText, Tags } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// Helper function to create auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const Results = () => {
  const [results, setResults] = useState<any[]>([]);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const decoded: JwtTokenPayload = jwtDecode(token);
    const studentId = decoded.id;

    fetch(`${API_BASE_URL}/api/exams/student/${studentId}/results`, {
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
        const resultsData = Array.isArray(data) ? data : [];
        setResults(resultsData);
        setFilteredResults(resultsData);
      })
      .catch(err => {
        console.error('Error fetching results:', err);
        toast({
          title: "Error",
          description: "Failed to fetch exam results.",
          variant: "destructive",
        });
      });
  }, []);

  // Helper function to safely call trim on a value
  const safeString = (value: any): string => {
    if (value === null || value === undefined) return "";
    return typeof value === 'string' ? value : String(value);
  };

  // Search function
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    if (term.trim() === "") {
      setFilteredResults(results);
    } else {
      const filtered = results.filter(result => {
        const examName = (result.examName || result.exam_id || "").toString().toLowerCase();
        const course = (result.course || result.course_id || "").toString().toLowerCase();
        const date = (result.date || "").toString().toLowerCase();
        const score = (result.score || "").toString().toLowerCase();
        
        return examName.includes(term) || 
               course.includes(term) || 
               date.includes(term) ||
               score.includes(term);
      });
      setFilteredResults(filtered);
    }
  };

  // Sort function
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get sort icon
  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  // Print individual exam result
  const handlePrintExam = (result: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the exam result.');
      return;
    }

    // Generate detailed exam content
    let examContent = `
      <div class="exam-header">
        <h1>Exam Result: ${result.examName}</h1>
        <div class="exam-info">
          <p><strong>Course:</strong> ${result.course}</p>
          <p><strong>Date:</strong> ${result.date}</p>
          <p><strong>Score:</strong> ${result.question_type === "forensic" && result.totalPoints > 0
        ? `${result.earnedPoints}/${result.totalPoints} pts (${result.score}%) | Raw: ${result.raw_score}/${result.raw_total}`
        : result.raw_score !== undefined && result.raw_total !== undefined
          ? `${result.raw_score}/${result.raw_total} (${result.score}%)`
          : (result.score !== undefined ? `${result.score}%` : "-")}</p>
          <p><strong>Grade:</strong> ${result.score >= 90 ? 'A' : result.score >= 80 ? 'B' : result.score >= 70 ? 'C' : result.score >= 60 ? 'D' : 'F'}</p>
        </div>
      </div>
    `;

    // Add keyword pool information if available
    if (result.keyword_pool_name && result.keyword_pool_keywords) {
      try {
        const keywords = typeof result.keyword_pool_keywords === 'string'
          ? JSON.parse(result.keyword_pool_keywords)
          : result.keyword_pool_keywords;
        
        // If selected_keywords exist, show only those; otherwise show all keywords
        const keywordsToShow = result.selected_keywords ? (() => {
          try {
            return typeof result.selected_keywords === 'string'
              ? JSON.parse(result.selected_keywords)
              : result.selected_keywords;
          } catch (e) {
            return keywords;
          }
        })() : keywords;
        
        const keywordTags = Array.isArray(keywordsToShow) 
          ? keywordsToShow.map(keyword => `<span style="display: inline-block; padding: 2px 8px; margin: 2px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; font-size: 11px;">${keyword}</span>`).join('')
          : '';
        
        examContent += `
          <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">Available Keywords: ${result.keyword_pool_name}</h3>
            ${result.keyword_pool_description ? `<p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280;">${result.keyword_pool_description}</p>` : ''}
            <div style="margin-top: 8px;">
              ${keywordTags}
            </div>
          </div>
        `;
      } catch (e) {
        console.error('Error parsing keywords for print:', e);
      }
    }

    // Add detailed answers for forensic questions
    if (result.question_type === "forensic" && result.answer && result.answer_key) {
      try {
        let parsedAnswer = [];
        let parsedKey = [];
        let columns = [];

        // Parse the data
        const rawAnswer = JSON.parse(result.answer);
        parsedAnswer = rawAnswer.tableAnswers || rawAnswer;

        const rawKey = JSON.parse(result.answer_key);
        if (rawKey.specimens && Array.isArray(rawKey.specimens)) {
          parsedKey = rawKey.specimens;
        } else if (Array.isArray(rawKey)) {
          parsedKey = rawKey;
        }

        columns = parsedKey.length > 0
          ? Object.keys(parsedKey[0]).filter(k => !['points', 'id', 'rowId'].includes(k))
          : [];

        if (columns.length > 0) {
          examContent += `
            <div class="answers-section">
              <h2>Answer Details</h2>
              <table class="answers-table">
                <thead>
                  <tr>
                    <th>#</th>
                    ${columns.map(col => `<th>${col}</th>`).join('')}
                    <th>Result/Points</th>
                  </tr>
                </thead>
                <tbody>
          `;

          parsedKey.forEach((row: any, rowIdx: number) => {
            let rowCorrectCount = 0;
            let allCorrectForRow = true;
            const rowPoints = row.points !== undefined ? Number(row.points) : 1;

            examContent += `<tr><td>${rowIdx + 1}</td>`;

            columns.forEach((col) => {
              const studentAns = (parsedAnswer[rowIdx]?.[col] || "").toString();
              const correctAns = (row[col] || "").toString();
              const isCorrect = studentAns.trim().toLowerCase() === correctAns.trim().toLowerCase();

              if (isCorrect) {
                rowCorrectCount++;
              } else {
                allCorrectForRow = false;
              }

              examContent += `
                <td class="${isCorrect ? 'correct' : 'incorrect'}">
                  <div>
                    <span>${studentAns}</span>
                    <span class="indicator">${isCorrect ? '✓' : '✗'}</span>
                    ${!isCorrect ? `<br><small>Correct: ${correctAns}</small>` : ''}
                  </div>
                </td>
              `;
            });

            examContent += `
              <td class="${allCorrectForRow ? 'correct' : 'incorrect'}">
                ${rowCorrectCount}/${columns.length}<br>
                <small>${allCorrectForRow ? `+${rowPoints} pts` : `0/${rowPoints} pts`}</small>
              </td>
            </tr>`;
          });

          examContent += `</tbody></table>`;

          // Add scoring summary
          examContent += `
            <div class="scoring-summary">
              <h3>Scoring Summary</h3>
              <div class="summary-grid">
                <div><strong>Raw Score:</strong> ${result.raw_score}/${result.raw_total}</div>
                ${result.totalPoints > 0 ? `<div><strong>Points:</strong> ${result.earnedPoints}/${result.totalPoints}</div>` : ''}
                <div><strong>Percentage:</strong> ${result.score}%</div>
                <div><strong>Grade:</strong> ${result.score >= 90 ? 'A' : result.score >= 80 ? 'B' : result.score >= 70 ? 'C' : result.score >= 60 ? 'D' : 'F'}</div>
              </div>
            </div>
          `;
        }

        // Add conclusion section
        let studentConclusion = "";
        let expectedConclusion = "";

        if (rawAnswer.conclusion) {
          studentConclusion = rawAnswer.conclusion;
        }

        if (rawKey.explanation && rawKey.explanation.conclusion) {
          expectedConclusion = rawKey.explanation.conclusion;
        }

        if (studentConclusion || expectedConclusion) {
          const conclusionMatch = studentConclusion && expectedConclusion && studentConclusion === expectedConclusion;
          examContent += `
            <div class="conclusion-section">
              <h3>Forensic Conclusion</h3>
              ${studentConclusion ? `
                <div class="conclusion-item">
                  <strong>Your Conclusion:</strong> 
                  <span class="${conclusionMatch ? 'correct' : (expectedConclusion ? 'incorrect' : '')}">${studentConclusion.charAt(0).toUpperCase() + studentConclusion.slice(1)} Specimen ${conclusionMatch ? '✓' : (expectedConclusion ? '✗' : '')}</span>
                </div>
              ` : ''}
              ${expectedConclusion ? `
                <div class="conclusion-item">
                  <strong>Expected Conclusion:</strong> 
                  <span>${expectedConclusion.charAt(0).toUpperCase() + expectedConclusion.slice(1)} Specimen</span>
                </div>
              ` : ''}
            </div>
          `;
        }

        // Add explanation section
        let explanation = "";
        if (typeof rawAnswer === 'object' && rawAnswer.explanation) {
          explanation = rawAnswer.explanation;
        }

        if (explanation) {
          examContent += `
            <div class="explanation-section">
              <h3>Your Explanation</h3>
              <div class="explanation-text">${explanation}</div>
            </div>
          `;
        }

      } catch (e) {
        examContent += `<p>Unable to parse detailed answer data.</p>`;
      }
    }

    if (result.feedback) {
      examContent += `
        <div class="feedback-section">
          <h3>Feedback</h3>
          <p>${result.feedback}</p>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Exam Result: ${result.examName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
            .exam-header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
            .exam-header h1 { margin: 0 0 15px 0; color: #333; }
            .exam-info p { margin: 5px 0; }
            .answers-section { margin: 30px 0; }
            .answers-section h2 { color: #333; margin-bottom: 15px; }
            .answers-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .answers-table th, .answers-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .answers-table th { background-color: #f2f2f2; font-weight: bold; }
            .correct { background-color: #d4edda; color: #155724; }
            .incorrect { background-color: #f8d7da; color: #721c24; }
            .indicator { font-weight: bold; margin-left: 5px; }
            .scoring-summary { margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
            .scoring-summary h3 { margin: 0 0 10px 0; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
            .conclusion-section, .explanation-section, .feedback-section { margin: 25px 0; }
            .conclusion-section h3, .explanation-section h3, .feedback-section h3 { color: #333; margin-bottom: 10px; }
            .conclusion-item { margin: 10px 0; }
            .explanation-text { background-color: #f8f9fa; padding: 15px; border-radius: 5px; white-space: pre-wrap; }
            small { font-size: 0.8em; color: #666; }
            @media print {
              body { margin: 0; padding: 15px; }
              .exam-header { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          ${examContent}
          <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
            Printed on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };


  // Process results for display with sorting
  const processedResults = [...filteredResults].map(result => {
    // Compute raw_score, raw_total, and points-based scoring for forensic if not present
    let raw_score = result.raw_score;
    let raw_total = result.raw_total;
    let totalPoints = 0;
    let earnedPoints = 0;

    if (result.question_type === "forensic" && result.answer && result.answer_key) {
      let parsedAnswer = [];
      let parsedKey = [];
      let columns = [];

      try {
        console.log("Raw answer:", result.answer);
        console.log("Raw answer key:", result.answer_key);

        // Parse answer - handle the nested structure
        if (result.answer) {
          const rawAnswer = JSON.parse(result.answer);
          // Check if answer has tableAnswers property (from TakeExam.tsx)
          parsedAnswer = rawAnswer.tableAnswers || rawAnswer;
          console.log("Parsed answer:", parsedAnswer);
        }

        // Parse answer key - normalize the structure
        if (result.answer_key) {
          const rawKey = JSON.parse(result.answer_key);
          // Check if answer_key has specimens property (new format)
          if (rawKey.specimens && Array.isArray(rawKey.specimens)) {
            parsedKey = rawKey.specimens;
          } else if (Array.isArray(rawKey)) {
            parsedKey = rawKey;
          } else {
            parsedKey = [];
          }
          console.log("Parsed key:", parsedKey);
        }

        // Ensure parsedKey is an array
        if (!Array.isArray(parsedKey)) {
          parsedKey = [];
          console.error("parsedKey is not an array after parsing");
        }

        // Get columns but exclude any metadata fields
        columns = parsedKey.length > 0
          ? Object.keys(parsedKey[0]).filter(k => !['points', 'id', 'rowId'].includes(k))
          : [];
        console.log("Columns:", columns);
      } catch (e) {
        console.error("Error parsing results:", e);
        parsedAnswer = [];
        parsedKey = [];
        columns = [];
      }

      raw_total = parsedKey.length * columns.length;
      raw_score = 0;

      // Calculate scores using same logic as instructor views
      if (Array.isArray(parsedKey)) {
        parsedKey.forEach((row: any, rowIdx: number) => {
          // Get row points if available
          const rowPoints = row.points !== undefined ? Number(row.points) : 1;
          totalPoints += rowPoints;

          // Check each column for correctness
          let allCorrectForRow = true;
          columns.forEach((col: string) => {
            const studentAns = safeString(parsedAnswer[rowIdx]?.[col]);
            const correctAns = safeString(row[col]);
            if (studentAns.trim().toLowerCase() === correctAns.trim().toLowerCase()) {
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
      }
    }

    // Calculate percentage score using points system if available, otherwise raw score
    let score = result.score;
    if (totalPoints > 0) {
      score = Math.round((earnedPoints / totalPoints) * 100);
    } else if (raw_score !== undefined && raw_total !== undefined) {
      score = raw_total > 0 ? Math.round((raw_score / raw_total) * 100) : 0;
    }

    return {
      ...result,
      raw_score,
      raw_total,
      totalPoints,
      earnedPoints,
      score,
      examName: result.examName || result.exam_id,
      course: result.course || result.course_id,
    };
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    
    const { key, direction } = sortConfig;
    let aValue: any;
    let bValue: any;
    
    switch (key) {
      case 'examName':
        aValue = a.examName?.toLowerCase() || '';
        bValue = b.examName?.toLowerCase() || '';
        break;
      case 'course':
        aValue = a.course?.toLowerCase() || '';
        bValue = b.course?.toLowerCase() || '';
        break;
      case 'date':
        aValue = new Date(a.date || 0);
        bValue = new Date(b.date || 0);
        break;
      case 'score':
        aValue = a.score || 0;
        bValue = b.score || 0;
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) {
      return direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Results</h2>
          <p className="text-muted-foreground">
            View and analyze your exam performance
          </p>
        </div>

        <div className="flex items-center mb-4">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by exam name, course, or date..."
            value={searchTerm}
            onChange={handleSearch}
            className="max-w-sm"
          />
        </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('examName')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Exam
                      {getSortIcon('examName')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('course')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Course
                      {getSortIcon('course')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('date')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Date
                      {getSortIcon('date')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('score')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Score
                      {getSortIcon('score')}
                    </Button>
                  </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedResults.length > 0 ? (
                    processedResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{result.examName}</TableCell>
                        <TableCell>{result.course}</TableCell>
                        <TableCell>{result.date}</TableCell>
                        <TableCell>
                          {result.question_type === "forensic" && result.totalPoints > 0
                            ? `${result.earnedPoints}/${result.totalPoints} pts (${result.score}%) | Raw: ${result.raw_score}/${result.raw_total}`
                            : result.raw_score !== undefined && result.raw_total !== undefined
                              ? `${result.raw_score}/${result.raw_total} (${result.score}%)`
                              : (result.score !== undefined ? `${result.score}%` : "-")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {result.answer && result.answer_key && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedResult(result)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" /> View Details
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[95vw] max-h-[90vh] w-full overflow-hidden flex flex-col">
                                  <DialogHeader className="flex-shrink-0">
                                    <DialogTitle>Exam Results: {result.examName}</DialogTitle>
                                  </DialogHeader>
                                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                      <div>
                                        <p className="text-sm font-medium">Course</p>
                                        <p className="text-sm break-words">{result.course}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">Date</p>
                                        <p className="text-sm">{result.date}</p>
                                      </div>
                                      <div className="sm:col-span-2 lg:col-span-1">
                                        <p className="text-sm font-medium">Score</p>
                                        <p className="text-sm break-words">
                                          {result.question_type === "forensic" && result.totalPoints > 0
                                            ? `${result.earnedPoints}/${result.totalPoints} pts (${result.score}%) | Raw: ${result.raw_score}/${result.raw_total}`
                                            : result.raw_score !== undefined && result.raw_total !== undefined
                                              ? `${result.raw_score}/${result.raw_total} (${result.score}%)`
                                              : (result.score !== undefined ? `${result.score}%` : "-")}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Keyword Pool Display */}
                                    {result.keyword_pool_name && result.keyword_pool_keywords && (
                                      <div className="bg-gray-50 border rounded-lg p-4">
                                        <div className="mb-2">
                                          <p className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-1">
                                            <Tags className="h-4 w-4" />
                                            Available Keywords: {result.keyword_pool_name}
                                          </p>
                                          {result.keyword_pool_description && (
                                            <p className="text-xs text-gray-600 mb-2">
                                              {result.keyword_pool_description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {(() => {
                                            try {
                                              const keywords = typeof result.keyword_pool_keywords === 'string'
                                                ? JSON.parse(result.keyword_pool_keywords)
                                                : result.keyword_pool_keywords;
                                              
                                              // If selected_keywords exist, show only those; otherwise show all keywords
                                              const keywordsToShow = result.selected_keywords ? (() => {
                                                try {
                                                  return typeof result.selected_keywords === 'string'
                                                    ? JSON.parse(result.selected_keywords)
                                                    : result.selected_keywords;
                                                } catch (e) {
                                                  console.error('Error parsing selected keywords:', e);
                                                  return keywords;
                                                }
                                              })() : keywords;
                                              
                                              return Array.isArray(keywordsToShow) ? keywordsToShow.map((keyword: string, index: number) => (
                                                <span
                                                  key={index}
                                                  className="inline-block px-2 py-1 text-xs bg-white border border-gray-300 rounded-md text-gray-700"
                                                >
                                                  {keyword}
                                                </span>
                                              )) : [];
                                            } catch (e) {
                                              console.error('Error parsing keywords:', e);
                                              return [];
                                            }
                                          })()}
                                        </div>
                                      </div>
                                    )}

                                    {result.feedback && (
                                      <div>
                                        <p className="text-sm font-medium">Feedback</p>
                                        <p className="text-sm text-muted-foreground">{result.feedback}</p>
                                      </div>
                                    )}

                                    {(() => {
                                      let parsedAnswer = [];
                                      let parsedKey = [];
                                      let columns = [];

                                      try {
                                        console.log("Raw answer:", result.answer);
                                        console.log("Raw answer key:", result.answer_key);

                                        // Parse answer - handle the nested structure
                                        if (result.answer) {
                                          const rawAnswer = JSON.parse(result.answer);
                                          // Check if answer has tableAnswers property (from TakeExam.tsx)
                                          parsedAnswer = rawAnswer.tableAnswers || rawAnswer;
                                          console.log("Parsed answer:", parsedAnswer);
                                        }

                                        // Parse answer key - normalize the structure
                                        if (result.answer_key) {
                                          const rawKey = JSON.parse(result.answer_key);
                                          // Check if answer_key has specimens property (new format)
                                          if (rawKey.specimens && Array.isArray(rawKey.specimens)) {
                                            parsedKey = rawKey.specimens;
                                          } else if (Array.isArray(rawKey)) {
                                            parsedKey = rawKey;
                                          } else {
                                            parsedKey = [];
                                          }
                                          console.log("Parsed key:", parsedKey);
                                        }

                                        // Ensure parsedKey is an array
                                        if (!Array.isArray(parsedKey)) {
                                          parsedKey = [];
                                          console.error("parsedKey is not an array after parsing");
                                        }

                                        // Get columns but exclude any metadata fields
                                        columns = parsedKey.length > 0
                                          ? Object.keys(parsedKey[0]).filter(k => !['points', 'id', 'rowId'].includes(k))
                                          : [];
                                        console.log("Columns:", columns);
                                      } catch (e) {
                                        console.error("Error parsing results:", e);
                                        parsedAnswer = [];
                                        parsedKey = [];
                                        columns = [];
                                      }

                                      return columns.length > 0 ? (
                                        <div className="space-y-4">
                                          <h3 className="text-lg font-medium mt-4">Answer Table</h3>
                                          <div className="overflow-x-auto border rounded-lg">
                                            <Table className="min-w-full">
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="min-w-[50px] sticky left-0 bg-background z-10">#</TableHead>
                                                  {columns.map((col, idx) => (
                                                    <TableHead key={idx} className="min-w-[120px] whitespace-nowrap">{col}</TableHead>
                                                  ))}
                                                  <TableHead className="min-w-[100px] whitespace-nowrap">Result/Points</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {parsedKey.map((row: any, rowIdx: number) => {
                                                  // Count correct answers in this row
                                                  let rowCorrectCount = 0;
                                                  let rowTotalCount = columns.length;
                                                  let allCorrectForRow = true;

                                                  // Get row points
                                                  const rowPoints = row.points !== undefined ? Number(row.points) : 1;

                                                  columns.forEach((col) => {
                                                    const studentAns = safeString(parsedAnswer[rowIdx]?.[col]);
                                                    const correctAns = safeString(row[col]);
                                                    if (studentAns.trim().toLowerCase() === correctAns.trim().toLowerCase()) {
                                                      rowCorrectCount++;
                                                    } else {
                                                      allCorrectForRow = false;
                                                    }
                                                  });

                                                  return (
                                                    <TableRow key={rowIdx}>
                                                      <TableCell className="sticky left-0 bg-background z-10 font-medium">{rowIdx + 1}</TableCell>
                                                      {columns.map((col, colIdx) => {
                                                        const studentAns = safeString(parsedAnswer[rowIdx]?.[col]);
                                                        const correctAns = safeString(row[col]);
                                                        const isCorrect = studentAns.trim().toLowerCase() === correctAns.trim().toLowerCase();

                                                        return (
                                                          <TableCell key={colIdx} className={`min-w-[120px] ${isCorrect ? "bg-green-50" : "bg-red-50"}`}>
                                                            <div className="flex flex-col space-y-1">
                                                              <div className="flex items-center flex-wrap">
                                                                <span className={`text-sm font-medium break-words ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                                                                  {studentAns}
                                                                </span>
                                                                <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                                                                  {isCorrect ?
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                    :
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                  }
                                                                </span>
                                                              </div>
                                                              {!isCorrect && (
                                                                <span className="text-xs text-muted-foreground break-words">
                                                                  Correct: {correctAns}
                                                                </span>
                                                              )}
                                                            </div>
                                                          </TableCell>
                                                        );
                                                      })}
                                                      <TableCell className="min-w-[100px]">
                                                        <div className="flex flex-col space-y-1">
                                                          <span className={`text-sm font-semibold ${allCorrectForRow ? "text-green-600" : "text-red-600"}`}>
                                                            {rowCorrectCount}/{rowTotalCount}
                                                          </span>
                                                          <span className="text-xs text-muted-foreground">
                                                            {allCorrectForRow ? `+${rowPoints} pts` : `0/${rowPoints} pts`}
                                                          </span>
                                                        </div>
                                                      </TableCell>
                                                    </TableRow>
                                                  );
                                                })}
                                              </TableBody>
                                            </Table>
                                          </div>

                                          {/* Summary Section */}
                                          <div className="mt-4 p-3 sm:p-4 bg-gray-50 rounded-md">
                                            <h4 className="text-sm font-medium mb-3">Scoring Summary</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm">
                                              <div className="flex flex-col">
                                                <span className="text-muted-foreground text-xs">Raw Score:</span>
                                                <div className="font-semibold text-sm">{result.raw_score}/{result.raw_total}</div>
                                              </div>
                                              {result.totalPoints > 0 && (
                                                <div className="flex flex-col">
                                                  <span className="text-muted-foreground text-xs">Points:</span>
                                                  <div className="font-semibold text-sm">{result.earnedPoints}/{result.totalPoints}</div>
                                                </div>
                                              )}
                                              <div className="flex flex-col">
                                                <span className="text-muted-foreground text-xs">Percentage:</span>
                                                <div className="font-semibold text-sm">{result.score}%</div>
                                              </div>
                                              <div className="flex flex-col">
                                                <span className="text-muted-foreground text-xs">Grade:</span>
                                                <div className={`font-semibold text-sm ${result.score >= 80 ? 'text-green-600' : result.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                  {result.score >= 90 ? 'A' : result.score >= 80 ? 'B' : result.score >= 70 ? 'C' : result.score >= 60 ? 'D' : 'F'}
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Forensic Conclusion Section */}
                                          {(() => {
                                            let studentConclusion = "";
                                            let expectedConclusion = "";

                                            try {
                                              // Get student's conclusion from their answer
                                              const parsed = JSON.parse(result.answer || "{}");
                                              if (parsed.conclusion) {
                                                studentConclusion = parsed.conclusion;
                                              }

                                              // Get expected conclusion from answer key
                                              const parsedKey = JSON.parse(result.answer_key || "{}");
                                              if (parsedKey.explanation && parsedKey.explanation.conclusion) {
                                                expectedConclusion = parsedKey.explanation.conclusion;
                                              }
                                            } catch (e) {
                                              console.error("Error parsing conclusion data:", e);
                                            }

                                            return (studentConclusion || expectedConclusion) ? (
                                              <div className="mt-6 pt-3 border-t">
                                                <h3 className="text-lg font-medium">Forensic Conclusion</h3>
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                                                  {studentConclusion && (
                                                    <div>
                                                      <h4 className="text-sm font-medium mb-2">Your Conclusion</h4>
                                                      <div className={`p-3 rounded-md ${expectedConclusion && studentConclusion === expectedConclusion
                                                        ? 'bg-green-50 border border-green-200'
                                                        : expectedConclusion && studentConclusion !== expectedConclusion
                                                          ? 'bg-red-50 border border-red-200'
                                                          : 'bg-gray-50'
                                                        }`}>
                                                        <div className="flex items-center flex-wrap">
                                                          <span className="capitalize font-medium break-words">
                                                            {studentConclusion} Specimen
                                                          </span>
                                                          {expectedConclusion && (
                                                            <span className={`ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 ${studentConclusion === expectedConclusion ? 'bg-green-100' : 'bg-red-100'
                                                              }`}>
                                                              {studentConclusion === expectedConclusion ?
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                :
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                              }
                                                            </span>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {expectedConclusion && (
                                                    <div>
                                                      <h4 className="text-sm font-medium mb-2">Expected Conclusion</h4>
                                                      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                                                        <span className="capitalize font-medium break-words">
                                                          {expectedConclusion} Specimen
                                                        </span>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ) : null;
                                          })()}

                                          {/* Explanation Section */}
                                          {(() => {
                                            let explanation = "";
                                            try {
                                              const parsed = JSON.parse(result.answer || "{}");
                                              console.log("Parsing explanation from:", parsed);

                                              // Handle different formats of explanation storage
                                              if (typeof parsed === 'object') {
                                                // Direct explanation property
                                                if (typeof parsed.explanation === 'string') {
                                                  explanation = parsed.explanation;
                                                }
                                                // Explanation in tableAnswers structure
                                                else if (parsed.tableAnswers && typeof parsed.explanation === 'string') {
                                                  explanation = parsed.explanation;
                                                }
                                                // Explanation stored directly in the result object
                                                else if (result.explanation) {
                                                  explanation = result.explanation;
                                                }
                                              }

                                              console.log("Extracted explanation:", explanation);
                                            } catch (e) {
                                              console.error("Error parsing explanation:", e);
                                              // If parsing fails, try to use the explanation field directly
                                              explanation = result.explanation || "";
                                            }

                                            return explanation ? (
                                              <div className="mt-6 pt-3 border-t">
                                                <h3 className="text-lg font-medium">Your Explanation</h3>
                                                <div className="bg-gray-50 p-3 rounded-md mt-2">
                                                  <p className="whitespace-pre-wrap break-words text-sm">{explanation}</p>
                                                </div>

                                                {/* Show expected explanation from answer key if available */}
                                                {(() => {
                                                  let expectedExplanation = "";
                                                  try {
                                                    const parsedKey = JSON.parse(result.answer_key || "{}");
                                                    if (parsedKey.explanation && parsedKey.explanation.text) {
                                                      expectedExplanation = parsedKey.explanation.text;
                                                    }
                                                  } catch (e) { /* ignore parsing errors */ }

                                                  return expectedExplanation ? (
                                                    <div className="mt-3">
                                                      <h4 className="text-sm font-medium text-muted-foreground">Expected Explanation</h4>
                                                      <div className="bg-blue-50 p-3 rounded-md mt-1">
                                                        <p className="whitespace-pre-wrap text-sm break-words">{expectedExplanation}</p>
                                                      </div>
                                                    </div>
                                                  ) : null;
                                                })()}
                                              </div>
                                            ) : null;
                                          })()}
                                        </div>
                                      ) : (
                                        <p className="text-center text-muted-foreground">No detailed answer data available.</p>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex justify-end pt-4 border-t flex-shrink-0">
                                    <DialogClose asChild>
                                      <Button>Close</Button>
                                    </DialogClose>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintExam(result)}
                            >
                              <FileText className="h-4 w-4 mr-2" /> Print Exam
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6">
                        {searchTerm ? "No results match your search." : "No results found."}
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Results;
