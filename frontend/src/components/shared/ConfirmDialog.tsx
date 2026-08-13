interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  isLoading,
}: Props) {
  return (
    <div className="confirm">
      <p className="confirm__message">{message}</p>
      <div className="confirm__actions">
        <button className="btn btn--ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button
          className="btn btn--danger"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
