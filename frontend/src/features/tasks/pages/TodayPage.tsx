import { useState, useCallback } from "react";
import { apiGetDashboard, apiCreateTask } from "../api";
import { getLocalToday, formatDueDate } from "../utils";
import TaskCard from "../components/TaskCard";
import TaskForm from "../components/TaskForm";
import Modal from "@/components/shared/Modal";
import Loader from "@/components/shared/Loader";
import TaskEditDeleteModals from "../components/TaskEditDeleteModals";
import { useAsync } from "@/hooks/useAsync";
import { useTaskMutations } from "../hooks/useTaskMutations";

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
  if (error) return <div className="page-error">{error}</div>;
  if (!data) return null;

  const todayFormatted = formatDueDate(today);
  const totalPending = data.overdue.length + data.today.length;

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Today</h1>
          <p className="page__subtitle">{todayFormatted}</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          + Add Task
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card summary-card--overdue">
          <span className="summary-card__count">{data.overdue.length}</span>
          <span className="summary-card__label">Overdue</span>
        </div>
        <div className="summary-card summary-card--today">
          <span className="summary-card__count">{data.today.length}</span>
          <span className="summary-card__label">Today</span>
        </div>
        <div className="summary-card summary-card--completed">
          <span className="summary-card__count">{data.completed_today.length}</span>
          <span className="summary-card__label">Completed</span>
        </div>
      </div>

      {totalPending === 0 && data.completed_today.length === 0 && (
        <div className="empty-state">
          <p>Nothing due today. Enjoy your day!</p>
        </div>
      )}

      {data.overdue.length > 0 && (
        <section className="task-section">
          <h2 className="task-section__heading task-section__heading--overdue">
            Overdue
          </h2>
          <div className="task-list">
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
        <section className="task-section">
          <h2 className="task-section__heading task-section__heading--today">
            Today
          </h2>
          <div className="task-list">
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
        <section className="task-section">
          <h2 className="task-section__heading task-section__heading--completed">
            Completed
          </h2>
          <div className="task-list">
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
