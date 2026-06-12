"use client";

/* Eventful button - stacked-shadow system, styled by the .ev-btn classes in
   globals.css so hover/press/focus states stay theme-aware (light: accent +
   ink layers; dark: accent + cream layers). */

import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "warm" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: Props) {
  const classes = [
    "ev-btn",
    `ev-btn--${variant}`,
    `ev-btn--${size}`,
    fullWidth ? "ev-btn--full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
