import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";

export function NotFoundPage() {
  return (
    <div className="space-y-5 pb-6">
      <Link to="/" className="action-button-secondary">
        Back to home
      </Link>
      <EmptyState
        title="That page does not exist."
        description="Use the plant library on the home page to open a valid plant detail route."
      />
    </div>
  );
}
