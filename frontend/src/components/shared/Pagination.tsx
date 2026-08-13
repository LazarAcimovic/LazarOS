interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button
        className="btn btn--ghost btn--sm"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Prev
      </button>
      <span className="pagination__info">
        {page} / {totalPages}
      </span>
      <button
        className="btn btn--ghost btn--sm"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
