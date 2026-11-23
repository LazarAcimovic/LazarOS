import { useState, useCallback } from "react";
import { apiGetDashboard, apiCreateTask } from "../api";
import { getLocalToday, formatDueDate } from "../utils";
import TaskCard from "../components/TaskCard";
import TaskForm from "../components/TaskForm";
import Modal from "@/components/shared/Modal";
import Loader from "@/components/shared/Loader";
import TaskEditDeleteModals from "../components/TaskEditDeleteModals";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAsync } from "@/hooks/useAsync";
import { useTaskMutations } from "../hooks/useTaskMutations";

function SummaryCard({
  count,
  label,
  className,
  countClassName,
}: {
  count: number;
  label: string;
  className?: string;
  countClassName?: string;
}) {
  return (
    <Card className={cn("min-w-30 flex-1 items-start gap-1 p-5 max-md:min-w-22 max-md:p-3.5", className)}>
      <span
        className={cn(
          "text-4xl leading-none font-extrabold text-foreground max-md:text-3xl",
          countClassName
        )}
      >
        {count}
      </span>
      <span className="text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </Card>
  );
}

const SECTION_HEADING =
  "mb-2.5 border-b border-border pb-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase";

export default function TodayPage() {
  const today = getLocalToday();
  const fetcher = useCallback(
    (signal: AbortSignal) => apiGetDashboard(today, signal),
    [today]
  );
  const { data, isLoading, error, reload } = useAsync(fetcher, "Failed to load dashboard");
  const mutations = useTaskMutations(reload);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (values: Parameters<typeof apiCreateTask>[0]) => {
    await apiCreateTask(values);
    setShowCreate(false);
    reload();
  };

  if (isLoading) return <Loader />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const todayFormatted = formatDueDate(today);
  const totalPending = data.overdue.length + data.today.length;

  return (
    <div className="mx-auto max-w-215 px-8 py-9 max-md:px-4 max-md:py-5">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{todayFormatted}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          + Add Task
        </Button>
      </div>

      <div className="mb-8 flex flex-wrap gap-4 max-md:gap-2.5">
        <SummaryCard
          count={data.overdue.length}
          label="Overdue"
          className="border-overdue-border bg-overdue-bg"
          countClassName="text-overdue-text"
        />
        <SummaryCard
          count={data.today.length}
          label="Today"
          className="border-today-border bg-today-bg"
          countClassName="text-today-text"
        />
        <SummaryCard
          count={data.completed_today.length}
          label="Completed"
          className="bg-completed-bg"
          countClassName="text-completed-text"
        />
      </div>

      {totalPending === 0 && data.completed_today.length === 0 && (
        <div className="px-6 py-12 text-center text-[15px] text-muted-foreground">
          <p>Nothing due today. Enjoy your day!</p>
        </div>
      )}

      {data.overdue.length > 0 && (
        <section className="mb-8">
          <h2 className={cn(SECTION_HEADING, "border-overdue-border text-overdue-text")}>
            Overdue
          </h2>
          <div className="flex flex-col gap-2">
            {data.overdue.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                showDaysOverdue
                onComplete={mutations.handleComplete}
                onEdit={mutations.handleEdit}
                onDelete={mutations.handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {data.today.length > 0 && (
        <section className="mb-8">
          <h2 className={cn(SECTION_HEADING, "border-today-border text-today-text")}>
            Today
          </h2>
          <div className="flex flex-col gap-2">
            {data.today.map((t) => (
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
      )}

      {data.completed_today.length > 0 && (
        <section className="mb-8">
          <h2 className={cn(SECTION_HEADING, "text-completed-text")}>Completed</h2>
          <div className="flex flex-col gap-2">
            {data.completed_today.map((t) => (
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
