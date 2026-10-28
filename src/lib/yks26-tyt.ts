import { answerTotals } from "@/app/yks27/tyt/data";

// TYT exam results transcribed from the supplied YKS26 result image.
// Placement scores (Y-TYT) and other exam types are deliberately excluded.
export const yks26Tyt = {
  score: 310.78679,
  rank: 351054,
  // Participant count supplied by the user from their source.
  participants: 2255076,
  subjects: [
    { correct: 29, incorrect: 5, questions: 40 },
    { correct: 6, incorrect: 4, questions: 20 },
    { correct: 13, incorrect: 1, questions: 40 },
    { correct: 12, incorrect: 5, questions: 20 },
  ],
};
export const yks26TytNet = yks26Tyt.subjects.reduce((sum, subject) => sum + answerTotals(subject.correct, subject.incorrect, subject.questions).net!, 0);
export const yks26TytOutperformed = (1 - yks26Tyt.rank / yks26Tyt.participants) * 100;
