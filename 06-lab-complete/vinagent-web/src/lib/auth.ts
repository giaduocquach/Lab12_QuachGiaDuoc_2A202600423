import {
  getStudentById as getStudentByIdFromData,
  type StudentProfile,
} from "@/lib/student-data";

const SESSION_KEY = "bkagent.currentUser";

export type AuthResult = {
  ok: boolean;
  message: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getStudentById(studentId: string): StudentProfile | null {
  return getStudentByIdFromData(studentId);
}

export function loginAccount(studentId: string, password: string): AuthResult {
  const normalizedId = studentId.trim();
  const normalizedPassword = password.trim();

  if (!normalizedId || !normalizedPassword) {
    return { ok: false, message: "Vui lòng nhập đầy đủ MSSV và mật khẩu." };
  }

  const student = getStudentById(normalizedId);
  if (!student) {
    return { ok: false, message: "Mã sinh viên không tồn tại trong hệ thống HUST." };
  }

  // Demo auth policy: all accounts use default password "1"
  if (normalizedPassword !== "1") {
    return { ok: false, message: "Mật khẩu không đúng. Password mặc định cho demo là 1." };
  }

  if (isBrowser()) {
    window.localStorage.setItem(SESSION_KEY, normalizedId);
  }

  return { ok: true, message: "Đăng nhập thành công. Xin chào, " + student.name + "!" };
}

export function logoutAccount() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function getCurrentStudent(): StudentProfile | null {
  if (!isBrowser()) return null;
  const currentId = window.localStorage.getItem(SESSION_KEY);
  if (!currentId) return null;
  return getStudentById(currentId);
}

export function verifyCurrentStudent(): AuthResult {
  const student = getCurrentStudent();
  if (!student) {
    return { ok: false, message: "Chưa có phiên đăng nhập hợp lệ." };
  }

  const source = getStudentById(student.id);
  const valid = Boolean(source && source.name === student.name);
  if (!valid) {
    return { ok: false, message: "Thông tin người dùng không khớp dữ liệu gốc." };
  }

  return { ok: true, message: "Xác thực thành công. Dữ liệu hợp lệ với hệ thống HUST." };
}
