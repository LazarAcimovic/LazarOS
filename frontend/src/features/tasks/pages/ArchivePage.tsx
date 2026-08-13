import { useCallback } from "react";
import { apiGetArchive, apiRestoreTask } from "../api";
import { Task } from "../models";
import TaskCard from "../components/TaskCard";
import Loader from "@/components/shared/Loader";
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
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Archive</h1>
      </div>

      {(tasks?.length ?? 0) === 0 ? (
        <div className="empty-state">
          <p>No archived tasks.</p>
        </div>
      ) : (
        <div className="task-list">
          {(tasks ?? []).map((t) => (
            <TaskCard key={t.id} task={t} archived onRestore={handleRestore} />
          ))}
        </div>
      )}
    </div>
  );
}
