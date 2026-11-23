import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col gap-5">
      <p className="text-sm text-foreground">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );
}
