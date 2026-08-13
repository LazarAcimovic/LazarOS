import { Task, DashboardTask } from "../models";
import { formatDueDate } from "../utils";

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

  return (
    <div
      className={`task-card task-card--${task.priority}${task.status === "completed" ? " task-card--completed" : ""}${showDaysOverdue && daysOverdue > 0 ? " task-card--overdue" : ""}`}
    >
      <div className="task-card__body">
        <div className="task-card__header">
          {onComplete && !archived && (
            <button
              className={`task-card__check${task.status === "completed" ? " task-card__check--done" : ""}`}
              onClick={() => onComplete(task as Task)}
              title={
                task.status === "completed"
                  ? "Mark as pending"
                  : "Mark as completed"
              }
              aria-label="Toggle complete"
            >
              {task.status === "completed" ? "✓" : ""}
            </button>
          )}
          <div className="task-card__info">
            <span className="task-card__title">{task.title}</span>
            {task.description && (
              <span className="task-card__desc">{task.description}</span>
            )}
          </div>
        </div>

        <div className="task-card__meta">
          <span className={`task-card__priority task-card__priority--${task.priority}`}>
            {task.priority}
          </span>
          <span className="task-card__date">
            {formatDueDate(task.due_date)}
            {showDaysOverdue && daysOverdue > 0 && (
              <span className="task-card__overdue-badge">
                {daysOverdue} {daysOverdue === 1 ? "day" : "days"} overdue
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="task-card__actions">
        {onRestore && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => onRestore(task as Task)}
          >
            Restore
          </button>
        )}
        {onEdit && !archived && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => onEdit(task as Task)}
          >
            Edit
          </button>
        )}
        {onDelete && !archived && (
          <button
            className="btn btn--danger btn--sm"
            onClick={() => onDelete(task as Task)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
