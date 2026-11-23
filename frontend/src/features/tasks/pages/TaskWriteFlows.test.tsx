import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TodayPage from "./TodayPage";
import {
  apiGetDashboard,
  apiCreateTask,
  apiUpdateTask,
  apiDeleteTask,
} from "../api";
import { makeDashboardTask, makeTask } from "../test-utils";

vi.mock("../api");

function dashboard() {
  return {
    overdue: [],
    today: [
      makeDashboardTask("today", { id: "p1", title: "Pending task", status: "pending" }),
    ],
    completed_today: [
      makeDashboardTask("completed_today", {
        id: "c1",
        title: "Done task",
        status: "completed",
      }),
    ],
  };
}

function cardOf(title: string): HTMLElement {
  return screen.getByText(title).closest("[data-task-card]") as HTMLElement;
}

describe("task write flows at the api boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(apiGetDashboard).mockImplementation(async () => dashboard());
  });

  it("creates a task from the New Task modal via the create api and reloads", async () => {
    const user = userEvent.setup();
    vi.mocked(apiCreateTask).mockResolvedValue(makeTask({ id: "n1", title: "Buy milk" }));
    render(<TodayPage />);
    await screen.findByText("Pending task");

    await user.click(screen.getByRole("button", { name: "+ Add Task" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "New Task" })).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/title/i), "Buy milk");
    fireEvent.change(within(dialog).getByLabelText(/due date/i), {
      target: { value: "2026-12-01" },
    });
    await user.selectOptions(within(dialog).getByLabelText(/priority/i), "high");
    await user.click(within(dialog).getByRole("button", { name: "Create Task" }));

    await waitFor(() =>
      expect(apiCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Buy milk",
          due_date: "2026-12-01",
          priority: "high",
        })
      )
    );
    await waitFor(() => expect(apiGetDashboard).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not call the create api when client validation fails", async () => {
    const user = userEvent.setup();
    render(<TodayPage />);
    await screen.findByText("Pending task");

    await user.click(screen.getByRole("button", { name: "+ Add Task" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Create Task" })
    );

    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(apiCreateTask).not.toHaveBeenCalled();
  });

  it("toggles a pending task to completed through the update api and reloads", async () => {
    const user = userEvent.setup();
    vi.mocked(apiUpdateTask).mockResolvedValue(makeTask());
    render(<TodayPage />);
    await screen.findByText("Pending task");

    await user.click(
      within(cardOf("Pending task")).getByRole("button", { name: /toggle complete/i })
    );

    expect(apiUpdateTask).toHaveBeenCalledWith("p1", { status: "completed" });
    await waitFor(() => expect(apiGetDashboard).toHaveBeenCalledTimes(2));
  });

  it("toggles a completed task back to pending through the update api", async () => {
    const user = userEvent.setup();
    vi.mocked(apiUpdateTask).mockResolvedValue(makeTask());
    render(<TodayPage />);
    await screen.findByText("Done task");

    await user.click(
      within(cardOf("Done task")).getByRole("button", { name: /toggle complete/i })
    );

    expect(apiUpdateTask).toHaveBeenCalledWith("c1", { status: "pending" });
    await waitFor(() => expect(apiGetDashboard).toHaveBeenCalledTimes(2));
  });

  it("confirming delete calls the delete api for that task and reloads", async () => {
    const user = userEvent.setup();
    vi.mocked(apiDeleteTask).mockResolvedValue(undefined);
    render(<TodayPage />);
    await screen.findByText("Pending task");

    await user.click(within(cardOf("Pending task")).getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText('Delete "Pending task"?')).toBeInTheDocument();
    expect(apiDeleteTask).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(apiDeleteTask).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(apiGetDashboard).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cancelling the delete confirmation does not call the delete api", async () => {
    const user = userEvent.setup();
    render(<TodayPage />);
    await screen.findByText("Pending task");

    await user.click(within(cardOf("Pending task")).getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })
    );

    expect(apiDeleteTask).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
