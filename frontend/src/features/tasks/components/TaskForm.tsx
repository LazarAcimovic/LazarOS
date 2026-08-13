import { useState, FormEvent, useEffect } from "react";
import { Task } from "../models";
import { createTaskSchema, editTaskSchema } from "../validation";
import { getApiError } from "@/shared/utils";

interface Props {
  onSubmit: (data: {
    title: string;
    description?: string;
    due_date: string;
    priority: "low" | "medium" | "high";
    status?: "pending" | "completed";
  }) => Promise<void>;
  onCancel: () => void;
  initialValues?: Task;
  mode: "create" | "edit";
}

export default function TaskForm({
  onSubmit,
  onCancel,
  initialValues,
  mode,
}: Props) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState<string>(
    initialValues?.description ?? ""
  );
  const [due_date, setDueDate] = useState(initialValues?.due_date ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">(
    initialValues?.priority ?? "medium"
  );
  const [status, setStatus] = useState<"pending" | "completed">(
    initialValues?.status ?? "pending"
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (initialValues) {
      setTitle(initialValues.title);
      setDescription(initialValues.description ?? "");
      setDueDate(initialValues.due_date);
      setPriority(initialValues.priority);
      setStatus(initialValues.status);
    }
  }, [initialValues]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError("");

    const raw = { title, description, due_date, priority, status };
    const schema = mode === "create" ? createTaskSchema : editTaskSchema;
    const result = schema.safeParse(raw);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const key = String(err.path[0]);
        fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit({
        title,
        description: description || undefined,
        due_date,
        priority,
        ...(mode === "edit" ? { status } : {}),
      });
    } catch (err: unknown) {
      setServerError(getApiError(err, "Something went wrong"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      {serverError && <div className="task-form__error">{serverError}</div>}

      <div className="form-group">
        <label className="form-group__label" htmlFor="tf-title">
          Title <span className="form-group__required">*</span>
        </label>
        <input
          id="tf-title"
          className={`form-group__input${errors.title ? " form-group__input--error" : ""}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
        />
        {errors.title && (
          <span className="form-group__error">{errors.title}</span>
        )}
      </div>

      <div className="form-group">
        <label className="form-group__label" htmlFor="tf-desc">
          Description
        </label>
        <textarea
          id="tf-desc"
          className="form-group__textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={3}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-group__label" htmlFor="tf-date">
            Due Date <span className="form-group__required">*</span>
          </label>
          <input
            id="tf-date"
            className={`form-group__input${errors.due_date ? " form-group__input--error" : ""}`}
            type="date"
            value={due_date}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {errors.due_date && (
            <span className="form-group__error">{errors.due_date}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-group__label" htmlFor="tf-priority">
            Priority
          </label>
          <select
            id="tf-priority"
            className="form-group__select"
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value as "low" | "medium" | "high")
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {mode === "edit" && (
          <div className="form-group">
            <label className="form-group__label" htmlFor="tf-status">
              Status
            </label>
            <select
              id="tf-status"
              className="form-group__select"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "pending" | "completed")
              }
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}
      </div>

      <div className="task-form__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={isLoading}
        >
          {isLoading
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
            ? "Create Task"
            : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
