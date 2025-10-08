import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getCurrentUser,
  uploadImage,
  addQuestion,
  isForensicScienceRelated,
  scoreExplanation,
} from "./utils";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Settings, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import KeywordPoolManager from "./KeywordPoolManager";

interface AddQuestionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  courses: any[];
  onQuestionAdded: () => void;
}

const AddQuestionDialog: React.FC<AddQuestionDialogProps> = ({
  isOpen,
  onOpenChange,
  courses,
  onQuestionAdded,
}) => {
  const [form, setForm] = useState({
    title: "",
    text: "",
    course: "",
    difficulty: "medium",
  });
  const [answerKey, setAnswerKey] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [forensicAnswerRows, setForensicAnswerRows] = useState([
    { questionSpecimen: "", standardSpecimen: "", points: 1 },
  ]);
  const [explanation, setExplanation] = useState("");
  const [explanationPoints, setExplanationPoints] = useState(1);
  const [forensicConclusion, setForensicConclusion] = useState<
    "fake" | "real" | ""
  >("");
  const [selectedKeywordPool, setSelectedKeywordPool] = useState<any>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [isKeywordPoolManagerOpen, setIsKeywordPoolManagerOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFormChange = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImageFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearImages = () => {
    setImageFiles([]);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleForensicRowChange = (
    idx: number,
    field: string,
    value: string | number
  ) => {
    setForensicAnswerRows((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const handleAddForensicRow = () => {
    // Use the points value from the last row when adding a new one
    const lastRowPoints =
      forensicAnswerRows.length > 0
        ? forensicAnswerRows[forensicAnswerRows.length - 1].points
        : 1;

    setForensicAnswerRows((rows) => [
      ...rows,
      { questionSpecimen: "", standardSpecimen: "", points: lastRowPoints },
    ]);
  };

  const handleRemoveForensicRow = (idx: number) => {
    setForensicAnswerRows((rows) => rows.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setForm({
      title: "",
      text: "",
      course: "",
      difficulty: "medium",
    });
    setAnswerKey("");
    setImageFiles([]);
    setForensicAnswerRows([
      { questionSpecimen: "", standardSpecimen: "", points: 1 },
    ]);
    setExplanation("");
    setExplanationPoints(1);
    setForensicConclusion("");
    setSelectedKeywordPool(null);
    setSelectedKeywords([]);
  };

  const handleAddQuestion = async () => {
    if (!form.title || !form.course || !form.difficulty) {
      toast({
        title: "Validation Error",
        description: "Title, course, and difficulty are required.",
        variant: "destructive",
      });
      return;
    }

    // Validate forensic conclusion and explanation
    if (explanation.trim() && !forensicConclusion) {
      toast({
        title: "Validation Error",
        description:
          "Please select a forensic conclusion (Fake or Real Specimen) when providing an explanation.",
        variant: "destructive",
      });
      return;
    }

    if (forensicConclusion && !explanation.trim()) {
      toast({
        title: "Validation Error",
        description:
          "Please provide an explanation when selecting a forensic conclusion.",
        variant: "destructive",
      });
      return;
    }

    // Check if explanation is forensic science related
    if (explanation.trim() && !isForensicScienceRelated(explanation)) {
      toast({
        title: "Warning",
        description:
          "The explanation should be related to forensic science analysis. Please review your explanation.",
        variant: "destructive",
      });
      // Don't return here, just warn the user
    }

    // Handle multiple image uploads
    if (imageFiles.length > 0) {
      const uploadPromises = imageFiles.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            uploadImage(
              file,
              (url) => resolve(url),
              (err) => reject(err)
            );
          })
      );

      try {
        const imageUrls = await Promise.all(uploadPromises);
        finalizeQuestionSubmission(imageUrls.join("|"));
      } catch (err) {
        toast({
          title: "Upload Failed",
          description: "Failed to upload one or more image files.",
          variant: "destructive",
        });
        console.error("[Questions][Upload] Error:", err);
        return;
      }
    } else {
      finalizeQuestionSubmission("");
    }
  };

  const finalizeQuestionSubmission = (imageUrl: string) => {
    // Create the answer data with specimens and explanation
    const answerData = {
      specimens: forensicAnswerRows.map((row) => ({
        questionSpecimen: row.questionSpecimen,
        standardSpecimen: row.standardSpecimen,
        points: Number(row.points) || 1,
      })),
      explanation: {
        text: explanation,
        points: Number(explanationPoints) || 0,
        conclusion: forensicConclusion,
      },
      keywordPool: selectedKeywordPool ? {
        id: selectedKeywordPool.id,
        name: selectedKeywordPool.name,
        selectedKeywords: selectedKeywords,
      } : null,
    };

    // Stringify the complete answer structure
    const answer = JSON.stringify(answerData);

    // Get current user from token to record as creator
    const currentUser = getCurrentUser();

    // Calculate total points including both specimens and explanation
    const totalPoints =
      forensicAnswerRows.reduce(
        (sum, row) => sum + (Number(row.points) || 1),
        0
      ) + (Number(explanationPoints) || 0);

    const payload = {
      title: form.title,
      text: form.text,
      course_id: form.course,
      difficulty: form.difficulty,
      type: "forensic",
      answer,
      image: imageUrl,
      points: totalPoints,
      created_by: currentUser?.id, // Include the current user's ID
      explanation: explanation, // Add explanation as a separate field for direct access
      explanation_points: Number(explanationPoints) || 0, // Add explanation points separately
      keyword_pool_id: selectedKeywordPool?.id || null,
      selected_keywords: selectedKeywords.length > 0 ? selectedKeywords : null,
    };

    addQuestion(
      payload,
      () => {
        toast({
          title: "Success",
          description: "Question added successfully.",
        });
        resetForm();
        onOpenChange(false);
        onQuestionAdded();
      },
      (err) => {
        toast({
          title: "Error",
          description: err.message || "Failed to add question.",
          variant: "destructive",
        });
        console.error("[Questions][Add] Error:", err);
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Question</DialogTitle>
          <DialogDescription>
            Create a new question for the examination system.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="course">Course</Label>
            <Select
              value={form.course}
              onValueChange={(v) => handleFormChange("course", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.code ? `${c.code} - ${c.name}` : c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Question Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => handleFormChange("title", e.target.value)}
              placeholder="Enter a title for your question"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="question-text">Question Text</Label>
            <Textarea
              id="question-text"
              value={form.text}
              onChange={(e) => handleFormChange("text", e.target.value)}
              placeholder="Enter the full question text here..."
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Question Images</Label>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={imageInputRef}
              onChange={handleImageChange}
            />
            {imageFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Selected Images ({imageFiles.length})
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearImages}
                  >
                    Clear All
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {imageFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="text-xs truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveImage(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty Level</Label>
            <Select
              value={form.difficulty}
              onValueChange={(v) => handleFormChange("difficulty", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Keyword Pool (Optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/keyword-pools')}
                className="flex items-center gap-1"
              >
                <Settings className="h-4 w-4" />
                Manage Pools
              </Button>
            </div>
            
            {selectedKeywordPool ? (
              <div className="border rounded-lg p-3 bg-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {selectedKeywordPool.name}
                    </h4>
                    {selectedKeywordPool.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedKeywordPool.description}
                      </p>
                    )}
                    <div className="mt-2">
                      <div className="text-sm font-medium mb-2">Selected Keywords:</div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selectedKeywords.map((keyword, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-200 text-gray-800 text-xs rounded-full flex items-center gap-1"
                          >
                            {keyword}
                            <button
                              onClick={() => {
                                setSelectedKeywords(selectedKeywords.filter(k => k !== keyword));
                              }}
                              className="ml-1 hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="text-sm font-medium mb-2">Available Keywords:</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedKeywordPool.keywords
                          .filter(keyword => !selectedKeywords.includes(keyword))
                          .map((keyword, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setSelectedKeywords([...selectedKeywords, keyword]);
                              }}
                              className="px-2 py-1 bg-gray-300 text-gray-800 text-xs rounded-full hover:bg-gray-400"
                            >
                              + {keyword}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedKeywordPool(null);
                      setSelectedKeywords([]);
                    }}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsKeywordPoolManagerOpen(true)}
                  className="flex-1"
                >
                  Select Keyword Pool
                </Button>
              </div>
            )}
            
            <div className="text-sm text-muted-foreground">
              Select a keyword pool to provide predefined keywords for answer evaluation.
              You can choose specific keywords from the pool to use for this question.
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Answer Key Table</Label>
              <div className="text-sm text-muted-foreground">
                Total Points:{" "}
                {forensicAnswerRows.reduce(
                  (sum, row) => sum + (Number(row.points) || 1),
                  0
                ) + (Number(explanationPoints) || 0)}
              </div>
            </div>

            <div className="max-h-[300px] overflow-auto border rounded-md">
              <table className="w-full border text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="border p-2 w-12">#</th>
                    <th className="border p-2">Question Specimen</th>
                    <th className="border p-2">Standard Specimen</th>
                    <th className="border p-2 w-24">Points</th>
                    <th className="border p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {forensicAnswerRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border p-2 text-center font-medium">
                        {idx + 1}
                      </td>
                      <td className="border p-2">
                        <input
                          className="w-full border px-2 py-1"
                          value={row.questionSpecimen}
                          onChange={(e) =>
                            handleForensicRowChange(
                              idx,
                              "questionSpecimen",
                              e.target.value
                            )
                          }
                          placeholder="Question Specimen"
                          title="Question Specimen"
                        />
                      </td>
                      <td className="border p-2">
                        <input
                          className="w-full border px-2 py-1"
                          value={row.standardSpecimen}
                          onChange={(e) =>
                            handleForensicRowChange(
                              idx,
                              "standardSpecimen",
                              e.target.value
                            )
                          }
                          placeholder="Standard Specimen"
                          title="Standard Specimen"
                        />
                      </td>
                      <td className="border p-2">
                        <input
                          className="w-full border px-2 py-1 text-center"
                          type="number"
                          min={1}
                          value={row.points}
                          onChange={(e) =>
                            handleForensicRowChange(
                              idx,
                              "points",
                              Number(e.target.value)
                            )
                          }
                          placeholder="Points"
                          title="Points for this row"
                        />
                      </td>
                      <td className="border p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveForensicRow(idx)}
                          disabled={forensicAnswerRows.length === 1}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddForensicRow}
              className="flex items-center gap-1 mt-2"
            >
              <PlusCircle className="h-4 w-4" /> Add Row
            </Button>
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="explanation">Explanation</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="explanation-points" className="text-sm">
                  Points:
                </Label>
                <Input
                  id="explanation-points"
                  type="number"
                  min={0}
                  className="w-20 h-8"
                  value={explanationPoints}
                  onChange={(e) => setExplanationPoints(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Forensic Conclusion</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={
                    forensicConclusion === "fake" ? "default" : "outline"
                  }
                  onClick={() => setForensicConclusion("fake")}
                  className="flex-1"
                >
                  Fake Specimen
                </Button>
                <Button
                  type="button"
                  variant={
                    forensicConclusion === "real" ? "default" : "outline"
                  }
                  onClick={() => setForensicConclusion("real")}
                  className="flex-1"
                >
                  Real Specimen
                </Button>
              </div>
            </div>

            <Textarea
              id="explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Enter an explanation for the table comparison..."
              rows={4}
            />
            <div className="text-sm text-muted-foreground">
              Select the main conclusion and add an explanation. The system will
              check if the explanation is related to forensic science.
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleAddQuestion}>
            Save Question
          </Button>
        </DialogFooter>
      </DialogContent>
      
      <KeywordPoolManager
        isOpen={isKeywordPoolManagerOpen}
        onOpenChange={setIsKeywordPoolManagerOpen}
        onPoolSelected={(pool) => {
          setSelectedKeywordPool(pool);
          // Initially select all keywords, user can modify later
          setSelectedKeywords([...pool.keywords]);
        }}
        selectMode={true}
      />
    </Dialog>
  );
};

export default AddQuestionDialog;
