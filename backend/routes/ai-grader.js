const express = require('express');
const router = express.Router();
const { enqueueGrade } = require('../geminiGrader');
const db = require('../db');

// POST /api/ai-grader/submit
// Enqueue a job into the DB-backed ai_queue
router.post('/submit', async (req, res) => {

  try {
    const { studentId, examId, studentFindings, teacherFindings: reqTeacherFindings } = req.body;
    // Prefer teacherFindings sent by the frontend. If it's JSON, try to extract explanation text.
    let teacherFindings = '';
    if (reqTeacherFindings && String(reqTeacherFindings).trim()) {
      try {
        const maybe = typeof reqTeacherFindings === 'string' ? JSON.parse(reqTeacherFindings) : reqTeacherFindings;
        if (maybe) {
          // Try common shapes: { explanation: { text: '...' } } or { explanation: '...' }
          if (maybe.explanation && typeof maybe.explanation === 'object' && maybe.explanation.text) {
            teacherFindings = String(maybe.explanation.text);
          } else if (maybe.explanation && typeof maybe.explanation === 'string') {
            teacherFindings = String(maybe.explanation);
          } else if (typeof maybe === 'string') {
            teacherFindings = String(maybe);
          } else {
            // Fallback to JSON-stringified form
            teacherFindings = JSON.stringify(maybe);
          }
        }
      } catch (e) {
        // Not JSON, use as-is
        teacherFindings = String(reqTeacherFindings);
      }
    }

    // If still empty, fallback to loading from DB (question.explanation or answer.explanation.text)
    if (!teacherFindings || !teacherFindings.trim()) {
      try {
        const examRow = await db.sql`SELECT * FROM exams WHERE id = ${examId} LIMIT 1`;
        const exam = Array.isArray(examRow) ? examRow[0] : examRow;
        if (exam && exam.question_id) {
          const qRow = await db.sql`SELECT * FROM questions WHERE id = ${exam.question_id} LIMIT 1`;
          const question = Array.isArray(qRow) ? qRow[0] : qRow;
          if (question) {
            if (question.explanation && String(question.explanation).trim()) {
              teacherFindings = question.explanation;
            } else if (question.answer) {
              try {
                const answerObj = typeof question.answer === 'string' ? JSON.parse(question.answer) : question.answer;
                if (answerObj && answerObj.explanation && answerObj.explanation.text) {
                  teacherFindings = answerObj.explanation.text;
                } else if (answerObj && answerObj.explanation && typeof answerObj.explanation === 'string') {
                  teacherFindings = answerObj.explanation;
                }
              } catch (jsonErr) {
                // ignore parse errors
              }
            }
          }
        }
      } catch (e) {
        console.error('[AI-GRADER][SUBMIT] Could not load instructor explanation from DB:', e && e.message ? e.message : e);
      }
    }

    // Insert job as pending
    await db.sql`INSERT INTO ai_queue (student_id, exam_id, teacher_findings, student_findings, status) VALUES (${Number(studentId)}, ${Number(examId)}, ${String(teacherFindings)}, ${String(studentFindings)}, 'pending')`;

    // Try to process immediately to avoid needing an external scheduler or token.
    try {
      // find the inserted job id
      const inserted = await db.sql`SELECT id FROM ai_queue WHERE student_id = ${Number(studentId)} AND exam_id = ${Number(examId)} ORDER BY id DESC LIMIT 1`;
      const jobRow = Array.isArray(inserted) ? inserted[0] : inserted;
      const jobId = jobRow ? jobRow.id : null;

      if (jobId) {
        await db.sql`UPDATE ai_queue SET status = 'processing', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ${jobId}`;
      }

      const grader = require('../geminiGrader');
      await grader.gradeStudent(Number(studentId), Number(examId), teacherFindings || '', studentFindings || '');

      if (jobId) {
        await db.sql`UPDATE ai_queue SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = ${jobId}`;
      }
    } catch (processErr) {
      console.error('[AI-GRADER][SUBMIT][PROCESS] Error processing immediately:', processErr && processErr.message ? processErr.message : processErr);
      // mark the job as error so it can be retried later
      try {
        await db.sql`UPDATE ai_queue SET status = 'error', last_error = ${String(processErr && processErr.message ? processErr.message : processErr)}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${Number(studentId)} AND exam_id = ${Number(examId)} AND status = 'processing'`;
      } catch (e) {
        console.error('[AI-GRADER][SUBMIT] Failed to mark job error:', e && e.message ? e.message : e);
      }
    }

    res.json({ message: "Submitted! AI grading attempted immediately; results will appear once saved." });
  } catch (err) {
    console.error('[AI-GRADER][SUBMIT] Error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to submit for AI grading' });
  }
});

// POST /api/ai-grader/process-pending
// Process up to `limit` pending jobs (default 1). Intended to be called by a scheduler.
router.post('/process-pending', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 1);

    // Select pending jobs and lock them by marking processing (simple approach)
    const pending = await db.sql`SELECT * FROM ai_queue WHERE status = 'pending' ORDER BY id ASC LIMIT ${limit}`;
    const jobs = Array.isArray(pending) ? pending : (pending ? [pending] : []);

    if (!jobs || jobs.length === 0) {
      return res.json({ processed: 0 });
    }

    let processed = 0;

    for (const job of jobs) {
      try {
        // Mark processing
        await db.sql`UPDATE ai_queue SET status = 'processing', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ${job.id}`;

        // Call gradeStudent (this will write to ai_grades)
        const grader = require('../geminiGrader');
        await grader.gradeStudent(job.student_id, job.exam_id, job.teacher_findings || '', job.student_findings || '');

        // Mark done
        await db.sql`UPDATE ai_queue SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = ${job.id}`;
        processed++;
      } catch (jobErr) {
        console.error('[AI-GRADER][PROCESS] Job error id=', job.id, jobErr && jobErr.message ? jobErr.message : jobErr);
        await db.sql`UPDATE ai_queue SET status = 'error', last_error = ${String(jobErr && jobErr.message ? jobErr.message : jobErr)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${job.id}`;
      }
    }

    res.json({ processed });
  } catch (err) {
    console.error('[AI-GRADER][PROCESS-PENDING] Error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to process pending AI grading jobs' });
  }
});

// POST /api/ai-grader/backfill
// Backfill ai_grades rows where component rubrics are missing or zero using exam/question rubrics.
router.post('/backfill', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 1000);

    const rows = await db.sql`SELECT * FROM ai_grades WHERE (accuracy IS NULL OR accuracy = 0) AND (completeness IS NULL OR completeness = 0) AND (clarity IS NULL OR clarity = 0) AND (objectivity IS NULL OR objectivity = 0) AND score > 0 ORDER BY id ASC LIMIT ${limit}`;
    const list = Array.isArray(rows) ? rows : (rows ? [rows] : []);

    let updated = 0;

    for (const row of list) {
      try {
        // defaults
        let weights = { accuracy: 40, completeness: 30, clarity: 20, objectivity: 10 };

        // Try to load exam -> question -> rubrics
        const examRow = await db.sql`SELECT * FROM exams WHERE id = ${row.exam_id} LIMIT 1`;
        const exam = Array.isArray(examRow) ? examRow[0] : examRow;
        if (exam && exam.question_id) {
          const qRow = await db.sql`SELECT rubrics FROM questions WHERE id = ${exam.question_id} LIMIT 1`;
          const q = Array.isArray(qRow) ? qRow[0] : qRow;
          if (q && q.rubrics) {
            try {
              const parsed = typeof q.rubrics === 'string' ? JSON.parse(q.rubrics) : q.rubrics;
              weights = {
                accuracy: Number(parsed.accuracy ?? weights.accuracy),
                completeness: Number(parsed.completeness ?? weights.completeness),
                clarity: Number(parsed.clarity ?? weights.clarity),
                objectivity: Number(parsed.objectivity ?? weights.objectivity),
              };
            } catch (e) {
              // ignore parse errors
            }
          }
        }

        const totalWeight = (weights.accuracy || 0) + (weights.completeness || 0) + (weights.clarity || 0) + (weights.objectivity || 0) || 100;
        const acc = Math.round(row.score * (weights.accuracy || 0) / totalWeight);
        const comp = Math.round(row.score * (weights.completeness || 0) / totalWeight);
        const clar = Math.round(row.score * (weights.clarity || 0) / totalWeight);
        const obj = Math.round(row.score * (weights.objectivity || 0) / totalWeight);

        await db.sql`UPDATE ai_grades SET accuracy = ${acc}, completeness = ${comp}, clarity = ${clar}, objectivity = ${obj} WHERE id = ${row.id}`;
        updated++;
      } catch (e) {
        console.error('[AI-GRADER][BACKFILL] Failed row id=', row.id, e && e.message ? e.message : e);
      }
    }

    res.json({ scanned: list.length, updated });
  } catch (err) {
    console.error('[AI-GRADER][BACKFILL] Error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to run backfill' });
  }
});

module.exports = router;

// GET /api/ai-grader/result/:studentId/:examId - returns latest ai grade for student and exam
router.get('/result/:studentId/:examId', async (req, res) => {
  try {
    const { studentId, examId } = req.params;
    const row = await db.sql`SELECT * FROM ai_grades WHERE student_id = ${Number(studentId)} AND exam_id = ${Number(examId)} ORDER BY id DESC LIMIT 1`;
    // db.sql returns an array-like object; coerce
    const result = Array.isArray(row) ? row[0] : row;
    if (!result) return res.status(404).json({ error: 'No AI grade found' });
    res.json(result);
  } catch (err) {
    console.error('[AI-GRADER][GET-RESULT] Error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch AI grade' });
  }
});
