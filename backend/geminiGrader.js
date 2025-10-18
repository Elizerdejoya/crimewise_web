const db = require('./db');
const GeminiQueue = require('./geminiQueue');
const { GoogleGenAI } = require('@google/genai');

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function gradeStudent(studentId, examId, teacherFindings, studentFindings) {
  console.log('[GRADER] Scheduling grading for student', studentId, 'exam', examId);
  // Attempt to load per-question rubric weights from the exams->questions relationship
  let rubricWeights = { accuracy: 40, completeness: 30, clarity: 20, objectivity: 10 };
  try {
    const examRow = await db.sql`SELECT * FROM exams WHERE id = ${examId} LIMIT 1`;
    const exam = Array.isArray(examRow) ? examRow[0] : examRow;
    if (exam && exam.question_id) {
      const qRow = await db.sql`SELECT * FROM questions WHERE id = ${exam.question_id} LIMIT 1`;
      const question = Array.isArray(qRow) ? qRow[0] : qRow;
      if (question && question.rubrics) {
        try {
          const parsed = typeof question.rubrics === 'string' ? JSON.parse(question.rubrics) : question.rubrics;
          rubricWeights = {
            accuracy: Number(parsed.accuracy ?? 40),
            completeness: Number(parsed.completeness ?? 30),
            clarity: Number(parsed.clarity ?? 20),
            objectivity: Number(parsed.objectivity ?? 10),
          };
        } catch (e) {
          // ignore parse errors and use defaults
        }
      }
    }
  } catch (e) {
    console.error('[GRADER] Could not load question rubrics, using defaults', e && e.message ? e.message : e);
  }

  const prompt = `You are an expert grader. Compare the student's findings to the teacher's official findings.

Rubrics (weights):
1. Accuracy (${rubricWeights.accuracy}%) - factual match
2. Completeness (${rubricWeights.completeness}%) - covered relevant points
3. Clarity (${rubricWeights.clarity}%) - understandable, logical writing
4. Objectivity (${rubricWeights.objectivity}%) - unbiased, evidence-based

Please provide a JSON response with fields: accuracy (0-100), completeness (0-100), clarity (0-100), objectivity (0-100), overall_score (0-100), feedback (short explanation of strengths and weaknesses, and why the numerical score was given).

Teacher findings:
"""
${teacherFindings}
"""

Student findings:
"""
${studentFindings}
"""

Evaluate carefully and return ONLY valid JSON.`;

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: { temperature: 0.0 }
    });

    const text = response.text;
    if (!text) throw new Error('No response from Gemini');

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        const jsonStr = text.slice(start, end + 1);
        parsed = JSON.parse(jsonStr);
      } else throw err;
    }

  const accuracy = Math.round(Number(parsed.accuracy ?? 0));
  const completeness = Math.round(Number(parsed.completeness ?? 0));
  const clarity = Math.round(Number(parsed.clarity ?? 0));
  const objectivity = Math.round(Number(parsed.objectivity ?? 0));
    let overall = Number(parsed.overall_score ?? NaN);
    if (Number.isNaN(overall)) {
      const totalWeight = (rubricWeights.accuracy || 0) + (rubricWeights.completeness || 0) + (rubricWeights.clarity || 0) + (rubricWeights.objectivity || 0) || 100;
      const wAcc = (rubricWeights.accuracy || 0) / totalWeight;
      const wComp = (rubricWeights.completeness || 0) / totalWeight;
      const wClar = (rubricWeights.clarity || 0) / totalWeight;
      const wObj = (rubricWeights.objectivity || 0) / totalWeight;
      overall = Math.round(accuracy * wAcc + completeness * wComp + clarity * wClar + objectivity * wObj);
    }

    const feedback = String(parsed.feedback ?? (parsed.comments ?? 'No feedback'));

    try {
      await db.sql`INSERT INTO ai_grades (student_id, exam_id, score, accuracy, completeness, clarity, objectivity, feedback, raw_response) VALUES (${studentId}, ${examId}, ${overall}, ${accuracy}, ${completeness}, ${clarity}, ${objectivity}, ${feedback}, ${text})`;
    } catch (dbErr) {
      console.error('[GRADER] Failed to save AI grade:', dbErr && dbErr.message ? dbErr.message : dbErr);
    }

    console.log('[GRADER] Grading complete for', studentId, examId, 'score:', overall);

    return { score: overall, feedback };
  } catch (err) {
    console.error('[GRADER] Error calling Gemini:', err && err.message ? err.message : err);
    try {
      await db.sql`INSERT INTO ai_grades (student_id, exam_id, score, feedback, raw_response) VALUES (${studentId}, ${examId}, ${0}, ${String(err && err.message ? err.message : err)}, ${String(err && err.stack ? err.stack : '')})`;
    } catch (dbErr) {
      console.error('[GRADER] Failed to save error grade:', dbErr && dbErr.message ? dbErr.message : dbErr);
    }
    throw err;
  }
}

function enqueueGrade(studentId, examId, teacherFindings, studentFindings) {
  GeminiQueue.add(() => gradeStudent(studentId, examId, teacherFindings, studentFindings));
}

module.exports = { gradeStudent, enqueueGrade };
