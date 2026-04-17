import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CreatePlanPage from "./page";

describe("Create plan page", () => {
  it("renders chat panel and result panel", () => {
    render(<CreatePlanPage />);
    expect(screen.getByText(/Xin chào! Mình là BKAgent/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nhập yêu cầu đăng ký học phần/i)).toBeInTheDocument();
    expect(screen.getByText(/Lịch học sẽ hiển thị ở đây/i)).toBeInTheDocument();
  });
});
