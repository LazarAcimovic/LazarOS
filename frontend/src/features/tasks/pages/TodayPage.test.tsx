import { render, screen, within } from "@testing-library/react";
import TodayPage from "./TodayPage";
import { apiGetDashboard } from "../api";
import { makeDashboardTask } from "../test-utils";

vi.mock("../api");

describe("TodayPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders the Overdue, Today and Completed sections from the dashboard response", async () => {
    vi.mocked(apiGetDashboard).mockResolvedValue({
      overdue: [
        makeDashboardTask("overdue", {
          id: "o1",
          title: "Pay rent",
          due_date: "2026-11-01",
          days_overdue: 3,
        }),
      ],
      today: [makeDashboardTask("today", { id: "t1", title: "Write report" })],
      completed_today: [
        makeDashboardTask("completed_today", {
          id: "c1",
          title: "Send invoice",
          status: "completed",
        }),
      ],
    });
    render(<TodayPage />);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Overdue" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Today" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Completed" })
    ).toBeInTheDocument();

    expect(screen.getByText("Pay rent")).toBeInTheDocument();
    expect(screen.getByText("Write report")).toBeInTheDocument();
    expect(screen.getByText("Send invoice")).toBeInTheDocument();
  });

  it('shows the "N days overdue" badge derived from days_overdue on overdue tasks only', async () => {
    vi.mocked(apiGetDashboard).mockResolvedValue({
      overdue: [
        makeDashboardTask("overdue", {
          id: "o1",
          title: "Pay rent",
          days_overdue: 3,
        }),
        makeDashboardTask("overdue", {
          id: "o2",
          title: "Call bank",
          days_overdue: 1,
        }),
      ],
      today: [makeDashboardTask("today", { id: "t1", title: "Write report" })],
      completed_today: [],
    });
    render(<TodayPage />);

    const rent = (await screen.findByText("Pay rent")).closest(
      ".task-card"
    ) as HTMLElement;
    expect(within(rent).getByText("3 days overdue")).toBeInTheDocument();

    const bank = screen.getByText("Call bank").closest(".task-card") as HTMLElement;
    expect(within(bank).getByText("1 day overdue")).toBeInTheDocument();

    const today = screen
      .getByText("Write report")
      .closest(".task-card") as HTMLElement;
    expect(within(today).queryByText(/overdue/i)).not.toBeInTheDocument();
  });

  it("shows the empty state when the dashboard has no tasks", async () => {
    vi.mocked(apiGetDashboard).mockResolvedValue({
      overdue: [],
      today: [],
      completed_today: [],
    });
    render(<TodayPage />);

    expect(
      await screen.findByText("Nothing due today. Enjoy your day!")
    ).toBeInTheDocument();
  });

  it("requests the dashboard with the client's local calendar date", async () => {
    vi.mocked(apiGetDashboard).mockResolvedValue({
      overdue: [],
      today: [],
      completed_today: [],
    });
    render(<TodayPage />);
    await screen.findByRole("heading", { level: 1, name: "Today" });

    expect(apiGetDashboard).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.any(AbortSignal)
    );
  });
});
