import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tags } from "lucide-react";

interface ViewQuestionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  question: any | null;
}

interface ForensicAnswerRow {
  questionSpecimen: string;
  standardSpecimen: string;
  points: number;
}

interface ForensicAnswerData {
  specimens: ForensicAnswerRow[];
  explanation: {
    text: string;
    points: number;
    conclusion?: string;
  };
}

const ViewQuestionDialog: React.FC<ViewQuestionDialogProps> = ({
  isOpen,
  onOpenChange,
  question,
}) => {
  if (!question) return null;

  // Parse forensic answer if needed
  const forensicData = useMemo(() => {
    if (question.type === "forensic" && question.answer) {
      try {
        const parsedAnswer = JSON.parse(question.answer);

        // Handle both old format (array) and new format (object with specimens and explanation)
        if (Array.isArray(parsedAnswer)) {
          // Old format - just specimens array
          const specimens = parsedAnswer.map((row: any) => ({
            questionSpecimen: row.questionSpecimen || "",
            standardSpecimen: row.standardSpecimen || "",
            points: row.points || 1,
          }));
          return {
            specimens,
            explanation: {
              text: "",
              points: 0,
              conclusion: "",
            },
          };
        } else {
          // New format with specimens and explanation
          const specimens = (parsedAnswer.specimens || []).map((row: any) => ({
            questionSpecimen: row.questionSpecimen || "",
            standardSpecimen: row.standardSpecimen || "",
            points: row.points || 1,
          }));

          return {
            specimens,
            explanation: parsedAnswer.explanation || {
              text: "",
              points: 0,
              conclusion: "",
            },
          };
        }
      } catch (e) {
        console.error("Error parsing forensic answer:", e);
        return {
          specimens: [],
          explanation: { text: "", points: 0, conclusion: "" },
        };
      }
    }
    return null;
  }, [question]);

  // Calculate total points for forensic questions
  const totalPoints = useMemo(() => {
    if (forensicData) {
      const specimenPoints = forensicData.specimens.reduce(
        (sum, row) => sum + (Number(row.points) || 1),
        0
      );
      const explanationPoints = Number(forensicData.explanation?.points) || 0;
      return specimenPoints + explanationPoints;
    }
    return null;
  }, [forensicData]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>View Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Title</Label>
          <div className="p-2 bg-gray-50 rounded-md">{question.title}</div>

          <Label>Text</Label>
          <div className="p-2 bg-gray-50 rounded-md whitespace-pre-wrap">
            {question.text}
          </div>

          <Label>Course</Label>
          <div className="p-2 bg-gray-50 rounded-md">{question.course}</div>

          <Label>Type</Label>
          <div className="p-2 bg-gray-50 rounded-md">
            {question.type.charAt(0).toUpperCase() + question.type.slice(1)}{" "}
            Question
          </div>

          <Label>Difficulty</Label>
          <div className="p-2 bg-gray-50 rounded-md">
            <span
              className={`px-2 py-1 rounded text-xs font-medium
              ${
                question.difficulty === "easy"
                  ? "bg-green-100 text-green-800"
                  : ""
              }
              ${
                question.difficulty === "medium"
                  ? "bg-blue-100 text-blue-800"
                  : ""
              }
              ${
                question.difficulty === "hard"
                  ? "bg-orange-100 text-orange-800"
                  : ""
              }
              ${
                question.difficulty === "expert"
                  ? "bg-red-100 text-red-800"
                  : ""
              }
            `}
            >
              {question.difficulty.charAt(0).toUpperCase() +
                question.difficulty.slice(1)}
            </span>
          </div>

          <Label>Keyword Pool</Label>
          <div className="p-2 bg-gray-50 rounded-md">
            {question.keyword_pool_name ? (
              <div className="space-y-2">
                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                  <Tags className="h-3 w-3" />
                  {question.keyword_pool_name}
                </Badge>
                {question.keyword_pool_description && (
                  <p className="text-sm text-gray-600">{question.keyword_pool_description}</p>
                )}
                {question.selected_keywords && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">Selected Keywords:</p>
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        try {
                          const keywords = typeof question.selected_keywords === 'string' 
                            ? JSON.parse(question.selected_keywords)
                            : question.selected_keywords;
                          return Array.isArray(keywords) ? keywords : [];
                        } catch (e) {
                          console.error('Error parsing selected keywords:', e);
                          return [];
                        }
                      })().map((keyword: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-gray-400 text-sm">No keyword pool assigned</span>
            )}
          </div>

          {/* Display answer based on question type */}
          {question.type === "forensic" && forensicData ? (
            <>
              <Label>Answer Key Table</Label>
              <div className="max-h-[300px] overflow-auto border rounded-md">
                <table className="w-full border text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border p-2 w-12">#</th>
                      <th className="border p-2">Question Specimen</th>
                      <th className="border p-2">Standard Specimen</th>
                      <th className="border p-2 w-24">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forensicData.specimens.map((row, idx) => (
                      <tr key={idx}>
                        <td className="border p-2 text-center font-medium">
                          {idx + 1}
                        </td>
                        <td className="border p-2">{row.questionSpecimen}</td>
                        <td className="border p-2">{row.standardSpecimen}</td>
                        <td className="border p-2 text-center font-medium">
                          {row.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {forensicData.explanation &&
                (forensicData.explanation.text ||
                  forensicData.explanation.conclusion) && (
                  <>
                    <Label>
                      Explanation{" "}
                      <span className="text-sm text-muted-foreground">
                        ({forensicData.explanation.points} points)
                      </span>
                    </Label>
                    {forensicData.explanation.conclusion && (
                      <div className="p-2 bg-gray-50 rounded-md mb-2">
                        <span className="font-medium">Conclusion: </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            forensicData.explanation.conclusion === "fake"
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {forensicData.explanation.conclusion === "fake"
                            ? "Fake Specimen"
                            : "Real Specimen"}
                        </span>
                      </div>
                    )}
                    {forensicData.explanation.text && (
                      <div className="p-2 bg-gray-50 rounded-md whitespace-pre-wrap">
                        {forensicData.explanation.text}
                      </div>
                    )}
                  </>
                )}

              <div className="text-sm font-medium text-right">
                Total Points: {totalPoints}
              </div>
            </>
          ) : (
            <>
              <Label>Answer</Label>
              <div className="p-2 bg-gray-50 rounded-md whitespace-pre-wrap">
                {question.answer}
              </div>
            </>
          )}

          {question.image && (
            <>
              <Label>Images</Label>
              <div className="p-2 bg-gray-50 rounded-md">
                {question.image.includes("|") ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {question.image.split("|").map((imgUrl, index) => (
                      <div key={index} className="space-y-2">
                        <div className="text-sm font-medium">
                          Image {index + 1}
                        </div>
                        <img
                          src={imgUrl}
                          alt={`Question ${index + 1}`}
                          className="max-w-full h-auto border rounded"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <img
                    src={question.image}
                    alt="Question"
                    className="max-w-full h-auto"
                  />
                )}
              </div>
            </>
          )}

          <Label>Created By</Label>
          <div className="p-2 bg-gray-50 rounded-md">
            {question.created_by || "System"}
          </div>

          <Label>Created Date</Label>
          <div className="p-2 bg-gray-50 rounded-md">{question.created}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewQuestionDialog;
