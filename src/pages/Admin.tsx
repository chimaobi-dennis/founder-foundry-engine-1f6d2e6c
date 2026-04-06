// This page is replaced by the admin sub-routes.
// Redirect to the new admin dashboard.
import { Navigate } from "react-router-dom";
export default function Admin() {
  return <Navigate to="/admin" replace />;
}
