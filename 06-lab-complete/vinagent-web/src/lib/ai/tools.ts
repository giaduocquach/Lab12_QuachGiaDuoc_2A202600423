import { tool } from "@langchain/core/tools";
import { z } from "zod";
import scheduleData from "../mock/schedule.json";
import coursesData from "../mock/courses.json";
import prerequisitesData from "../mock/prerequisites.json";
import studentData from "../mock/student.json";
import curriculumData from "../mock/curriculum-cttt.json";

type GenericRecord = Record<string, unknown>;
type NormalizedScheduleEntry = {
  classId: string;
  courseCode: string;
  courseNameVi: string;
  courseNameEn: string;
  credits: number;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
  startHour: number;
  endHour: number;
  room: string;
  enrolled: number;
  capacity: number;
  slotsRemaining: number;
  session: string;
  semester: string;
  seatRisk: "high" | "medium" | "low";
};

function safeNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(",", ".").trim();
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function normalizeDay(raw: unknown): "Mon" | "Tue" | "Wed" | "Thu" | "Fri" {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "2" || v === "mon" || v === "monday") return "Mon";
  if (v === "3" || v === "tue" || v === "tuesday") return "Tue";
  if (v === "4" || v === "wed" || v === "wednesday") return "Wed";
  if (v === "5" || v === "thu" || v === "thursday") return "Thu";
  if (v === "6" || v === "fri" || v === "friday") return "Fri";
  return "Mon";
}

function normalizeCourse(record: GenericRecord) {
  const code = String(record.code ?? record.ma_hp ?? record.courseCode ?? "").trim();
  if (!code) return null;
  return {
    code,
    nameVi: String(record.nameVi ?? record.ten_hp ?? record.courseNameVi ?? record.name ?? code).trim(),
    nameEn: String(record.nameEn ?? record.courseNameEn ?? record.ten_hp ?? code).trim(),
    credits: safeNum(record.credits ?? record.tc_dt, 0),
    semester: String(record.semester ?? record.ky_hoc ?? "20252"),
    department: String(record.department ?? ""),
    description: String(record.description ?? ""),
  };
}

function normalizeTimeLabel(startHour: number, endHour: number): string {
  const toClock = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  };
  return `${toClock(startHour)}–${toClock(endHour)}`;
}

function normalizeScheduleEntry(record: GenericRecord): NormalizedScheduleEntry | null {
  const classId = String(record.classId ?? record["Mã_lớp"] ?? record["Ma_lop"] ?? "").trim();
  const courseCode = String(record.courseCode ?? record["Mã_HP"] ?? record["Ma_HP"] ?? "").trim();
  if (!classId || !courseCode) return null;

  const startHour = safeNum(record.startHour, NaN);
  const endHour = safeNum(record.endHour, NaN);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null;

  const capacity = safeNum(record.capacity ?? record["SL_Max"], 0);
  const enrolled = safeNum(record.enrolled ?? record["SLĐK"] ?? record["SL?K"], 0);
  if (capacity <= 0) return null;
  const slotsRemaining = safeNum(record.slotsRemaining, capacity - enrolled);
  const ratio = capacity > 0 ? slotsRemaining / capacity : 0;

  let seatRisk = String(record.seatRisk ?? "").trim().toLowerCase();
  if (!seatRisk) {
    if (slotsRemaining <= 5 || ratio <= 0.1) seatRisk = "high";
    else if (slotsRemaining <= 15 || ratio <= 0.25) seatRisk = "medium";
    else seatRisk = "low";
  }

  const session =
    String(record.session ?? "").trim() ||
    (startHour < 12 ? "morning" : "afternoon");

  return {
    classId,
    courseCode,
    courseNameVi: String(record.courseNameVi ?? record["Tên_HP"] ?? record["Ten_HP"] ?? courseCode).trim(),
    courseNameEn: String(record.courseNameEn ?? record["Tên_HP_Tiếng_Anh"] ?? record["Ten_HP_Tieng_Anh"] ?? courseCode).trim(),
    credits: safeNum(record.credits, 0),
    day: normalizeDay(record.day ?? record["Thứ"] ?? record["Thu"]),
    startHour,
    endHour,
    room: String(record.room ?? record["Phòng"] ?? record["Phong"] ?? "").trim(),
    enrolled,
    capacity,
    slotsRemaining,
    session,
    semester: String(record.semester ?? record["Kỳ"] ?? record["Ky"] ?? "20252").trim(),
    seatRisk: (seatRisk === "high" || seatRisk === "medium" || seatRisk === "low" ? seatRisk : "medium") as "high" | "medium" | "low",
  };
}

const normalizedCourses = (coursesData as GenericRecord[])
  .map(normalizeCourse)
  .filter((c): c is NonNullable<typeof c> => c !== null);

const normalizedSchedule: NormalizedScheduleEntry[] = (scheduleData as GenericRecord[])
  .map(normalizeScheduleEntry)
  .filter((s): s is NonNullable<typeof s> => s !== null);

const normalizedCurriculum = (curriculumData as GenericRecord[])
  .map((c) => ({
    ma_hp: String(c.ma_hp ?? c.code ?? "").trim(),
    ten_hp: String(c.ten_hp ?? c.nameVi ?? c.name ?? "").trim(),
    ky_hoc: c.ky_hoc == null ? null : safeNum(c.ky_hoc, 0),
    bat_buoc: c.bat_buoc,
    tc_dt: safeNum(c.tc_dt ?? c.credits, 0),
    ghi_chu_loai_hp: c.ghi_chu_loai_hp == null ? null : String(c.ghi_chu_loai_hp),
  }))
  .filter((c) => c.ma_hp.length > 0);

const searchableCourseMap = new Map<string, ReturnType<typeof normalizeCourse>>();
for (const c of normalizedCourses) {
  searchableCourseMap.set(c.code, c);
}
for (const c of normalizedCurriculum) {
  if (!searchableCourseMap.has(c.ma_hp)) {
    searchableCourseMap.set(c.ma_hp, {
      code: c.ma_hp,
      nameVi: c.ten_hp || c.ma_hp,
      nameEn: c.ten_hp || c.ma_hp,
      credits: c.tc_dt ?? 0,
      semester: c.ky_hoc == null ? "20252" : String(c.ky_hoc),
      department: "",
      description: "",
    });
  }
}
for (const s of normalizedSchedule) {
  if (!searchableCourseMap.has(s.courseCode)) {
    searchableCourseMap.set(s.courseCode, {
      code: s.courseCode,
      nameVi: s.courseNameVi || s.courseCode,
      nameEn: s.courseNameEn || s.courseCode,
      credits: s.credits ?? 0,
      semester: s.semester ?? "20252",
      department: "",
      description: "",
    });
  }
}
const searchableCourses = [...searchableCourseMap.values()].filter(
  (c): c is NonNullable<typeof c> => c !== null
);
const courseByCode = new Map(searchableCourses.map((c) => [c.code, c]));
const scheduleCourseCodeSet = new Set(normalizedSchedule.map((s) => s.courseCode));
const curriculumCourseCodeSet = new Set(normalizedCurriculum.map((c) => c.ma_hp));

const ROMAN_TO_ARABIC: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
};
const ARABIC_TO_ROMAN = new Map(
  Object.entries(ROMAN_TO_ARABIC).map(([roman, arabic]) => [arabic, roman])
);

function normalizeLooseText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function aliasVariants(input: string): string[] {
  const base = normalizeLooseText(input);
  if (!base) return [];
  const variants = new Set<string>([base]);
  const tokens = base.split(" ");
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (ROMAN_TO_ARABIC[t]) {
      const next = [...tokens];
      next[i] = ROMAN_TO_ARABIC[t];
      variants.add(next.join(" "));
    }
    const roman = ARABIC_TO_ROMAN.get(t);
    if (roman) {
      const next = [...tokens];
      next[i] = roman;
      variants.add(next.join(" "));
    }
  }
  return [...variants];
}

function tokensIncluded(haystack: string, needle: string): boolean {
  const hay = normalizeLooseText(haystack);
  const ned = normalizeLooseText(needle);
  if (!hay || !ned) return false;
  const hayTokens = new Set(hay.split(" ").filter(Boolean));
  const needTokens = ned.split(" ").filter(Boolean);
  return needTokens.length > 0 && needTokens.every((t) => hayTokens.has(t));
}

const STOP_TOKENS = new Set([
  "dai",
  "cuong",
  "clc",
  "he",
  "tin",
  "chi",
  "hoc",
  "phan",
  "co",
  "so",
  "nganh",
  "module",
]);

function acronymFromTokens(tokens: string[]): string {
  return tokens
    .filter((t) => !STOP_TOKENS.has(t))
    .map((t) => t[0])
    .join("");
}

function shortNameVariants(input: string): string[] {
  const base = normalizeLooseText(input);
  if (!base) return [];
  const tokens = base.split(" ").filter(Boolean);
  const compact = tokens.join(" ");
  const withoutStops = tokens.filter((t) => !STOP_TOKENS.has(t));
  const out = new Set<string>([compact]);
  if (withoutStops.length > 0) out.add(withoutStops.join(" "));
  const acr = acronymFromTokens(tokens);
  if (acr.length >= 2) out.add(acr);
  return [...out];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = i - 1;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      diag = saved;
    }
  }
  return prev[b.length];
}

function similarity(a: string, b: string): number {
  const aa = normalizeLooseText(a);
  const bb = normalizeLooseText(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  const dist = levenshtein(aa, bb);
  return 1 - dist / Math.max(aa.length, bb.length);
}

const aliasToCodes = new Map<string, string[]>();
function addAlias(alias: string, code: string) {
  if (!alias) return;
  const current = aliasToCodes.get(alias) ?? [];
  if (!current.includes(code)) current.push(code);
  aliasToCodes.set(alias, current);
}
for (const c of searchableCourses) {
  addAlias(normalizeLooseText(c.code), c.code);
  for (const v of aliasVariants(c.nameVi)) addAlias(v, c.code);
  for (const v of aliasVariants(c.nameEn)) addAlias(v, c.code);
  for (const v of shortNameVariants(c.nameVi)) addAlias(v, c.code);
  for (const v of shortNameVariants(c.nameEn)) addAlias(v, c.code);
}

const codeAliasSignatures = new Map<string, string[]>();
for (const c of searchableCourses) {
  const aliases = new Set<string>();
  aliases.add(normalizeLooseText(c.code));
  for (const v of aliasVariants(c.nameVi)) aliases.add(v);
  for (const v of aliasVariants(c.nameEn)) aliases.add(v);
  for (const v of shortNameVariants(c.nameVi)) aliases.add(v);
  for (const v of shortNameVariants(c.nameEn)) aliases.add(v);
  codeAliasSignatures.set(c.code, [...aliases].filter(Boolean));
}

const MANUAL_ALIAS_TO_CODE: Record<string, string[]> = {
  "giai tich ii": ["MI1124"],
  "giai tich 2": ["MI1124"],
  "vat ly ii": ["PH1120"],
  "vat ly 2": ["PH1120"],
  "vat ly dai cuong ii": ["PH1120"],
  "physics ii": ["PH1120"],
  "physics 2": ["PH1120"],
};

function resolveCourseCodes(inputs: string[]): {
  resolved: string[];
  unresolved: string[];
  inputToCode: Record<string, string>;
  ambiguous: Record<string, string[]>;
} {
  const resolved = new Set<string>();
  const unresolved: string[] = [];
  const inputToCode: Record<string, string> = {};
  const ambiguous: Record<string, string[]> = {};
  const fuzzyThreshold = 0.86;
  const fuzzyAmbiguousGap = 0.04;

  for (const raw of inputs) {
    const key = String(raw ?? "").trim();
    if (!key) continue;

    const compactCode = key.toUpperCase().replace(/\s+/g, "");
    let candidates: string[] = [];
    if (courseByCode.has(compactCode) || scheduleCourseCodeSet.has(compactCode)) {
      candidates = [compactCode];
    } else {
      const manual = MANUAL_ALIAS_TO_CODE[normalizeLooseText(key)];
      if (manual?.length) {
        candidates = [...manual];
      }
      const byAlias = new Set<string>();
      for (const v of aliasVariants(key)) {
        for (const c of aliasToCodes.get(v) ?? []) byAlias.add(c);
      }
      candidates = [...new Set([...candidates, ...byAlias])];
      if (candidates.length === 0) {
        for (const course of searchableCourses) {
          if (
            tokensIncluded(course.nameVi, key) ||
            tokensIncluded(course.nameEn, key) ||
            tokensIncluded(course.code, key)
          ) {
            candidates.push(course.code);
          }
        }
      }
    }

    if (candidates.length === 0) {
      // Last fallback: semantic token matching (useful for short forms like "vat ly ii")
      const normalizedQueryTokens = aliasVariants(key)
        .flatMap((v) => v.split(" "))
        .filter((t) => t && !STOP_TOKENS.has(t));
      const uniqueQueryTokens = [...new Set(normalizedQueryTokens)];
      if (uniqueQueryTokens.length > 0) {
        const semantic = searchableCourses
          .filter((course) => {
            const aliases = codeAliasSignatures.get(course.code) ?? [];
            const joined = aliases.join(" ");
            return uniqueQueryTokens.every((t) => joined.includes(t));
          })
          .map((c) => c.code);
        if (semantic.length > 0) {
          candidates = semantic;
        }
      }
    }

    if (candidates.length === 0) {
      const scored = searchableCourses
        .map((course) => {
          const aliases = codeAliasSignatures.get(course.code) ?? [];
          let best = 0;
          for (const v of aliasVariants(key)) {
            for (const alias of aliases) {
              const s = similarity(v, alias);
              if (s > best) best = s;
            }
          }
          return { code: course.code, score: best };
        })
        .filter((x) => x.score >= fuzzyThreshold)
        .sort((a, b) => b.score - a.score);
      candidates = scored.map((x) => x.code);

      if (scored.length > 1 && scored[0].score - scored[1].score < fuzzyAmbiguousGap) {
        ambiguous[key] = scored.slice(0, 3).map((x) => x.code);
      }
    }

    if (candidates.length === 0) {
      unresolved.push(key);
      continue;
    }

    candidates.sort((a, b) => {
      const aSched = scheduleCourseCodeSet.has(a) ? 1 : 0;
      const bSched = scheduleCourseCodeSet.has(b) ? 1 : 0;
      if (aSched !== bSched) return bSched - aSched;
      const aCurr = curriculumCourseCodeSet.has(a) ? 1 : 0;
      const bCurr = curriculumCourseCodeSet.has(b) ? 1 : 0;
      if (aCurr !== bCurr) return bCurr - aCurr;
      return a.localeCompare(b);
    });

    const chosen = candidates[0];
    resolved.add(chosen);
    inputToCode[key] = chosen;
  }

  return { resolved: [...resolved], unresolved, inputToCode, ambiguous };
}

function findScheduleFallbackCodes(code: string): string[] {
  if (scheduleCourseCodeSet.has(code)) return [code];
  const course = courseByCode.get(code);
  if (!course) return [];
  const candidates = new Set<string>();
  const aliasPool = new Set<string>([
    ...aliasVariants(course.nameVi),
    ...aliasVariants(course.nameEn),
    ...shortNameVariants(course.nameVi),
    ...shortNameVariants(course.nameEn),
  ]);
  for (const alias of aliasPool) {
    for (const c of aliasToCodes.get(alias) ?? []) {
      if (scheduleCourseCodeSet.has(c)) candidates.add(c);
    }
  }
  return [...candidates];
}

const STUDENT_PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;
let studentProfileCache: { at: number; payload: string } | null = null;

// ── Tool 1: Get Student Profile ──

export const getStudentProfileTool = tool(
  async () => {
    if (
      studentProfileCache &&
      Date.now() - studentProfileCache.at < STUDENT_PROFILE_CACHE_TTL_MS
    ) {
      return studentProfileCache.payload;
    }
    const payload = JSON.stringify({
      ...studentData,
      _citation: {
        type: "sis",
        title: "Hồ sơ sinh viên — HUST dk-sis",
        detail: `${studentData.name} (${studentData.id}), ${studentData.major} năm ${studentData.year}, GPA ${studentData.gpa}. Đã hoàn thành: ${studentData.completedCourses.join(", ")}.`,
      },
    });
    studentProfileCache = { at: Date.now(), payload };
    return payload;
  },
  {
    name: "get_student_profile",
    description:
      "Lấy thông tin sinh viên: mã SV, ngành, năm, GPA, môn đã hoàn thành, preferences, bạn cùng nhóm. Gọi đầu tiên để hiểu context sinh viên.",
    schema: z.object({}),
  }
);

// ── Tool 2: Search Courses ──

export const searchCoursesTool = tool(
  async ({ query }: { query?: string }) => {
    let results = searchableCourses;
    if (query) {
      const q = normalizeLooseText(query);
      const resolved = resolveCourseCodes([query]).resolved;
      results = searchableCourses.filter(
        (c) =>
          normalizeLooseText(c.code).includes(q) ||
          normalizeLooseText(c.nameVi).includes(q) ||
          normalizeLooseText(c.nameEn).includes(q) ||
          tokensIncluded(c.nameVi, q) ||
          tokensIncluded(c.nameEn, q) ||
          resolved.includes(c.code)
      );
    }
    return JSON.stringify({
      courses: results,
      total: results.length,
      semester: "20252",
      _citation: {
        type: "sis",
        title: "Danh mục môn học HK 20252 — HUST dk-sis",
        detail: `Tìm thấy ${results.length} môn học${query ? ` cho "${query}"` : ""}. Nguồn: Hệ thống đăng ký tín chỉ HUST.`,
      },
    });
  },
  {
    name: "search_courses",
    description:
      "Tìm kiếm các môn học có sẵn trong HK 20252. Có thể lọc theo mã môn hoặc từ khóa tên môn.",
    schema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "Từ khóa tìm kiếm (mã môn hoặc tên môn, ví dụ: 'IT3010E' hoặc 'cấu trúc dữ liệu')"
        ),
    }),
  }
);

// ── Tool 3: Check Schedule ──

export const checkScheduleTool = tool(
  async ({ course_codes }: { course_codes: string[] }) => {
    const resolved = resolveCourseCodes(course_codes);
    const fallbackMap: Record<string, string[]> = {};
    const codes = [...new Set(resolved.resolved.flatMap((code) => {
      const fallbacks = findScheduleFallbackCodes(code);
      if (!scheduleCourseCodeSet.has(code) && fallbacks.length > 0) {
        fallbackMap[code] = fallbacks;
      }
      return fallbacks.length > 0 ? fallbacks : [code];
    }))];
    const sections = normalizedSchedule.filter((s) =>
      codes.includes(s.courseCode)
    );
    const now = new Date().toLocaleString("vi-VN");
    const summary = sections.map((s) => {
      const slotsRemaining = s.slotsRemaining ?? (s.capacity - s.enrolled);
      return {
        classId: s.classId,
        courseCode: s.courseCode,
        name: s.courseNameVi,
        day: s.day,
        time: normalizeTimeLabel(s.startHour, s.endHour),
        room: s.room,
        seats: `${s.enrolled}/${s.capacity}`,
        slotsRemaining,
        seatRisk: s.seatRisk,
        session: s.session,
      };
    });

    const highRisk = sections.filter((s) => s.seatRisk === "high");
    const criticalSlots = summary.filter((s) => s.slotsRemaining <= 5);
    return JSON.stringify({
      sections: summary,
      total: summary.length,
      highRiskCount: highRisk.length,
      criticalSlotsCount: criticalSlots.length,
      ambiguousInputs: resolved.ambiguous,
      fallbackMap,
      timestamp: now,
      _citation: {
        type: "sis",
        title: `Dữ liệu chỗ ngồi HK 20252 — dk-sis (${now})`,
        detail: `${summary.length} lớp cho ${codes.join(", ")}.${Object.keys(fallbackMap).length > 0 ? ` Đã dùng mã tương đương có lịch mở: ${Object.entries(fallbackMap).map(([k, v]) => `${k} -> ${v.join("/")}`).join("; ")}.` : ""}${resolved.unresolved.length > 0 ? ` Không map được: ${resolved.unresolved.join(", ")}.` : ""}${Object.keys(resolved.ambiguous).length > 0 ? ` Có đầu vào mơ hồ: ${Object.entries(resolved.ambiguous).map(([k, v]) => `${k} -> ${v.join("/")}`).join("; ")}.` : ""} ${highRisk.length > 0 ? `⚠ ${highRisk.length} lớp nguy cơ hết chỗ.` : "Tất cả còn chỗ."} ${criticalSlots.length > 0 ? `${criticalSlots.length} lớp còn dưới 5 chỗ!` : ""} Cập nhật: ${now}.`,
      },
    });
  },
  {
    name: "check_schedule",
    description:
      "Xem lịch các lớp học (class sections) cho một hoặc nhiều mã môn. Trả về thời gian, phòng, số chỗ đã đăng ký/sức chứa, mức rủi ro hết chỗ.",
    schema: z.object({
      course_codes: z
        .array(z.string())
        .describe(
          "Danh sách mã môn cần kiểm tra, ví dụ: ['IT3010E', 'IT3020E']"
        ),
    }),
  }
);

// ── Tool 4: Check Prerequisites ──

export const checkPrerequisitesTool = tool(
  async ({ course_codes }: { course_codes: string[] }) => {
    const prereqs = prerequisitesData as Record<
      string,
      { required?: string[]; recommended?: string[]; note?: string }
    >;
    const completed = studentData.completedCourses;

    const resolved = resolveCourseCodes(course_codes);
    const results = resolved.resolved.map((code) => {
      const req = prereqs[code];
      if (!req)
        return {
          course: code,
          ok: true,
          missing: [],
          recommended: [],
          note: "Không có dữ liệu tiên quyết",
        };
      const required = Array.isArray(req.required) ? req.required : [];
      const recommended = Array.isArray(req.recommended) ? req.recommended : [];
      const missing = required.filter((r) => !completed.includes(r));
      const recMissing = recommended.filter((r) => !completed.includes(r));
      return {
        course: code,
        ok: missing.length === 0,
        missing,
        recommendedMissing: recMissing,
        note: req.note ?? "",
      };
    });

    const allOk = results.every((r) => r.ok);
    const failedCourses = results.filter((r) => !r.ok);

    return JSON.stringify({
      allOk,
      results,
      unresolved: resolved.unresolved,
      ambiguous: resolved.ambiguous,
      studentCompleted: completed,
      _citation: {
        type: "prerequisite",
        title: "Kiểm tra điều kiện tiên quyết — HUST dk-sis",
        detail: allOk
          ? `Sinh viên đã hoàn thành: ${completed.join(", ")}. Tất cả điều kiện tiên quyết cho ${resolved.resolved.join(", ")} đều đáp ứng.${resolved.unresolved.length > 0 ? ` Không map được: ${resolved.unresolved.join(", ")}.` : ""}${Object.keys(resolved.ambiguous).length > 0 ? ` Có đầu vào mơ hồ cần xác nhận.` : ""}`
          : `Thiếu tiên quyết: ${failedCourses.map((f) => `${f.course} (cần: ${f.missing.join(", ")})`).join("; ")}.${resolved.unresolved.length > 0 ? ` Không map được: ${resolved.unresolved.join(", ")}.` : ""}${Object.keys(resolved.ambiguous).length > 0 ? ` Có đầu vào mơ hồ cần xác nhận.` : ""}`,
      },
    });
  },
  {
    name: "check_prerequisites",
    description:
      "Kiểm tra điều kiện tiên quyết cho danh sách môn mục tiêu dựa trên hồ sơ sinh viên. Trả về môn nào thiếu tiên quyết.",
    schema: z.object({
      course_codes: z
        .array(z.string())
        .describe("Danh sách mã môn cần kiểm tra tiên quyết"),
    }),
  }
);

// ── Tool 5: Generate Schedule ──

function hasTimeConflict(a: NormalizedScheduleEntry, b: NormalizedScheduleEntry): boolean {
  if (a.day !== b.day) return false;
  return a.startHour < b.endHour && b.startHour < a.endHour;
}

export const generateScheduleTool = tool(
  async ({
    target_courses,
    avoid_morning = false,
    avoid_afternoon = false,
    prefer_group_friends = false,
  }: {
    target_courses: string[];
    avoid_morning?: boolean;
    avoid_afternoon?: boolean;
    prefer_group_friends?: boolean;
  }) => {
    const resolved = resolveCourseCodes(target_courses);
    const fallbackMap: Record<string, string[]> = {};
    const resolvedTargets = [...new Set(resolved.resolved.flatMap((code) => {
      const fallbacks = findScheduleFallbackCodes(code);
      if (!scheduleCourseCodeSet.has(code) && fallbacks.length > 0) {
        fallbackMap[code] = fallbacks;
      }
      return fallbacks.length > 0 ? fallbacks : [code];
    }))];
    const sectionsByCourse: Record<string, NormalizedScheduleEntry[]> = {};
    for (const code of resolvedTargets) {
      let sections = normalizedSchedule.filter((s) => s.courseCode === code);
      // Do not allow closed classes in generated plans.
      sections = sections.filter((s) => (s.slotsRemaining ?? (s.capacity - s.enrolled)) > 0);
      if (avoid_morning) sections = sections.filter((s) => s.startHour >= 9.5);
      if (avoid_afternoon) sections = sections.filter((s) => s.startHour < 14);
      sectionsByCourse[code] = sections;
    }

    function scorePlan(plan: NormalizedScheduleEntry[]): number {
      let score = 100;
      for (const s of plan) {
        const ratio = s.enrolled / s.capacity;
        if (ratio > 0.95) score -= 20;
        else if (ratio > 0.85) score -= 10;
        else if (ratio > 0.7) score -= 5;
        if (prefer_group_friends && s.enrolled > 80) score += 5;
      }
      return score;
    }

    function buildPlan(preferLowRisk: boolean): NormalizedScheduleEntry[] | null {
      const plan: NormalizedScheduleEntry[] = [];
      for (const code of resolvedTargets) {
        let candidates = sectionsByCourse[code] || [];
        if (candidates.length === 0) continue;

        candidates = [...candidates].sort((a, b) =>
          preferLowRisk
            ? a.enrolled / a.capacity - b.enrolled / b.capacity
            : b.enrolled / b.capacity - a.enrolled / a.capacity
        );

        let placed = false;
        for (const candidate of candidates) {
          if (!plan.some((p) => hasTimeConflict(p, candidate))) {
            plan.push(candidate);
            placed = true;
            break;
          }
        }
        if (!placed) {
          for (const candidate of candidates) {
            if (!plan.some((p) => hasTimeConflict(p, candidate))) {
              plan.push(candidate);
              break;
            }
          }
        }
      }
      return plan.length === resolvedTargets.length ? plan : null;
    }

    const planA = buildPlan(true);
    const planB = buildPlan(false);

    const formatPlan = (plan: NormalizedScheduleEntry[] | null) =>
      plan?.map((s) => ({
        code: s.courseCode,
        name: s.courseNameVi,
        day: s.day,
        startHour: s.startHour,
        endHour: s.endHour,
        room: s.room,
        enrolled: s.enrolled,
        capacity: s.capacity,
        slotsRemaining: s.capacity - s.enrolled,
        vacancyText: `còn ${Math.max(0, s.capacity - s.enrolled)}/${s.capacity} chỗ trống`,
        seatRisk: s.seatRisk,
        classId: s.classId,
      })) ?? null;

    return JSON.stringify({
      planA: formatPlan(planA),
      planB: formatPlan(planB),
      planAScore: planA ? scorePlan(planA) : 0,
      planBScore: planB ? scorePlan(planB) : 0,
      targetCourses: resolvedTargets,
      unresolvedTargets: resolved.unresolved,
      inputToCode: resolved.inputToCode,
      ambiguousTargets: resolved.ambiguous,
      fallbackMap,
      constraints: { avoid_morning, avoid_afternoon, prefer_group_friends },
      _citation: {
        type: "sis",
        title: "Thuật toán xếp lịch — BKAgent Scheduler",
        detail: `Đã tạo ${planA ? "Plan A" : ""}${planA && planB ? " + " : ""}${planB ? "Plan B" : ""} cho ${resolvedTargets.join(", ")}.${Object.keys(fallbackMap).length > 0 ? ` Dùng mã tương đương có lịch mở: ${Object.entries(fallbackMap as Record<string, string[]>).map(([k, v]) => `${k} -> ${v.join("/")}`).join("; ")}.` : ""}${resolved.unresolved.length > 0 ? ` Không map được: ${resolved.unresolved.join(", ")}.` : ""}${Object.keys(resolved.ambiguous).length > 0 ? ` Có đầu vào mơ hồ cần xác nhận.` : ""} Dữ liệu: TKB20252-FULL, ${normalizedSchedule.length} lớp.`,
      },
    });
  },
  {
    name: "generate_schedule",
    description:
      "Tự động tạo Plan A (tối ưu) và Plan B (dự phòng) từ danh sách môn mục tiêu. Xét ràng buộc: không xung đột thời gian, ưu tiên chỗ ngồi còn nhiều, tuân thủ preferences sinh viên.",
    schema: z.object({
      target_courses: z
        .array(z.string())
        .describe("Danh sách mã môn cần xếp lịch"),
      avoid_morning: z
        .boolean()
        .optional()
        .describe("Tránh lớp buổi sáng (trước 9h30)"),
      avoid_afternoon: z
        .boolean()
        .optional()
        .describe("Tránh lớp buổi chiều (sau 14h)"),
      prefer_group_friends: z
        .boolean()
        .optional()
        .describe("Ưu tiên lớp đông (khả năng cao cùng nhóm bạn)"),
    }),
  }
);

// ── Tool 6: Get Recommended Courses from Curriculum ──

type CurriculumEntry = {
  ma_hp: string;
  ten_hp: string;
  ky_hoc: number | null;
  bat_buoc: boolean | string;
  tc_dt: number;
  ghi_chu_loai_hp: string | null;
};

export const getRecommendedCoursesTool = tool(
  async () => {
    const student = studentData;
    // Map year + current semester to curriculum semester number
    // "20252" = spring semester → year 2 spring = semester 4
    const semCode = student.currentSemester ?? "20252";
    const isSpring = semCode.endsWith("2");
    const semNum = student.year === 1
      ? (isSpring ? 2 : 1)
      : student.year === 2
        ? (isSpring ? 4 : 3)
        : student.year * 2;

    const curriculum = normalizedCurriculum as CurriculumEntry[];

    const toRequirement = (v: CurriculumEntry["bat_buoc"]) => {
      if (v === true || String(v).toLowerCase() === "true" || String(v) === "1") return "mandatory";
      if (v === false || String(v).toLowerCase() === "false" || String(v) === "0") return "optional";
      if (String(v).toLowerCase() === "chon_module") return "module";
      return "optional";
    };

    const mandatory = curriculum.filter((c) => c.ky_hoc === semNum && toRequirement(c.bat_buoc) === "mandatory");
    const optional = curriculum.filter((c) => c.ky_hoc === semNum && toRequirement(c.bat_buoc) === "optional");
    const moduleChoice = curriculum.filter((c) => c.ky_hoc === semNum && toRequirement(c.bat_buoc) === "module");

    // Filter out already completed courses
    const completed = student.completedCourses;
    const mandatoryPending = mandatory.filter((c) => !completed.includes(c.ma_hp));
    const scheduleCourseSet = new Set(normalizedSchedule.map((s) => s.courseCode));
    const mandatoryPendingAvailable = mandatoryPending.filter((c) =>
      scheduleCourseSet.has(c.ma_hp)
    );
    const mandatoryPendingNoSchedule = mandatoryPending.filter(
      (c) => !scheduleCourseSet.has(c.ma_hp)
    );
    const mandatoryCodeSet = new Set(mandatoryPendingAvailable.map((c) => c.ma_hp));

    // Keep default semester flow, but append student personal targets
    // that are not completed and currently have open sections.
    const personalTargets = Array.isArray((student as GenericRecord).targetCourses)
      ? ((student as GenericRecord).targetCourses as unknown[]).map((v) => String(v).trim()).filter(Boolean)
      : [];
    const personalTargetsAvailable = personalTargets
      .filter((code) => !completed.includes(code))
      .filter((code) => scheduleCourseSet.has(code))
      .filter((code) => !mandatoryCodeSet.has(code))
      .map((code) => {
        const fromCurriculum = curriculum.find((c) => c.ma_hp === code);
        const fromCatalog = searchableCourses.find((c) => c.code === code);
        return {
          code,
          name: fromCurriculum?.ten_hp ?? fromCatalog?.nameVi ?? code,
          credits: fromCurriculum?.tc_dt ?? fromCatalog?.credits ?? 0,
          type: "Ưu tiên cá nhân",
        };
      });

    return JSON.stringify({
      semNum,
      studentYear: student.year,
      currentSemester: semCode,
      mandatoryPending: [
        ...mandatoryPendingAvailable.map((c) => ({
          code: c.ma_hp,
          name: c.ten_hp,
          credits: c.tc_dt,
          type: c.ghi_chu_loai_hp,
        })),
        ...personalTargetsAvailable,
      ],
      personalTargetsAvailable,
      mandatoryPendingNoSchedule: mandatoryPendingNoSchedule.map((c) => ({
        code: c.ma_hp,
        name: c.ten_hp,
        credits: c.tc_dt,
      })),
      mandatory: mandatory.map((c) => ({ code: c.ma_hp, name: c.ten_hp, credits: c.tc_dt })),
      optional: optional.map((c) => ({ code: c.ma_hp, name: c.ten_hp, credits: c.tc_dt })),
      moduleChoice: moduleChoice.map((c) => ({ code: c.ma_hp, name: c.ten_hp, credits: c.tc_dt, note: c.ghi_chu_loai_hp })),
      totalMandatoryCredits: mandatoryPendingAvailable.reduce((s, c) => s + (c.tc_dt || 0), 0),
      _citation: {
        type: "sis",
        title: `CTĐT CTTT — Học kỳ ${semNum} (HK ${semCode})`,
        detail: `Sinh viên năm ${student.year}: ${mandatoryPendingAvailable.length} môn bắt buộc có lớp mở (${mandatoryPendingAvailable.map((c) => c.ma_hp).join(", ")}).${personalTargetsAvailable.length > 0 ? ` Ưu tiên cá nhân có lớp mở: ${personalTargetsAvailable.map((c) => c.code).join(", ")}.` : ""}${mandatoryPendingNoSchedule.length > 0 ? ` ${mandatoryPendingNoSchedule.length} môn chưa có lớp mở: ${mandatoryPendingNoSchedule.map((c) => c.ma_hp).join(", ")}.` : ""} Nguồn: Chương trình đào tạo CTTT HUST.`,
      },
    });
  },
  {
    name: "get_recommended_courses",
    description:
      "Lấy danh sách môn học gợi ý theo chương trình đào tạo (CTĐT) của sinh viên cho học kỳ hiện tại. Gọi khi sinh viên chưa nêu môn cụ thể.",
    schema: z.object({}),
  }
);

// ── Export all tools ──

export const allTools = [
  getStudentProfileTool,
  getRecommendedCoursesTool,
  searchCoursesTool,
  checkScheduleTool,
  checkPrerequisitesTool,
  generateScheduleTool,
];
