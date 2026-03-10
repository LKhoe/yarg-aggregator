import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ChartEditor } from "@/components/chart-editor/ChartEditor";

function ChartEditorContent() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <ChartEditor />
    </div>
  );
}

export default function ChartEditorPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <ChartEditorContent />
    </ProtectedRoute>
  );
}
