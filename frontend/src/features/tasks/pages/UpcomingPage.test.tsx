import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpcomingPage from "./UpcomingPage";
import { apiGetUpcoming } from "../api";
import { makeTask, localDate } from "../test-utils";

vi.mock("../api");

describe("UpcomingPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('groups tasks by due date and labels the next calendar day "Tomorrow"', async () => {
    vi.mocked(apiGetUpcoming).mockResolvedValue([
      makeTask({ id: "1", title: "Tomorrow A", due_date: localDate(1) }),
      makeTask({ id: "2", title: "Tomorrow B", due_date: localDate(1) }),
      makeTask({ id: "3", title: "Later task", due_date: localDate(3) }),
    ]);
    render(<UpcomingPage />);
    await screen.findByText("Tomorrow A");

    const groups = screen.getAllByRole("heading", { level: 2 });
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent("Tomorrow");
    expect(groups[1]).not.toHaveTextContent("Tomorrow");

    const first = groups[0].closest("section") as HTMLElement;
    expect(within(first).getByText("Tomorrow A")).toBeInTheDocument();
    expect(within(first).getByText("Tomorrow B")).toBeInTheDocument();
    expect(within(first).queryByText("Later task")).not.toBeInTheDocument();

    const second = groups[1].closest("section") as HTMLElement;
    expect(within(second).getByText("Later task")).toBeInTheDocument();
  });

  it("paginates at 5 tasks per page (PRD §4.9 - PAGE_SIZE 5)", async () => {
    const user = userEvent.setup();
    vi.mocked(apiGetUpcoming).mockResolvedValue([
      makeTask({ id: "1", title: "Task 1", due_date: localDate(1) }),
      makeTask({ id: "2", title: "Task 2", due_date: localDate(1) }),
      makeTask({ id: "3", title: "Task 3", due_date: localDate(2) }),
      makeTask({ id: "4", title: "Task 4", due_date: localDate(2) }),
      makeTask({ id: "5", title: "Task 5", due_date: localDate(3) }),
      makeTask({ id: "6", title: "Task 6", due_date: localDate(3) }),
      makeTask({ id: "7", title: "Task 7", due_date: localDate(4) }),
    ]);
    render(<UpcomingPage />);
    await screen.findByText("Task 1");

    expect(document.querySelectorAll(".task-card")).toHaveLength(5);
    expect(screen.queryByText("Task 6")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(document.querySelectorAll(".task-card")).toHaveLength(2);
    expect(screen.getByText("Task 6")).toBeInTheDocument();
    expect(screen.getByText("Task 7")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("requests upcoming tasks with the client's local date", async () => {
    vi.mocked(apiGetUpcoming).mockResolvedValue([]);
    render(<UpcomingPage />);
    await screen.findByText("No upcoming tasks. Add one from the Today page!");

    expect(apiGetUpcoming).toHaveBeenCalledWith(localDate(0), expect.any(AbortSignal));
  });
});
