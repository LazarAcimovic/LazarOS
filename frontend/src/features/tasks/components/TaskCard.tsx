import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Task, DashboardTask } from "../models";
import { formatDueDate } from "../utils";

const PRIORITY_PILL = {
  high: "bg-overdue-bg text-priority-high",
  medium: "bg-[#fffbeb] text-priority-medium dark:bg-[#2d2200]",
  low: "bg-completed-bg text-priority-low",
} as const;

interface Props {
  task: Task | DashboardTask;
  showDaysOverdue?: boolean;
  onComplete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onRestore?: (task: Task) => void;
  archived?: boolean;
}

export default function TaskCard({
  task,
  showDaysOverdue = false,
  onComplete,
  onEdit,
  onDelete,
  onRestore,
  archived = false,
}: Props) {
  const daysOverdue =
    showDaysOverdue && "days_overdue" in task ? (task as DashboardTask).days_overdue : 0;
  const completed = task.status === "completed";
  const overdue = showDaysOverdue && daysOverdue > 0;

  // `data-*` attributes are the test hooks; all styling comes from Tailwind utilities.
  return (
    <Card
      data-task-card
      className={cn(
        "flex-row items-start justify-between gap-3 rounded-md px-4 py-3.5 transition-shadow hover:shadow-md",
        completed && "opacity-70",
        overdue && "border-l-[3px] border-l-destructive bg-overdue-bg"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2.5">
          {onComplete && !archived && (
            <button
              type="button"
              className={cn(
                "flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 text-white transition-colors hover:border-primary",
                completed
                  ? "border-success bg-success"
                  : "border-border bg-surface-2"
              )}
              onClick={() => onComplete(task as Task)}
              title={completed ? "Mark as pending" : "Mark as completed"}
              aria-label="Toggle complete"
            >
              {completed ? <Check className="size-3" aria-hidden="true" /> : ""}
            </button>
          )}
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span
              data-task-title
              className={cn(
                "truncate text-[15px] font-medium text-foreground",
                completed && "text-muted-foreground line-through"
              )}
            >
              {task.title}
            </span>
            {task.description && (
              <span className="truncate text-[13px] text-muted-foreground">
                {task.description}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pl-8">
          <Badge
            data-priority={task.priority}
            className={cn(
              "text-[11px] font-semibold tracking-wide uppercase",
              PRIORITY_PILL[task.priority]
            )}
          >
            {task.priority}
          </Badge>
          <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
            {formatDueDate(task.due_date)}
            {overdue && (
              <Badge
                variant="outline"
                className="border-overdue-border bg-overdue-bg text-[11px] font-semibold text-overdue-text"
              >
                {daysOverdue} {daysOverdue === 1 ? "day" : "days"} overdue
              </Badge>
            )}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        {onRestore && (
          <Button variant="ghost" size="sm" onClick={() => onRestore(task as Task)}>
            Restore
          </Button>
        )}
        {onEdit && !archived && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(task as Task)}>
            Edit
          </Button>
        )}
        {onDelete && !archived && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(task as Task)}
          >
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}
