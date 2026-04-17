"""BKAgent scheduling logic packaged from a previous project (Lab5-6)."""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any


DATA_DIR = Path(__file__).resolve().parent / "vinagent_data"
CODE_PATTERN = re.compile(r"\b[A-Z]{2,4}\d{3,4}[A-Z]?\b")


@dataclass
class Catalog:
    courses_by_code: dict[str, dict[str, Any]]
    schedule_by_code: dict[str, list[dict[str, Any]]]
    prerequisites: dict[str, dict[str, Any]]
    students_by_id: dict[str, dict[str, Any]]
    default_student: dict[str, Any] | None


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _normalize(text: str) -> str:
    lowered = _strip_accents(text).lower()
    lowered = re.sub(r"[^a-z0-9]+", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


@lru_cache(maxsize=8)
def _read_json(name: str) -> Any:
    with (DATA_DIR / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def load_catalog() -> Catalog:
    courses = _read_json("courses.json")
    curriculum = _read_json("curriculum-cttt.json")
    schedule = _read_json("schedule.json")
    prerequisites = _read_json("prerequisites.json")
    student_blob = _read_json("student.json")

    courses_by_code: dict[str, dict[str, Any]] = {}
    for item in courses:
        code = str(item.get("code", "")).strip().upper()
        if not code:
            continue
        courses_by_code[code] = {
            "code": code,
            "nameVi": str(item.get("nameVi", code)),
            "nameEn": str(item.get("nameEn", code)),
            "credits": int(item.get("credits", 0) or 0),
            "semester": str(item.get("semester", "20252")),
        }

    for item in curriculum:
        code = str(item.get("ma_hp", "")).strip().upper()
        if not code:
            continue
        if code not in courses_by_code:
            courses_by_code[code] = {
                "code": code,
                "nameVi": str(item.get("ten_hp", code)),
                "nameEn": str(item.get("ten_hp", code)),
                "credits": int(item.get("tc_dt", 0) or 0),
                "semester": str(item.get("ky_hoc", "20252") or "20252"),
            }

    schedule_by_code: dict[str, list[dict[str, Any]]] = {}
    for row in schedule:
        code = str(row.get("courseCode", "")).strip().upper()
        if not code:
            continue
        row_copy = {
            "classId": str(row.get("classId", "")),
            "courseCode": code,
            "courseNameVi": str(row.get("courseNameVi", code)),
            "day": str(row.get("day", "Mon")),
            "startHour": float(row.get("startHour", 0) or 0),
            "endHour": float(row.get("endHour", 0) or 0),
            "room": str(row.get("room", "")),
            "slotsRemaining": int(row.get("slotsRemaining", 0) or 0),
            "capacity": int(row.get("capacity", 0) or 0),
            "seatRisk": str(row.get("seatRisk", "medium") or "medium"),
        }
        schedule_by_code.setdefault(code, []).append(row_copy)

    for code, classes in schedule_by_code.items():
        classes.sort(
            key=lambda it: (
                _risk_rank(it.get("seatRisk", "medium")),
                -(it.get("slotsRemaining", 0) or 0),
            )
        )
        if code not in courses_by_code and classes:
            first = classes[0]
            courses_by_code[code] = {
                "code": code,
                "nameVi": first.get("courseNameVi", code),
                "nameEn": first.get("courseNameVi", code),
                "credits": 0,
                "semester": "20252",
            }

    students_by_id: dict[str, dict[str, Any]] = {}
    default_student: dict[str, Any] | None = None

    if isinstance(student_blob, dict):
        if "students" in student_blob and isinstance(student_blob["students"], list):
            for item in student_blob["students"]:
                student_id = str(item.get("id", "")).strip()
                if student_id:
                    students_by_id[student_id] = item
            current = str(student_blob.get("currentStudentId", "")).strip()
            if current and current in students_by_id:
                default_student = students_by_id[current]

        root_id = str(student_blob.get("id", "")).strip()
        if root_id and root_id not in students_by_id:
            students_by_id[root_id] = student_blob

    if default_student is None and students_by_id:
        default_student = next(iter(students_by_id.values()))

    return Catalog(
        courses_by_code=courses_by_code,
        schedule_by_code=schedule_by_code,
        prerequisites=prerequisites,
        students_by_id=students_by_id,
        default_student=default_student,
    )


def _risk_rank(seat_risk: str) -> int:
    risk = str(seat_risk).lower()
    if risk == "low":
        return 0
    if risk == "medium":
        return 1
    return 2


def _class_conflict(a: dict[str, Any], b: dict[str, Any]) -> bool:
    if a.get("day") != b.get("day"):
        return False
    return not (
        float(a.get("endHour", 0)) <= float(b.get("startHour", 0))
        or float(b.get("endHour", 0)) <= float(a.get("startHour", 0))
    )


def _extract_codes(question: str, catalog: Catalog) -> list[str]:
    upper = question.upper()
    direct = [code for code in CODE_PATTERN.findall(upper) if code in catalog.courses_by_code]
    if direct:
        return list(dict.fromkeys(direct))

    normalized_question = _normalize(question)
    if not normalized_question:
        return []

    scored: list[tuple[float, str]] = []
    for code, course in catalog.courses_by_code.items():
        score = 0.0
        name_vi = _normalize(str(course.get("nameVi", "")))
        name_en = _normalize(str(course.get("nameEn", "")))
        code_norm = _normalize(code)

        if code_norm and code_norm in normalized_question:
            score += 3.0
        if name_vi and name_vi in normalized_question:
            score += 2.0
        if name_en and name_en in normalized_question:
            score += 2.0

        tokens = set((name_vi + " " + name_en).split())
        for token in tokens:
            if len(token) >= 4 and token in normalized_question:
                score += 0.2

        if score > 1.2:
            scored.append((score, code))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [code for _, code in scored[:5]]


def _pick_plan_for_codes(
    codes: list[str],
    catalog: Catalog,
    *,
    blocked_class_ids: set[str] | None = None,
) -> tuple[list[dict[str, Any]], list[str], set[str]]:
    blocked_class_ids = blocked_class_ids or set()
    selected: list[dict[str, Any]] = []
    missing: list[str] = []
    chosen_ids: set[str] = set()

    for code in codes:
        options = [
            cls
            for cls in catalog.schedule_by_code.get(code, [])
            if int(cls.get("slotsRemaining", 0) or 0) > 0
            and str(cls.get("classId", "")) not in blocked_class_ids
        ]

        if not options:
            missing.append(code)
            continue

        picked = None
        for candidate in options:
            if any(_class_conflict(candidate, existing) for existing in selected):
                continue
            picked = candidate
            break

        if picked is None:
            # Last fallback: keep a class even if conflict exists.
            picked = options[0]

        selected.append(picked)
        chosen_ids.add(str(picked.get("classId", "")))

    return selected, missing, chosen_ids


def _format_class_line(course_meta: dict[str, Any], class_row: dict[str, Any]) -> str:
    code = str(course_meta.get("code", class_row.get("courseCode", "")))
    name = str(course_meta.get("nameVi", class_row.get("courseNameVi", code)))
    day = str(class_row.get("day", "?"))
    start = float(class_row.get("startHour", 0))
    end = float(class_row.get("endHour", 0))
    room = str(class_row.get("room", "?"))
    remain = int(class_row.get("slotsRemaining", 0) or 0)
    capacity = int(class_row.get("capacity", 0) or 0)
    risk = str(class_row.get("seatRisk", "medium"))
    return (
        f"- {code} | {name} | {day} {start:g}-{end:g} | room {room} | "
        f"seats {remain}/{capacity} | risk {risk}"
    )


def _student_for(user_id: str, catalog: Catalog) -> dict[str, Any] | None:
    if user_id in catalog.students_by_id:
        return catalog.students_by_id[user_id]
    return catalog.default_student


def _check_missing_prerequisites(
    student: dict[str, Any] | None,
    codes: list[str],
    catalog: Catalog,
) -> list[str]:
    if not student:
        return []
    completed = set(str(c).upper() for c in student.get("completedCourses", []))
    in_progress = set(str(c).upper() for c in student.get("inProgressCourses", []))
    done = completed | in_progress

    warnings: list[str] = []
    for code in codes:
        rule = catalog.prerequisites.get(code, {})
        required = [str(c).upper() for c in rule.get("required", [])]
        missing = [c for c in required if c not in done]
        if missing:
            warnings.append(f"{code}: missing prereq {', '.join(missing)}")
    return warnings


def _student_summary(student: dict[str, Any] | None) -> str:
    if not student:
        return "No student profile found in migrated BKAgent data."
    name = student.get("name", "Unknown")
    student_id = student.get("id", "N/A")
    major = student.get("major", "N/A")
    year = student.get("year", "N/A")
    gpa = student.get("gpa", "N/A")
    semester = student.get("currentSemester", "N/A")
    target = ", ".join(student.get("targetCourses", [])[:8])
    return (
        "BKAgent profile\n"
        f"- id: {student_id}\n"
        f"- name: {name}\n"
        f"- major/year: {major} / {year}\n"
        f"- gpa: {gpa}\n"
        f"- semester: {semester}\n"
        f"- targetCourses: {target or 'none'}"
    )


def _looks_like_bkagent_question(question: str) -> bool:
    normalized = _normalize(question)
    keywords = (
        "dang ky",
        "tin chi",
        "hoc phan",
        "ke hoach",
        "schedule",
        "plan",
        "lop",
        "mon",
        "hoc ky",
        "hust",
        "bkagent",
    )
    return any(kw in normalized for kw in keywords)


def answer_question(question: str, user_id: str) -> str | None:
    """Return a domain answer if the question belongs to BKAgent domain.

    Return None to let the generic mock LLM handle unrelated questions.
    """
    if not _looks_like_bkagent_question(question):
        return None

    catalog = load_catalog()
    student = _student_for(user_id, catalog)
    normalized_q = _normalize(question)

    if any(term in normalized_q for term in ("ho so", "profile", "gpa", "thong tin")):
        return _student_summary(student)

    requested_codes = _extract_codes(question, catalog)
    if not requested_codes and student:
        requested_codes = [
            str(code).upper()
            for code in student.get("targetCourses", [])
            if str(code).upper() in catalog.courses_by_code
        ]

    if not requested_codes:
        # fallback to open classes with lowest risk and many remaining seats
        candidates: list[tuple[int, str]] = []
        for code, classes in catalog.schedule_by_code.items():
            if not classes:
                continue
            best = max(int(item.get("slotsRemaining", 0) or 0) for item in classes)
            candidates.append((best, code))
        candidates.sort(reverse=True)
        requested_codes = [code for _, code in candidates[:5]]

    prereq_warnings = _check_missing_prerequisites(student, requested_codes, catalog)

    plan_a, missing_a, chosen_ids = _pick_plan_for_codes(requested_codes, catalog)
    plan_b, missing_b, _ = _pick_plan_for_codes(
        requested_codes,
        catalog,
        blocked_class_ids=chosen_ids,
    )

    lines = [
        "BKAgent (migrated from Lab5-6) - registration planning result",
        "",
        f"Requested courses: {', '.join(requested_codes)}",
    ]

    if prereq_warnings:
        lines.append("Prerequisite warnings:")
        for warning in prereq_warnings:
            lines.append(f"- {warning}")

    lines.append("")
    lines.append("Plan A (priority classes):")
    if plan_a:
        for row in plan_a:
            code = str(row.get("courseCode", "")).upper()
            course_meta = catalog.courses_by_code.get(code, {"code": code, "nameVi": row.get("courseNameVi", code)})
            lines.append(_format_class_line(course_meta, row))
    else:
        lines.append("- No feasible class found for Plan A.")

    lines.append("")
    lines.append("Plan B (backup classes):")
    if plan_b:
        for row in plan_b:
            code = str(row.get("courseCode", "")).upper()
            course_meta = catalog.courses_by_code.get(code, {"code": code, "nameVi": row.get("courseNameVi", code)})
            lines.append(_format_class_line(course_meta, row))
    else:
        lines.append("- No backup class available without reusing Plan A classes.")

    unresolved = sorted(set(missing_a + missing_b))
    if unresolved:
        lines.append("")
        lines.append("Courses with no open class in current data:")
        lines.append("- " + ", ".join(unresolved))

    if student:
        lines.append("")
        lines.append(
            "Student context: "
            f"{student.get('id', 'N/A')} | {student.get('name', 'Unknown')} | "
            f"semester {student.get('currentSemester', 'N/A')}"
        )

    lines.append("")
    lines.append(
        "Next suggestions: ask me to optimize for morning/afternoon,"
        " minimize high-risk classes, or check a specific course code."
    )

    return "\n".join(lines)
