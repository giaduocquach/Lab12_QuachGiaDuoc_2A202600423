import studentJson from "@/lib/mock/student.json";

export type StudentProfile = {
  id: string;
  password?: string;
  name: string;
  major: string;
  program?: string;
  year: number;
  gpa: number;
  currentSemester: string;
  completedCourses: string[];
  inProgressCourses?: string[];
  targetCourses?: string[];
  preferences?: {
    avoidMorning?: boolean;
    avoidAfternoon?: boolean;
    preferGroupFriends?: boolean;
    priorityDays?: string[];
    maxCreditsPerSemester?: number;
  };
  groupFriends?: { id: string; name: string }[];
  advisorId?: string;
  advisorName?: string;
};

type StudentJsonShape = {
  currentStudentId?: string;
  students?: StudentProfile[];
} & Partial<StudentProfile>;

const data = studentJson as unknown as StudentJsonShape;

export function getStudentById(studentId: string): StudentProfile | null {
  // Check the students[] array first
  if (data.students) {
    const found = data.students.find((s) => s.id === studentId);
    if (found) return found;
  }

  // Fall back to flat fields for single-student JSON
  if (data.id === studentId) {
    const { students: _s, currentStudentId: _c, ...flat } = data;
    return flat as StudentProfile;
  }

  return null;
}

export function getCurrentStudentId(): string | null {
  return data.currentStudentId ?? null;
}

export function getDefaultStudent(): StudentProfile | null {
  const defaultId = data.currentStudentId ?? data.id;
  if (!defaultId) return null;
  return getStudentById(defaultId);
}
