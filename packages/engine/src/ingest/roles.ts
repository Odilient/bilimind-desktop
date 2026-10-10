// File role heuristic (PLAN §2.3 roles.ts): scored signals from the text and the file name, so a lecture deck with one
// "Learning outcomes" slide stays a lecture and an exam paper with "Question 1 (15 marks)" becomes a past paper.
import type { FileRole } from '@bilimind/core';
import type { DetectRole } from '../contracts.ts';

const count = (re: RegExp, text: string): number => (text.match(re) ?? []).length;

export interface RoleScores { past_paper: number; syllabus: number; sop: number; lecture: number }

export function roleScores(name: string, text: string): RoleScores {
  const t = text.slice(0, 60_000);
  const n = name.toLowerCase();
  const s: RoleScores = { past_paper: 0, syllabus: 0, sop: 0, lecture: 0 };

  // Past paper: questions with marks, exam rubric.
  const questions = count(/\b(?:question|soalan)\s*\d+\b|^\s*Q\d+[.):\s]/gim, t);
  const marks = count(/[[(]\s*\d+\s*(?:marks?|markah|pts?|points?)\s*[\])]|\b\d+\s*marks\b/gi, t);
  s.past_paper += Math.min(questions, 6) * 1.5 + Math.min(marks, 10);
  if (/\banswer\s+(?:all|any)\b/i.test(t)) s.past_paper += 4;
  if (/\btime\s+allowed\b|\bduration\s*:\s*\d/i.test(t)) s.past_paper += 4;
  if (/\binstructions?\s+to\s+candidates\b|\btotal\s+marks\b|\bexamination\b|\bdo not turn this page\b/i.test(t)) s.past_paper += 3;
  if (/past[-_ ]?(?:year|paper)|\bexam\b|final[-_ ]?exam|mid[-_ ]?term|\bquiz\b|\btest\b|\bpaper\b/.test(n)) s.past_paper += 4;

  // Syllabus / course outline.
  s.syllabus += Math.min(count(/\blearning\s+outcomes?\b|\bCLO\s*\d*\b|\bcourse\s+learning\b/gi, t), 4) * 1.5;
  if (/\bcredit\s+hours?\b|\bsynopsis\b|\bassessment\s+(?:breakdown|weight|plan)\b|\bweekly\s+(?:schedule|plan)\b|\bprerequisites?\b/i.test(t)) s.syllabus += 3;
  if (/syllabus|course[-_ ]?(?:outline|info|guide)|module[-_ ]?(?:outline|descriptor)|handbook/.test(n)) s.syllabus += 5;

  // SOP / workplace procedure.
  s.sop += Math.min(count(/\bSOP\b|standard\s+operating\s+procedure/gi, t), 4) * 2;
  s.sop += Math.min(count(/\bprocedures?\b/gi, t), 4) * 0.75;
  s.sop += Math.min(count(/\bshifts?\b|\bcrew\b|\bchecklist\b|\bopening\b|\bclosing\b|\bstaff\b|\bmanager\b/gi, t), 8) * 0.5;
  if (/\bsop\b|procedure|onboarding|manual|playbook|policy/.test(n.replace(/[-_.]/g, ' '))) s.sop += 5;

  // Lecture material.
  if (/lecture|lect|slides?|week|chapter|\bl\d{1,2}\b|notes|tutorial|deck/.test(n.replace(/[-_.]/g, ' '))) s.lecture += 4;
  s.lecture += Math.min(count(/\blecture\b|\bslide\b|\bweek\s+\d+\b/gi, t), 6) * 0.5;
  return s;
}

/** Heuristic role. Ties and weak signals default to 'lecture' (the material to learn from). */
export const detectRole: DetectRole = (name, text) => {
  const s = roleScores(name, text);
  if (s.past_paper >= 8 && s.past_paper >= s.lecture + 3 && s.past_paper >= s.sop) return 'past_paper';
  if (s.sop >= 6 && s.sop > s.syllabus && s.sop >= s.lecture) return 'sop';
  if (s.syllabus >= 6 && s.syllabus > s.lecture + 1) return 'syllabus';
  return 'lecture' satisfies FileRole;
};
