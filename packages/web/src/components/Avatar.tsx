import "./Avatar.css";
import type { ElementType } from "react";

export default function Avatar({
  name,
  variant = "profile",
  title,
  onClick,
}: {
  name: string | null | undefined;
  variant?: "profile" | "user";
  title?: string;
  onClick?: () => void;
}) {
  const Tag: ElementType = variant === "user" ? "button" : "div";
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <Tag data-component="avatar" data-variant={variant} title={title} onClick={onClick}>
      {initials}
    </Tag>
  );
}
