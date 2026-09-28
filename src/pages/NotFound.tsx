import { Link } from "react-router-dom";
import { Logo } from "@/components/ui";

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6 text-center">
    <Logo />
    <h1 className="text-5xl font-extrabold">404</h1>
    <p className="text-ink-muted">This aisle doesn't exist.</p>
    <Link to="/" className="btn-primary btn-md">
      Back to home
    </Link>
  </div>
);

export default NotFound;
