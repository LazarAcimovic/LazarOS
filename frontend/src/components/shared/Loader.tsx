import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="loader flex justify-center p-10">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}
