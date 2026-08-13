import { useState, useCallback, useMemo, useEffect } from "react";
import { apiGetAllTasks, apiCreateTask } from "../api";
import TaskCard from "../components/TaskCard";
import Modal from "@/components/shared/Modal";
import TaskForm from "../components/TaskForm";
import Loader from "@/components/shared/Loader";
import Pagination from "@/components/shared/Pagination";
import TaskEditDeleteModals from "../components/TaskEditDeleteModals";
import { useAsync } from "@/hooks/useAsync";
import { useTaskMutations } from "../hooks/useTaskMutations";
import { usePagination } from "@/hooks/usePagination";

const PAGE_SIZE = 10;

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
  if (error) return <div className="page-error">{error}</div>;

  const hasFilters =
    query !== "" ||
    filterStatus !== "all" ||
    filterPriority !== "all" ||
    filterDate !== "";

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">All Tasks</h1>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          + Add Task
        </button>
      </div>

      <div className="filters">
        <input
          className="filters__search"
          type="text"
          placeholder="Search by title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="filters__select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
        <select
          className="filters__select"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
        >
          <option value="all">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input
          className="filters__date"
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        {hasFilters && (
          <button className="btn btn--ghost filters__reset" onClick={resetFilters}>
            Reset
          </button>
        )}
      </div>

      <p className="page__count">
        {filtered.length} of {tasks?.length ?? 0} tasks
      </p>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No tasks match your filters.</p>
        </div>
      ) : (
        <>
          <div className="task-list">
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
