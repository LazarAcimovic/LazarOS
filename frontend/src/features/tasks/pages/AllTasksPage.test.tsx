import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AllTasksPage from "./AllTasksPage";
import { apiGetAllTasks } from "../api";
import { makeTask } from "../test-utils";

vi.mock("../api");

const FILTER_TASKS = [
  makeTask({ id: "a", title: "Buy milk", status: "pending", priority: "high", due_date: "2026-12-01" }),
  makeTask({ id: "b", title: "Write report", status: "completed", priority: "low", due_date: "2026-12-02" }),
  makeTask({ id: "c", title: "Call mom", status: "pending", priority: "medium", due_date: "2026-12-01" }),
  makeTask({ id: "d", title: "Buy gift", status: "completed", priority: "high", due_date: "2026-12-03" }),
];

function titles() {
  return Array.from(document.querySelectorAll(".task-card__title")).map(
    (el) => el.textContent
  );
}

describe("AllTasksPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("in-memory filters (PRD §4.10)", () => {
    beforeEach(() => {
      vi.mocked(apiGetAllTasks).mockResolvedValue(FILTER_TASKS);
    });

    it("lists every task when no filter is set", async () => {
      render(<AllTasksPage />);
      await screen.findByText("Buy milk");
      expect(titles()).toEqual(["Buy milk", "Write report", "Call mom", "Buy gift"]);
      expect(screen.getByText("4 of 4 tasks")).toBeInTheDocument();
    });

    it("narrows by title search, case-insensitively", async () => {
      const user = userEvent.setup();
      render(<AllTasksPage />);
      await screen.findByText("Buy milk");
      await user.type(screen.getByPlaceholderText("Search by title..."), "BUY");

      expect(titles()).toEqual(["Buy milk", "Buy gift"]);
      expect(screen.getByText("2 of 4 tasks")).toBeInTheDocument();
    });

    it("narrows by status", async () => {
      const user = userEvent.setup();
      render(<AllTasksPage />);
      await screen.findByText("Buy milk");
      const [statusSelect] = screen.getAllByRole("combobox");
      await user.selectOptions(statusSelect, "completed");

      expect(titles()).toEqual(["Write report", "Buy gift"]);
    });

    it("narrows by priority", async () => {
      const user = userEvent.setup();
      render(<AllTasksPage />);
      await screen.findByText("Buy milk");
      const [, prioritySelect] = screen.getAllByRole("combobox");
      await user.selectOptions(prioritySelect, "high");

      expect(titles()).toEqual(["Buy milk", "Buy gift"]);
    });

    it("narrows by exact due date", async () => {
      const { container } = render(<AllTasksPage />);
      await screen.findByText("Buy milk");
      const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: "2026-12-01" } });

      expect(titles()).toEqual(["Buy milk", "Call mom"]);
    });

    it("combines filters and Reset restores the full list", async () => {
      const user = userEvent.setup();
      render(<AllTasksPage />);
      await screen.findByText("Buy milk");
      await user.type(screen.getByPlaceholderText("Search by title..."), "buy");
      const [statusSelect] = screen.getAllByRole("combobox");
      await user.selectOptions(statusSelect, "completed");
      expect(titles()).toEqual(["Buy gift"]);

      await user.click(screen.getByRole("button", { name: "Reset" }));
      expect(titles()).toHaveLength(4);
    });

    it("shows the empty state when nothing matches", async () => {
      const user = userEvent.setup();
      render(<AllTasksPage />);
      await screen.findByText("Buy milk");
      await user.type(screen.getByPlaceholderText("Search by title..."), "zzz");

      expect(screen.getByText("No tasks match your filters.")).toBeInTheDocument();
    });
  });

  describe("pagination (PRD §4.10 - PAGE_SIZE 10)", () => {
    beforeEach(() => {
      const many = Array.from({ length: 25 }, (_, i) =>
        makeTask({ id: `t${i + 1}`, title: `Task ${String(i + 1).padStart(2, "0")}` })
      );
      vi.mocked(apiGetAllTasks).mockResolvedValue(many);
    });

    it("shows 10 tasks per page and pages through them", async () => {
      const user = userEvent.setup();
      render(<AllTasksPage />);
      await screen.findByText("Task 01");

      expect(titles()).toHaveLength(10);
      expect(screen.getByText("1 / 3")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
      expect(titles()).toHaveLength(10);
      expect(titles()[0]).toBe("Task 11");

      await user.click(screen.getByRole("button", { name: /next/i }));
      expect(titles()).toHaveLength(5);
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    it("returns to page 1 when a filter changes", async () => {
      const user = userEvent.setup();
      render(<AllTasksPage />);
      await screen.findByText("Task 01");
      await user.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByText("2 / 3")).toBeInTheDocument();

      await user.type(screen.getByPlaceholderText("Search by title..."), "Task 0");
      expect(screen.queryByText(/\/ \d/)).not.toBeInTheDocument();
      expect(titles()).toHaveLength(9);
    });
  });
});
