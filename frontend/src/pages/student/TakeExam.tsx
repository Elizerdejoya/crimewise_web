import { useEffect, useState, useRef } from "react";
import { useNavigate, useBeforeUnload, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";
import { JwtTokenPayload } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ZoomIn, ZoomOut, X, Tags } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

// Helper function to create auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

// Enhanced Image FullScreen Component with Pan and Zoom
const ImageFullScreen = ({ src, alt }: { src: string; alt: string }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 5)); // Increased max zoom to 5x
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 0.1)); // Decreased min zoom to 0.1x
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoomLevel((prev) => Math.max(0.1, Math.min(5, prev + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  const toggleFullScreen = () => {
    setIsFullScreen((prev) => !prev);
    // Reset view when toggling fullscreen mode
    resetView();
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isFullScreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          toggleFullScreen();
          break;
        case "r":
        case "R":
          e.preventDefault();
          resetView();
          break;
        case "+":
        case "=":
          e.preventDefault();
          handleZoomIn();
          break;
        case "-":
          e.preventDefault();
          handleZoomOut();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  return (
    <div className="relative inline-block w-full">
      {isFullScreen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            ref={containerRef}
            className="relative w-full h-full flex items-center justify-center overflow-hidden"
            style={{
              cursor: isDragging
                ? "grabbing"
                : zoomLevel > 1
                  ? "grab"
                  : "default",
            }}
          >
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
                transition: isDragging ? "none" : "transform 0.1s ease-out",
                cursor: isDragging
                  ? "grabbing"
                  : zoomLevel > 1
                    ? "grab"
                    : "default",
              }}
              draggable={false}
            />

            {/* Zoom and Control Panel */}
            <div className="absolute top-4 right-4 bg-white/90 rounded-lg shadow-lg p-2 flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                className="h-8 w-8"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                className="h-8 w-8"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="text-xs text-center px-2 py-1 bg-gray-100 rounded">
                {Math.round(zoomLevel * 100)}%
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetView}
                className="h-8 w-8"
                title="Reset view"
              >
                <span className="text-xs font-bold">R</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullScreen}
                className="h-8 w-8"
                title="Exit full screen"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Instructions */}
            <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg shadow-lg p-3 text-sm">
              <div className="font-medium mb-1">Controls:</div>
              <div>• Mouse wheel: Zoom in/out</div>
              <div>• Click and drag: Pan when zoomed in</div>
              <div>• R or Reset button: Reset view</div>
              <div>• +/- keys: Zoom in/out</div>
              <div>• Escape: Exit fullscreen</div>
            </div>
          </div>
        </div>
      )}

      <img
        src={src}
        alt={alt}
        className="w-full h-auto border rounded cursor-pointer hover:opacity-90 transition-opacity"
        style={{ objectFit: "contain", maxHeight: "400px" }}
        onClick={toggleFullScreen}
      />

      <div className="absolute top-2 right-2 bg-white/90 rounded-md shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullScreen}
          className="h-8 w-8"
          title="View full screen"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Multi-Image Display Component
const MultiImageDisplay = ({ images }: { images: string[] }) => {
  const [selectedImage, setSelectedImage] = useState(0);

  if (images.length === 1) {
    return <ImageFullScreen src={images[0]} alt="Question Image" />;
  }

  return (
    <div className="space-y-4">
      {/* Image Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => setSelectedImage(index)}
            className={`flex-shrink-0 border-2 rounded-lg overflow-hidden transition-all ${selectedImage === index
              ? "border-blue-500 shadow-lg"
              : "border-gray-300 hover:border-gray-400"
              }`}
          >
            <img
              src={image}
              alt={`Image ${index + 1}`}
              className="w-20 h-20 object-cover"
            />
          </button>
        ))}
      </div>

      {/* Main Image Display */}
      <div className="relative">
        <ImageFullScreen
          src={images[selectedImage]}
          alt={`Question Image ${selectedImage + 1}`}
        />
        <div className="absolute top-2 left-2 bg-white/90 rounded-md shadow-sm px-2 py-1 text-sm font-medium">
          Image {selectedImage + 1} of {images.length}
        </div>
      </div>
    </div>
  );
};

const TakeExam = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [exam, setExam] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [answer, setAnswer] = useState<any>([]); // Initialize as empty array instead of empty string
  const [explanation, setExplanation] = useState("");
  const [studentConclusion, setStudentConclusion] = useState<"fake" | "real" | "">("");
  const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scoringDetails, setScoringDetails] = useState<any>(null);

  // Block browser back button
  useEffect(() => {
    // Create an entry in the history stack one step ahead of the current entry
    const pushState = () => {
      window.history.pushState(null, "", location.pathname);
    };

    // Function to handle popstate (back/forward button clicks)
    const handlePopstate = (event: PopStateEvent) => {
      event.preventDefault();
      // Push another state to prevent going back
      pushState();
      // Show leave dialog
      setShowLeaveDialog(true);
    };

    // Initialize: push state to create a barrier
    pushState();

    // Listen for back button clicks
    window.addEventListener("popstate", handlePopstate);

    return () => {
      window.removeEventListener("popstate", handlePopstate);
    };
  }, [location.pathname]);

  // Detect tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setTabSwitchCount((prev) => prev + 1);
        // Show warning when user returns
        setTimeout(() => {
          if (document.visibilityState === "visible") {
            toast({
              title: "Warning",
              description:
                "Tab switching detected! This has been reported to your instructor.",
              variant: "destructive",
              duration: 5000,
            });
          }
        }, 500);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [toast]);

  // Prevent accidental navigation
  useBeforeUnload((event) => {
    if (!isSubmitting) {
      event.preventDefault();
      return "Are you sure you want to leave? Your exam progress will be lost.";
    }
  });

  useEffect(() => {
    // Get exam info from sessionStorage
    const examData = sessionStorage.getItem("currentExam");
    if (!examData) {
      toast({
        title: "No Exam",
        description: "No exam found. Please enter a token.",
        variant: "destructive",
      });
      navigate("/student/exams");
      return;
    }
    const parsedExam = JSON.parse(examData);
    setExam(parsedExam);
    // Fetch question details from backend
    fetch(`${API_BASE_URL}/api/questions/${parsedExam.question_id}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (res.status === 401) {
          toast({
            title: "Authentication Error",
            description: "Please log in again.",
            variant: "destructive",
          });
          navigate("/student/exams");
          return;
        }
        return res.json();
      })
      .then((q) => {
        setQuestion(q);
        // Initialize answer structure based on question data
        if (q.type === "forensic" && q.answer) {
          try {
            // Parse the answer which now has a different structure
            const parsedAnswer = JSON.parse(q.answer || "{}");
            // Initialize answer array based on specimens array length
            if (
              parsedAnswer.specimens &&
              Array.isArray(parsedAnswer.specimens)
            ) {
              setAnswer(Array(parsedAnswer.specimens.length).fill({}));
            }
          } catch (e) {
            console.error("Error parsing forensic answer:", e);
          }
        }
      });
    // Timer logic
    let start = Number(sessionStorage.getItem("examStartTimestamp"));
    if (!start) {
      start = Date.now();
      sessionStorage.setItem("examStartTimestamp", String(start));
    }
    setStartTimestamp(start);
    const [mins, secs] = parsedExam.duration
      .split(":")
      .map((v: string) => parseInt(v, 10));
    const totalSeconds = mins * 60 + (secs || 0);
    const elapsed = Math.floor((Date.now() - start) / 1000);
    setTimeLeft(Math.max(totalSeconds - elapsed, 0));
  }, [navigate, toast]);

  useEffect(() => {
    // Time left counting
    if (timeLeft <= 0 && startTimestamp && Date.now() - startTimestamp > 1000) {
      // Only auto-submit if the exam has actually started (not at initialization)
      handleConfirmSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleConfirmSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, startTimestamp]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Common words to exclude from comparison
  const commonWords = new Set([
    "the",
    "in",
    "on",
    "at",
    "of",
    "to",
    "a",
    "an",
    "and",
    "but",
    "or",
    "for",
    "nor",
    "yet",
    "so",
    "as",
    "by",
    "is",
    "are",
    "am",
    "was",
    "were",
    "be",
    "been",
    "being",
    "that",
    "this",
    "these",
    "those",
    "it",
    "they",
    "he",
    "she",
    "we",
    "I",
    "you",
    "who",
    "what",
    "which",
    "whose",
    "where",
    "when",
    "how",
    "why",
    "with",
    "from",
    "into",
  ]);

  const cleanText = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .split(/\s+/)
      .filter((word) => !commonWords.has(word.toLowerCase()) && word.length > 1)
      .join(" ")
      .trim();
  };

  // Enhanced scoring algorithm with more precise similarity calculation
  const compareAnswers = (userAnswer: string, correctAnswer: string) => {
    if (!userAnswer || !correctAnswer) return 0;

    const cleanUserAnswer = cleanText(userAnswer);
    const cleanCorrectAnswer = cleanText(correctAnswer);

    // Empty answers can't match
    if (!cleanUserAnswer || !cleanCorrectAnswer) return 0;

    // Split into word arrays and filter out common words
    const userWords = cleanUserAnswer
      .split(/\s+/)
      .filter((word) => word.length > 1);
    const correctWords = cleanCorrectAnswer
      .split(/\s+/)
      .filter((word) => word.length > 1);

    // If no meaningful words in either answer, can't match
    if (userWords.length === 0 || correctWords.length === 0) return 0;

    // Count matching words and consider word order for higher precision
    let matchCount = 0;
    let orderScore = 0;

    // First check for exact matches
    for (let i = 0; i < userWords.length; i++) {
      const userWord = userWords[i].toLowerCase();

      for (let j = 0; j < correctWords.length; j++) {
        const correctWord = correctWords[j].toLowerCase();

        if (userWord === correctWord) {
          matchCount++;

          // Award extra points if words appear in similar positions (order matters)
          const userRelativePos = i / Math.max(1, userWords.length - 1);
          const correctRelativePos = j / Math.max(1, correctWords.length - 1);
          const positionSimilarity =
            1 - Math.abs(userRelativePos - correctRelativePos);
          orderScore += positionSimilarity;

          break; // Found a match for this word, move to next
        }
      }
    }

    // Calculate fuzzy match for words that aren't exact matches
    let fuzzyMatchScore = 0;
    for (const userWord of userWords) {
      if (userWord.length <= 3) continue; // Skip very short words

      for (const correctWord of correctWords) {
        if (correctWord.length <= 3) continue;

        if (
          userWord.toLowerCase().includes(correctWord.toLowerCase()) ||
          correctWord.toLowerCase().includes(userWord.toLowerCase())
        ) {
          fuzzyMatchScore += 0.5; // Award partial credit for partial matches
          break;
        }
      }
    }

    // Calculate final similarity percentage
    const exactMatchScore = matchCount * 70; // Exact matches have higher weight
    const orderBonus = orderScore * 15; // Word order has medium weight
    const fuzzyBonus = fuzzyMatchScore * 15; // Partial matches have lower weight

    const maxPossible = correctWords.length * 100; // Maximum possible points
    const totalScore = exactMatchScore + orderBonus + fuzzyBonus;

    return maxPossible > 0
      ? Math.min(100, (totalScore / maxPossible) * 100)
      : 0;
  };

  const handleConfirmSubmit = () => {
    setShowSubmitDialog(true);
  };

  const handleSubmit = async () => {
    if (!exam) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const decoded = jwtDecode<JwtTokenPayload>(token!);
      const student_id = decoded.id;
      let answerToSave = answer;
      let score = null;
      let details = null;

      if (question.type === "forensic") {
        let forensicRows = [];
        try {
          // Parse the answer from the question
          const parsedAnswer = JSON.parse(question.answer || "{}");

          // Check if the answer has the new format with specimens array
          if (parsedAnswer.specimens && Array.isArray(parsedAnswer.specimens)) {
            forensicRows = parsedAnswer.specimens;
          } else if (Array.isArray(parsedAnswer)) {
            // Fallback to the old format if the answer is directly an array
            forensicRows = parsedAnswer;
          }

          // Final safety check - ensure forensicRows is an array
          if (!Array.isArray(forensicRows)) {
            forensicRows = [];
            console.error("Forensic rows is not an array after parsing");
          }
        } catch (e) {
          forensicRows = [];
          console.error("Error parsing forensic answer:", e);
        }

        // Check if forensic rows have points (from the updated format)
        const hasPointsPerRow =
          forensicRows.length > 0 && "points" in forensicRows[0];

        // Track scoring details for potentially showing to the student later
        const rowDetails = [];
        let totalScore = 0;
        let totalPossiblePoints = 0;

        // Get explanation points from parsed answer if available
        let explanationPoints = 0;
        try {
          const parsedAnswer = JSON.parse(question.answer || "{}");
          if (
            parsedAnswer.explanation &&
            typeof parsedAnswer.explanation.points === "number"
          ) {
            explanationPoints = parsedAnswer.explanation.points;
            totalPossiblePoints += explanationPoints;
          }
        } catch (e) {
          console.error("Error extracting explanation points:", e);
        }

        // Process each row in the forensic table - safe iteration with Array.isArray check
        if (Array.isArray(forensicRows)) {
          forensicRows.forEach((row: any, rowIdx: number) => {
            // Get row points (default to 1 if not specified)
            const rowPoints = hasPointsPerRow ? Number(row.points) || 1 : 1;
            totalPossiblePoints += rowPoints;

            // Get the columns to check (excluding points which is metadata)
            const columns = Object.keys(row).filter((col) => col !== "points");
            const rowResult = {
              rowIndex: rowIdx,
              questionSpecimen: row.questionSpecimen,
              standardSpecimen: row.standardSpecimen,
              userValue: answer[rowIdx] || {},
              correct: false,
              points: 0,
              possiblePoints: rowPoints,
              columnScores: {},
            };

            // Check if this row's answer is correct by evaluating each column
            if (answer[rowIdx]) {
              let allCorrect = true;

              // Check each column for exact match
              columns.forEach((col) => {
                const userValue = (answer[rowIdx][col] || "")
                  .trim()
                  .toLowerCase();
                const correctValue = (row[col] || "").trim().toLowerCase();

                // Skip empty columns in the correct answer (they're not required)
                if (!correctValue) return;

                const isExactMatch = userValue === correctValue;

                // Store exact match result for this column
                rowResult.columnScores[col] = {
                  isExactMatch,
                  userValue,
                  correctValue,
                };

                if (!isExactMatch) {
                  allCorrect = false;
                }
              });

              // Award full points only if all columns are exactly correct
              if (allCorrect) {
                rowResult.correct = true;
                rowResult.points = rowPoints;
                totalScore += rowPoints;
              }
            }

            rowDetails.push(rowResult);
          });
        }

        // Add points for explanation if provided
        let explanationScore = 0;
        let explanationDetails = null;
        if (explanationPoints > 0) {
          // Get the expected conclusion from the question
          try {
            const parsedAnswer = JSON.parse(question.answer || "{}");
            const expectedConclusion = parsedAnswer.explanation?.conclusion || "";

            if (expectedConclusion && studentConclusion) {
              // Check if student's conclusion matches the expected conclusion
              const conclusionMatched = studentConclusion === expectedConclusion;

              // Award points based on conclusion match
              if (conclusionMatched) {
                // Award full points if conclusion matches
                explanationScore = explanationPoints;
              } else {
                // No points for wrong conclusion
                explanationScore = 0;
              }

              explanationDetails = {
                expectedConclusion,
                studentConclusion,
                conclusionMatched,
                studentText: explanation.trim(),
                maxPoints: explanationPoints,
                earnedPoints: explanationScore,
                scoringNote: "Points awarded based on fake/real specimen conclusion"
              };
            } else if (studentConclusion) {
              // If no expected conclusion specified, award full points for any selection
              explanationScore = explanationPoints;

              explanationDetails = {
                expectedConclusion: "No specific conclusion required",
                studentConclusion,
                conclusionMatched: true,
                studentText: explanation.trim(),
                maxPoints: explanationPoints,
                earnedPoints: explanationScore,
                scoringNote: "Points awarded for providing a conclusion"
              };
            } else {
              // No conclusion selected, no points
              explanationScore = 0;

              explanationDetails = {
                expectedConclusion: expectedConclusion || "Conclusion required",
                studentConclusion: "No conclusion selected",
                conclusionMatched: false,
                studentText: explanation.trim(),
                maxPoints: explanationPoints,
                earnedPoints: 0,
                scoringNote: "No points - conclusion not selected"
              };
            }
          } catch (e) {
            console.error("Error evaluating explanation conclusion:", e);
            // Fallback: award points if student provided a conclusion
            if (studentConclusion) {
              explanationScore = explanationPoints;
            }
          }

          totalScore += explanationScore;
        }

        score = Math.round(totalScore); // Ensure score is an integer
        details = {
          rowDetails,
          totalScore,
          totalPossiblePoints,
          explanation: explanation.trim(),
          explanationScore,
          explanationPoints,
          explanationDetails,
          assessmentMethod: "Exact matching with fake/real specimen conclusion",
        };

        // Save both the table answers and the explanation
        answerToSave = JSON.stringify({
          tableAnswers: answer,
          explanation: explanation.trim(),
          conclusion: studentConclusion,
        });
      } else if (question.type === "text" || question.type === "image") {
        // For text questions, use our enhanced similarity comparison
        if (question.answer) {
          const similarity = compareAnswers(answer, question.answer);
          const maxPoints = Number(question.points) || 1;

          // Calculate score based on similarity percentage
          score = Math.round((similarity / 100) * maxPoints);

          details = {
            userAnswer: answer,
            correctAnswer: question.answer,
            explanation: explanation.trim(), // Include student explanation
            similarity: similarity.toFixed(1) + "%",
            score,
            maxPoints,
          };

          // Save both the answer and explanation
          answerToSave = JSON.stringify({
            answer,
            explanation: explanation.trim(),
          });
        }
      }

      setScoringDetails(details);

      const payload = {
        student_id,
        exam_id: exam.id,
        answer: answerToSave,
        explanation: explanation.trim(), // Also include it at the top level for compatibility
        date: new Date().toISOString().split("T")[0],
        score,
        tab_switches: tabSwitchCount,
        details: JSON.stringify(details),
      };

      // Submit the exam
      const response = await fetch(`${API_BASE_URL}/api/exams/submit`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        toast({
          title: "Authentication Error",
          description: "Please log in again.",
          variant: "destructive",
        });
        navigate("/student/exams");
        return;
      }

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to submit exam" }));
        throw new Error(errorData.error || "Failed to submit exam");
      }

      toast({
        title: "Exam Submitted",
        description:
          score !== null
            ? `Your answers have been recorded successfully.`
            : "Your answers have been recorded successfully.",
      });

      sessionStorage.removeItem("currentExam");
      sessionStorage.removeItem("examStartTimestamp");
      navigate("/student/results");
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err.message || "Failed to submit your exam. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleBackClick = () => {
    setShowLeaveDialog(true);
  };

  const handleConfirmLeave = () => {
    sessionStorage.removeItem("currentExam");
    sessionStorage.removeItem("examStartTimestamp");
    navigate("/student");
  };

  if (!exam || !question) return <div className="p-4">Loading...</div>;

  // Render answer input based on question type
  let answerInput = null;

  // For forensic document questions
  let forensicRows = [];
  try {
    const parsedAnswer = JSON.parse(question.answer || "{}");
    // Check if the answer has the new format with specimens array
    if (parsedAnswer.specimens && Array.isArray(parsedAnswer.specimens)) {
      forensicRows = parsedAnswer.specimens;
    } else if (Array.isArray(parsedAnswer)) {
      // Fallback to the old format if needed
      forensicRows = parsedAnswer;
    }

    // Final safety check - ensure forensicRows is an array
    if (!Array.isArray(forensicRows)) {
      console.error(
        "forensicRows is not an array after parsing, resetting to empty array"
      );
      forensicRows = [];
    }
  } catch (error) {
    console.error("Error parsing forensic answer:", error);
    forensicRows = [];
  }

  // Get the columns from the first row (excluding points which is metadata)
  const columns =
    forensicRows.length > 0
      ? Object.keys(forensicRows[0]).filter((col) => col !== "points")
      : [];

  answerInput = (
    <>
      {question.image && (
        <div className="mb-3">
          {question.image.includes("|") ? (
            <MultiImageDisplay images={question.image.split("|")} />
          ) : (
            <ImageFullScreen src={question.image} alt="Forensic Document" />
          )}
        </div>
      )}
      
      {/* Keyword Pool Display */}
      {question.keyword_pool_name && question.keyword_pool_keywords && (
        <div className="mb-4 p-4 bg-gray-50 border rounded-lg">
          <div className="mb-2">
            <h4 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-1">
              <Tags className="h-4 w-4" />
              Available Keywords: {question.keyword_pool_name}
            </h4>
            {question.keyword_pool_description && (
              <p className="text-xs text-gray-600 mb-2">
                {question.keyword_pool_description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {(() => {
              try {
                const keywords = typeof question.keyword_pool_keywords === 'string'
                  ? JSON.parse(question.keyword_pool_keywords)
                  : question.keyword_pool_keywords;
                
                // If selected_keywords exist, show only those; otherwise show all keywords
                const keywordsToShow = question.selected_keywords ? (() => {
                  try {
                    return typeof question.selected_keywords === 'string'
                      ? JSON.parse(question.selected_keywords)
                      : question.selected_keywords;
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
      
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full border text-sm mb-3">
          <thead>
            <tr>
              <th className="border p-1 text-xs bg-gray-50 w-12">#</th>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="border p-1 capitalize text-xs bg-gray-50"
                >
                  {col.replace(/([A-Z])/g, " $1")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forensicRows.map((row: any, rowIdx: number) => (
              <tr key={rowIdx}>
                <td className="border p-1 text-center font-medium bg-gray-50">
                  {rowIdx + 1}
                </td>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="border p-1">
                    {colIdx === 0 && row.points && (
                      <div className="w-full flex justify-between mb-1">
                        <input
                          className="w-full px-2 py-1 text-sm"
                          value={answer[rowIdx]?.[col] || ""}
                          onChange={(e) => {
                            const arr = Array.isArray(answer)
                              ? [...answer]
                              : Array(forensicRows.length).fill({});
                            arr[rowIdx] = {
                              ...arr[rowIdx],
                              [col]: e.target.value,
                            };
                            setAnswer(arr);
                          }}
                          placeholder={`Enter ${col}`}
                        />
                      </div>
                    )}
                    {(colIdx !== 0 || !row.points) && (
                      <input
                        className="w-full px-2 py-1 text-sm"
                        value={answer[rowIdx]?.[col] || ""}
                        onChange={(e) => {
                          const arr = Array.isArray(answer)
                            ? [...answer]
                            : Array(forensicRows.length).fill({});
                          arr[rowIdx] = {
                            ...arr[rowIdx],
                            [col]: e.target.value,
                          };
                          setAnswer(arr);
                        }}
                        placeholder={`Enter ${col}`}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div className="container max-w-4xl mx-auto px-2 py-4">
      {/* Sticky header with timer and back button */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 py-2 mb-4 border-b flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={handleBackClick}>
          Back
        </Button>
        <div className="text-3xl font-mono bg-muted px-4 py-2 rounded-md">
          {formatTime(timeLeft)}
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-lg">
            {exam.name} - Question
            {tabSwitchCount > 0 && (
              <span className="ml-2 text-sm text-red-500 font-normal">
                Tab switched {tabSwitchCount} times
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3 px-4 space-y-4">
          <p>{question.text}</p>
          {answerInput}

          {/* Forensic Conclusion Selection - only show for forensic questions */}
          {question.type === "forensic" && (
            <div className="space-y-2 mt-6 border-t pt-4">
              <label className="block text-sm font-medium">
                Forensic Conclusion <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="conclusion"
                    value="fake"
                    checked={studentConclusion === "fake"}
                    onChange={(e) => setStudentConclusion("fake")}
                    className="form-radio"
                  />
                  <span>Fake Specimen</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="conclusion"
                    value="real"
                    checked={studentConclusion === "real"}
                    onChange={(e) => setStudentConclusion("real")}
                    className="form-radio"
                  />
                  <span>Real Specimen</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Required:</strong> Select whether you believe the specimen is fake or real based on your analysis.
                This selection will affect your exam score.
              </p>
            </div>
          )}

          {/* Explanation field */}
          <div className="space-y-2 mt-6 border-t pt-4">
            <label htmlFor="explanation" className="block text-sm font-medium">
              Explanation
            </label>
            <textarea
              id="explanation"
              rows={4}
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="Provide any additional explanation for your answers... "
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            ></textarea>
            <p className="text-xs text-muted-foreground">
              This explanation will be reviewed by your instructor.
              Your grade is based on the table answers and the fake/real conclusion above.
            </p>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleConfirmSubmit}>Submit Exam</Button>
          </div>
        </CardContent>
      </Card>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to leave?</AlertDialogTitle>
            <AlertDialogDescription>
              If you leave now, your exam progress will be lost and you may not
              be able to retake this exam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLeave}
              className="bg-red-500 hover:bg-red-600"
            >
              Yes, leave exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your exam?</AlertDialogTitle>
            <AlertDialogDescription>
              {timeLeft <= 0
                ? "Time's up! Your exam will be submitted now."
                : "Are you sure you want to submit your exam? You won't be able to change your answers after submission."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {timeLeft > 0 && (
              <AlertDialogCancel>Continue working</AlertDialogCancel>
            )}
            <AlertDialogAction onClick={handleSubmit} className="bg-primary">
              Submit exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TakeExam;
