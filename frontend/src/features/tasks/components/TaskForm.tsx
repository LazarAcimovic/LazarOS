import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Task } from "../models";
import { createTaskSchema, editTaskSchema, type EditTaskValues } from "../models";
import { getApiError } from "@/shared/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Native <select> kept (suites drive it with selectOptions); styled to match the shadcn Input.
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

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
  const toValues = (t?: Task): EditTaskValues => ({
    title: t?.title ?? "",
    description: t?.description ?? "",
    due_date: t?.due_date ?? "",
    priority: t?.priority ?? "medium",
    status: t?.status ?? "pending",
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditTaskValues>({
    resolver: zodResolver(
      mode === "create" ? createTaskSchema : editTaskSchema
    ) as unknown as Resolver<EditTaskValues>,
    defaultValues: toValues(initialValues),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (initialValues) reset(toValues(initialValues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, reset]);

  const onValid = async (values: EditTaskValues) => {
    setServerError("");
    setIsLoading(true);
    try {
      await onSubmit({
        title: values.title,
        description: values.description || undefined,
        due_date: values.due_date,
        priority: values.priority,
        ...(mode === "edit" ? { status: values.status } : {}),
      });
    } catch (err: unknown) {
      setServerError(getApiError(err, "Something went wrong"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        setServerError("");
        return handleSubmit(onValid)(e);
      }}
      noValidate
    >
      {serverError && <Alert variant="destructive">{serverError}</Alert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tf-title">
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="tf-title"
          type="text"
          {...register("title")}
          placeholder="Task title"
          aria-invalid={errors.title ? true : undefined}
        />
        {errors.title && (
          <span className="text-xs text-destructive">{errors.title.message}</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tf-desc">Description</Label>
        <Textarea
          id="tf-desc"
          {...register("description")}
          placeholder="Optional description"
          rows={3}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
          <Label htmlFor="tf-date">
            Due Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="tf-date"
            type="date"
            {...register("due_date")}
            aria-invalid={errors.due_date ? true : undefined}
          />
          {errors.due_date && (
            <span className="text-xs text-destructive">{errors.due_date.message}</span>
          )}
        </div>

        <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
          <Label htmlFor="tf-priority">Priority</Label>
          <select
            id="tf-priority"
            className={SELECT_CLASS}
            {...register("priority")}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {mode === "edit" && (
          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
            <Label htmlFor="tf-status">Status</Label>
            <select
              id="tf-status"
              className={SELECT_CLASS}
              {...register("status")}
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
            ? "Create Task"
            : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
