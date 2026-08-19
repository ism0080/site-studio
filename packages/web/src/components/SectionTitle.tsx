import "./SectionTitle.css";
import type { ReactNode } from "react";

export default function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <span>{children}</span>
      {action}
    </div>
  );
}
