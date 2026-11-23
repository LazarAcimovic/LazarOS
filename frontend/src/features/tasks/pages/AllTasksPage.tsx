import { useState, useCallback, useMemo, useEffect } from "react";
import { apiGetAllTasks, apiCreateTask } from "../api";
import TaskCard from "../components/TaskCard";
import Modal from "@/components/shared/Modal";
import TaskForm from "../components/TaskForm";
import Loader from "@/components/shared/Loader";
import Pagination from "@/components/shared/Pagination";
import TaskEditDeleteModals from "../components/TaskEditDeleteModals";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAsync } from "@/hooks/useAsync";
import { useTaskMutations } from "../hooks/useTaskMutations";
import { usePagination } from "@/hooks/usePagination";

const PAGE_SIZE = 10;

// Native <select> kept (suites drive it with selectOptions); styled to match the shadcn Input.
const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export default function AllTasksPage() {
  const fetcher = useCallback((signal: AbortSignal) => apiGetAllTasks(signal), []);
  const { data: tasks, isLoading, error, reload } = useAsync(
    fetcher,
    "Failed to load tasks"
  );
  const mutations = useTaskMutations(reload);

  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tasks ?? []).filter((t) => {
      const matchesQuery = q === "" || t.title.toLowerCase().includes(q);
      const matchesStatus = filterStatus === "all" || t.status === filterStatus;
      const matchesPriority =
        filterPriority === "all" || t.priority === filterPriority;
      const matchesDate = filterDate === "" || t.due_date === filterDate;
      return matchesQuery && matchesStatus && matchesPriority && matchesDate;
    });
  }, [tasks, query, filterStatus, filterPriority, filterDate]);

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, filterStatus, filterPriority, filterDate, setPage]);

  const resetFilters = () => {
    setQuery("");
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterDate("");
  };

  const handleCreate = async (values: Parameters<typeof apiCreateTask>[0]) => {
    await apiCreateTask(values);
    setShowCreate(false);
    reload();
  };

  if (isLoading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  const hasFilters =
    query !== "" ||
    filterStatus !== "all" ||
    filterPriority !== "all" ||
    filterDate !== "";

  return (
    <div className="mx-auto max-w-215 px-8 py-9 max-md:px-4 max-md:py-5">
      <div className="mb-7 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">All Tasks</h1>
        <Button onClick={() => setShowCreate(true)}>+ Add Task</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input
          className="min-w-45 flex-1 bg-card"
          type="text"
          placeholder="Search by title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={SELECT_CLASS}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
        <select
          className={SELECT_CLASS}
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
        >
          <option value="all">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <Input
          className="w-auto bg-card"
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        {hasFilters && (
          <Button variant="ghost" onClick={resetFilters}>
            Reset
          </Button>
        )}
      </div>

      <p className="mb-4 text-[13px] text-muted-foreground">
        {filtered.length} of {tasks?.length ?? 0} tasks
      </p>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center text-[15px] text-muted-foreground">
          <p>No tasks match your filters.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {pageItems.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onComplete={mutations.handleComplete}
                onEdit={mutations.handleEdit}
                onDelete={mutations.handleDelete}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {showCreate && (
        <Modal title="New Task" onClose={() => setShowCreate(false)}>
          <TaskForm
            mode="create"
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      <TaskEditDeleteModals mutations={mutations} />
    </div>
  );
}
