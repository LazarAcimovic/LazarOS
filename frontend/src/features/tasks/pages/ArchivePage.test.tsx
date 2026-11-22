import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArchivePage from "./ArchivePage";
import { apiGetArchive, apiRestoreTask } from "../api";
import { makeTask } from "../test-utils";

vi.mock("../api");

describe("ArchivePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lists the soft-deleted tasks with a Restore action and no edit/delete", async () => {
    vi.mocked(apiGetArchive).mockResolvedValue([
      makeTask({ id: "1", title: "Old task", is_deleted: true }),
      makeTask({ id: "2", title: "Other old task", is_deleted: true }),
    ]);
    render(<ArchivePage />);

    expect(await screen.findByText("Old task")).toBeInTheDocument();
    expect(screen.getByText("Other old task")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows the empty state when nothing is archived", async () => {
    vi.mocked(apiGetArchive).mockResolvedValue([]);
    render(<ArchivePage />);

    expect(await screen.findByText("No archived tasks.")).toBeInTheDocument();
  });

  it("calls the restore api for that task and reloads the list", async () => {
    const user = userEvent.setup();
    const archived = [
      makeTask({ id: "1", title: "Old task", is_deleted: true }),
      makeTask({ id: "2", title: "Other old task", is_deleted: true }),
    ];
    vi.mocked(apiGetArchive)
      .mockResolvedValueOnce(archived)
      .mockResolvedValue([archived[1]]);
    vi.mocked(apiRestoreTask).mockResolvedValue(
      makeTask({ id: "1", title: "Old task" })
    );
    render(<ArchivePage />);
    await screen.findByText("Old task");

    const card = screen.getByText("Old task").closest(".task-card") as HTMLElement;
    await user.click(card.querySelector("button") as HTMLButtonElement);

    expect(apiRestoreTask).toHaveBeenCalledWith("1");
    await waitFor(() => expect(apiGetArchive).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("Old task")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Other old task")).toBeInTheDocument();
  });
});
