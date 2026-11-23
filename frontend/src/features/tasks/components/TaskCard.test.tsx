import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskCard from "./TaskCard";
import type { Task, DashboardTask } from "../models";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "1",
    user_id: "u1",
    title: "Test task",
    description: null,
    due_date: "2026-12-01",
    priority: "high",
    status: "pending",
    is_deleted: false,
    completed_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

function makeDashboardTask(days_overdue = 0): DashboardTask {
  return { ...makeTask(), section: "overdue", days_overdue };
}

describe("TaskCard", () => {
  it("renders the priority pill with the correct class", () => {
    render(<TaskCard task={makeTask({ priority: "high" })} />);
    expect(screen.getByText("high")).toHaveAttribute("data-priority", "high");
  });

  it("shows the overdue badge when showDaysOverdue is true and days_overdue > 0", () => {
    render(<TaskCard task={makeDashboardTask(3)} showDaysOverdue />);
    expect(screen.getByText(/3 days overdue/)).toBeInTheDocument();
  });

  it("does not show the overdue badge when days_overdue is 0", () => {
    render(<TaskCard task={makeDashboardTask(0)} showDaysOverdue />);
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });

  it("calls onComplete when the complete button is clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const task = makeTask();
    render(<TaskCard task={task} onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: /toggle complete/i }));
    expect(onComplete).toHaveBeenCalledWith(task);
  });

  it("calls onEdit when the Edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const task = makeTask();
    render(<TaskCard task={task} onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(task);
  });

  it("calls onDelete when the Delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const task = makeTask();
    render(<TaskCard task={task} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(task);
  });
});
