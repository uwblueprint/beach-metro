import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OverviewPage from "@/app/(dashboard)/overview/page";

/**
 * The page reads its data through TanStack Query now, so it needs a client in
 * context. Retries are off so a failing fetch surfaces immediately rather than
 * being retried three times inside the test.
 */
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Overview page", () => {
  it("renders the section heading", () => {
    renderWithQueryClient(<OverviewPage />);
    expect(screen.getByRole("heading", { name: /overview/i })).toBeInTheDocument();
  });

  it("shows a loading state before any data arrives", () => {
    renderWithQueryClient(<OverviewPage />);
    // The page frame renders regardless, so the heading is up while data loads.
    expect(screen.getByText(/loading overview/i)).toBeInTheDocument();
  });
});
