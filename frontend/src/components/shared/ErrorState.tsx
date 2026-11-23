import { Alert } from "@/components/ui/alert";

export default function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="m-8 w-auto text-center">
      {message}
    </Alert>
  );
}
