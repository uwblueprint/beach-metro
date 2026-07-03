import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OverviewPage from "@/app/(dashboard)/overview/page";

describe("Overview page", () => {
  it("renders the section heading", () => {
    render(<OverviewPage />);
    expect(screen.getByRole("heading", { name: /overview/i })).toBeInTheDocument();
  });
});
