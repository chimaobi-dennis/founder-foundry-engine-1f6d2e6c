import { Hexagon } from "lucide-react";

export default function LogoStudio() {
  return (
    <div
      className="min-h-full flex flex-col items-center justify-center px-6 py-20"
      style={{ background: "#0D1B2A" }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: "rgba(212,160,23,0.10)" }}
      >
        <Hexagon size={26} style={{ color: "#D4A017" }} />
      </div>
      <h1
        className="text-[20px] font-display font-semibold mb-2 text-center"
        style={{ color: "#F5F0E8" }}
      >
        Logo Studio
      </h1>
      <p
        className="text-[13px] font-ui text-center max-w-xs"
        style={{ color: "#8A96A3" }}
      >
        AI-powered logo generation is coming soon. Your brand identity, built from context.
      </p>
    </div>
  );
}
