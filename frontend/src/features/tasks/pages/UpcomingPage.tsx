import { useCallback, useMemo } from "react";
import { apiGetUpcoming } from "../api";
import { Task } from "../models";
import { getLocalToday, formatGroupDate } from "../utils";
import TaskCard from "../components/TaskCard";
import Pagination from "@/components/shared/Pagination";
import Loader from "@/components/shared/Loader";
import TaskEditDeleteModals from "../components/TaskEditDeleteModals";
import { useAsync } from "@/hooks/useAsync";
import { useTaskMutations } from "../hooks/useTaskMutations";
import { usePagination } from "@/hooks/usePagination";

const PAGE_SIZE = 5;

export default function UpcomingPage() {
  const today = getLocalToday();
  const fetcher = useCallback(
    (signal: AbortSignal) => apiGetUpcoming(today, signal),
    [today]
  );
  const { data: tasks, isLoading, error, reload } = useAsync(
    fetcher,
    "Failed to load upcoming tasks"
  );
  const mutations = useTaskMutations(reload);
  const { page, setPage, totalPages, pageItems } = usePagination(
    tasks ?? [],
    PAGE_SIZE
  );

  const groups = useMemo(() => {
    const g: Record<string, Task[]> = {};
    pageItems.forEach((t) => {
      if (!g[t.due_date]) g[t.due_date] = [];
      g[t.due_date].push(t);
    });
    return g;
  }, [pageItems]);

  const sortedDates = Object.keys(groups).sort();

  if (isLoading) return <Loader />;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Upcoming</h1>
      </div>

      {(tasks?.length ?? 0) === 0 ? (
        <div className="empty-state">
          <p>No upcoming tasks. Add one from the Today page!</p>
        </div>
      ) : (
        <>
          {sortedDates.map((date) => (
            <section key={date} className="task-section">
              <h2 className="task-section__heading">{formatGroupDate(date)}</h2>
              <div className="task-list">
                {groups[date].map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onComplete={mutations.handleComplete}
                    onEdit={mutations.handleEdit}
                    onDelete={mutations.handleDelete}
                  />
                ))}
              </div>
            </section>
          ))}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <TaskEditDeleteModals mutations={mutations} />
    </div>
  );
}
