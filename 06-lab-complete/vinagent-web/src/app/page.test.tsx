import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Landing page", () => {
  it("renders onboarding steps and CTA", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Mô tả yêu cầu/i)).toBeInTheDocument();
    expect(screen.getByText(/Xem phương án/i)).toBeInTheDocument();
    expect(screen.getByText(/Xác nhận & đăng ký/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bắt đầu tạo lịch học/i })).toHaveAttribute("href", "/tao-ke-hoach");
  });
});
