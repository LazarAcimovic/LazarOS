import { useState } from "react";
import { Task, UpdateTaskDTO } from "../models";
import { apiUpdateTask, apiDeleteTask } from "../api";

export function useTaskMutations(reload: () => void) {
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleComplete = async (task: Task) => {
    await apiUpdateTask(task.id, {
      status: task.status === "completed" ? "pending" : "completed",
    });
    reload();
  };

  const handleEdit = (task: Task) => setEditTask(task);
  const handleDelete = (task: Task) => setDeleteTask(task);

  const handleUpdate = async (values: UpdateTaskDTO) => {
    if (!editTask) return;
    await apiUpdateTask(editTask.id, values);
    setEditTask(null);
    reload();
  };

  const confirmDelete = async () => {
    if (!deleteTask) return;
    setIsDeleting(true);
    try {
      await apiDeleteTask(deleteTask.id);
      setDeleteTask(null);
      reload();
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    editTask,
    setEditTask,
    deleteTask,
    setDeleteTask,
    isDeleting,
    handleComplete,
    handleEdit,
    handleDelete,
    handleUpdate,
    confirmDelete,
  };
}
