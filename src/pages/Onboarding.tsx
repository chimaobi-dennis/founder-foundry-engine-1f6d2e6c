import { Navigate } from "react-router-dom";

/** The three-question onboarding is gone; the first run is /start (understanding first). */
export default function Onboarding() {
  return <Navigate to="/start" replace />;
}
