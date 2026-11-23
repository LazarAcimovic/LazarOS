import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <Button
        variant="ghost"
        size="sm"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Prev
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </Button>
    </div>
  );
}
