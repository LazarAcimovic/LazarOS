import { useCallback, useMemo } from "react";
import { apiGetUpcoming } from "../api";
import { Task } from "../models";
import { getLocalToday, formatGroupDate } from "../utils";
import TaskCard from "../components/TaskCard";
import Pagination from "@/components/shared/Pagination";
import Loader from "@/components/shared/Loader";
import TaskEditDeleteModals from "../components/TaskEditDeleteModals";
import ErrorState from "@/components/shared/ErrorState";
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
  if (error) return <ErrorState message={error} />;

  return (
    <div className="mx-auto max-w-215 px-8 py-9 max-md:px-4 max-md:py-5">
      <div className="mb-7 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">Upcoming</h1>
      </div>

      {(tasks?.length ?? 0) === 0 ? (
        <div className="px-6 py-12 text-center text-[15px] text-muted-foreground">
          <p>No upcoming tasks. Add one from the Today page!</p>
        </div>
      ) : (
        <>
          {sortedDates.map((date) => (
            <section key={date} className="mb-8">
              <h2 className="mb-2.5 border-b border-border pb-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {formatGroupDate(date)}
              </h2>
              <div className="flex flex-col gap-2">
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
