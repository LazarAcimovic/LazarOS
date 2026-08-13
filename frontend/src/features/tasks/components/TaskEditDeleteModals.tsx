import Modal from "@/components/shared/Modal";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import TaskForm from "./TaskForm";
import { useTaskMutations } from "../hooks/useTaskMutations";

interface Props {
  mutations: ReturnType<typeof useTaskMutations>;
}

export default function TaskEditDeleteModals({ mutations }: Props) {
  const {
    editTask,
    setEditTask,
    handleUpdate,
    deleteTask,
    setDeleteTask,
    confirmDelete,
    isDeleting,
  } = mutations;

  return (
    <>
      {editTask && (
        <Modal title="Edit Task" onClose={() => setEditTask(null)}>
          <TaskForm
            mode="edit"
            initialValues={editTask}
            onSubmit={handleUpdate}
            onCancel={() => setEditTask(null)}
          />
        </Modal>
      )}
      {deleteTask && (
        <Modal title="Delete Task" onClose={() => setDeleteTask(null)}>
          <ConfirmDialog
            message={`Delete "${deleteTask.title}"?`}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTask(null)}
            isLoading={isDeleting}
          />
        </Modal>
      )}
    </>
  );
}
