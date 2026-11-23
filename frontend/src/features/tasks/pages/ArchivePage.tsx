import { useCallback } from "react";
import { apiGetArchive, apiRestoreTask } from "../api";
import { Task } from "../models";
import TaskCard from "../components/TaskCard";
import Loader from "@/components/shared/Loader";
import ErrorState from "@/components/shared/ErrorState";
import { useAsync } from "@/hooks/useAsync";

export default function ArchivePage() {
  const fetcher = useCallback((signal: AbortSignal) => apiGetArchive(signal), []);
  const { data: tasks, isLoading, error, reload } = useAsync(
    fetcher,
    "Failed to load archive"
  );

  const handleRestore = async (task: Task) => {
    await apiRestoreTask(task.id);
    reload();
  };

  if (isLoading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="mx-auto max-w-215 px-8 py-9 max-md:px-4 max-md:py-5">
      <div className="mb-7 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">Archive</h1>
      </div>

      {(tasks?.length ?? 0) === 0 ? (
        <div className="px-6 py-12 text-center text-[15px] text-muted-foreground">
          <p>No archived tasks.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(tasks ?? []).map((t) => (
            <TaskCard key={t.id} task={t} archived onRestore={handleRestore} />
          ))}
        </div>
      )}
    </div>
  );
}
