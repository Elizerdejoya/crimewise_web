import React from 'react';
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Edit2,
  Trash2,
  Copy,
  Printer,
  FileSpreadsheet,
  FileText,
  FilePlus2
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";

interface QuestionToolbarProps {
  onAddQuestion: () => void;
  onReload: () => void;
  onEdit: () => void;
  onDelete: () => void;
  selectedIds: number[];
  questions: any[];
}

const QuestionToolbar: React.FC<QuestionToolbarProps> = ({
  onAddQuestion,
  onReload,
  onEdit,
  onDelete,
  selectedIds,
  questions
}) => {
  const { toast } = useToast();

  // Copy selected questions to clipboard
  const handleCopy = () => {
    if (selectedIds.length === 0) return;
    
    const rows = questions.filter(q => selectedIds.includes(q.id));
    const text = rows.map(r => `${r.id}\t${r.title}\t${r.course}\t${r.difficulty}`).join("\n");
    navigator.clipboard.writeText(text);
    
    toast({ 
      title: "Copied", 
      description: "Selected questions copied to clipboard." 
    });
  };

  // Print selected questions
  const handlePrint = () => {
    if (selectedIds.length === 0) return;
    
    const rows = questions.filter(q => selectedIds.includes(q.id));
    const printWindow = window.open('', '', 'height=600,width=800');
    
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Questions</title></head><body>');
      printWindow.document.write('<table border="1"><tr><th>ID</th><th>Title</th><th>Type</th><th>Course</th><th>Difficulty</th><th>Created By</th></tr>');
      rows.forEach(r => printWindow.document.write(`<tr><td>${r.id}</td><td>${r.title}</td><td>${r.type}</td><td>${r.course}</td><td>${r.difficulty}</td><td>${r.created_by}</td></tr>`));
      printWindow.document.write('</table></body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  };
  
  // Export selected questions to Excel
  const handleExcel = () => {
    if (selectedIds.length === 0) return;
    
    const rows = questions.filter(q => selectedIds.includes(q.id));
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({ 
      ID: r.id, 
      Title: r.title, 
      Type: r.type, 
      Course: r.course, 
      Difficulty: r.difficulty,
      CreatedBy: r.created_by,
      Created: r.created 
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "questions.xlsx");
    
    toast({ 
      title: "Excel Exported", 
      description: "Excel file downloaded." 
    });
  };
  
  // Export selected questions to PDF
  const handlePDF = () => {
    if (selectedIds.length === 0) return;
    
    const rows = questions.filter(q => selectedIds.includes(q.id));
    const doc = new jsPDF();
    
    doc.text("Question Bank List", 14, 16);
    autoTable(doc, {
      head: [["ID", "Title", "Type", "Course", "Difficulty", "Created By"]],
      body: rows.map(r => [r.id, r.title, r.type, r.course, r.difficulty, r.created_by]),
      startY: 22,
    });
    
    doc.save("questions.pdf");
    
    toast({ 
      title: "PDF Exported", 
      description: "PDF file downloaded." 
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-4">
      <div className="flex gap-2">
        <Button size="sm" onClick={onAddQuestion}>
          <FilePlus2 className="mr-1 h-4 w-4" /> Add Question
        </Button>
        <Button size="sm" variant="outline" onClick={onReload}>
          <RefreshCw className="mr-1 h-4 w-4" /> Reload
        </Button>
      </div>
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={onEdit} 
          disabled={selectedIds.length !== 1}
        >
          <Edit2 className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button 
          size="sm" 
          variant="destructive" 
          onClick={onDelete} 
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
  );
};

export default QuestionToolbar;