import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfidenceBadge, ConflictBadge } from "./vinagent-ui";

describe("BKAgent UI components", () => {
  it("renders conflict badges", () => {
    const { rerender } = render(<ConflictBadge hasConflict={false} />);
    expect(screen.getByText(/Không xung đột/i)).toBeInTheDocument();
    rerender(<ConflictBadge hasConflict={true} />);
    expect(screen.getByText(/Có xung đột/i)).toBeInTheDocument();
  });

  it("renders confidence badges", () => {
    const { rerender } = render(<ConfidenceBadge level="high" />);
    expect(screen.getByText(/Độ tin cậy cao/i)).toBeInTheDocument();
    rerender(<ConfidenceBadge level="low" />);
    expect(screen.getByText(/Độ tin cậy thấp/i)).toBeInTheDocument();
  });
});
