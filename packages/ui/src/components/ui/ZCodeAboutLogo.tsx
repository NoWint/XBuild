import { cn } from "@/components/lib/utils.js";
import type { SVGProps } from "react";

/**
 * XBuild 四向尖星：由用户提供的 Xiatian AI 横版标识提取几何，不使用 Claude 品牌图形。
 * currentColor 适配明暗主题；缩放后仍保持细长、非对称的放射轮廓。
 */
export function ZCodeAboutLogo({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="none"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        fill="currentColor"
        d="M50 0 L55.9 42.1 L100 17.4 L59.4 50.1 L83.7 100 L49.6 58 L0 78.9 L43.4 49.5 L10.9 17.1 L47.7 42.3 Z"
      />
    </svg>
  );
}

/** 字标锁底：mark + XBuild 文本（SVG text 继承应用字体）。 */
export function ZCodeWordmarkLogo({ className }: { className?: string }) {
  return (
    <svg
      width="150"
      height="40"
      viewBox="0 0 150 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        transform="translate(4 4) scale(0.32)"
        fill="currentColor"
        d="M50 0 L55.9 42.1 L100 17.4 L59.4 50.1 L83.7 100 L49.6 58 L0 78.9 L43.4 49.5 L10.9 17.1 L47.7 42.3 Z"
      />
      <text x="44" y="29" fill="currentColor" fontSize="25" fontWeight="500" letterSpacing="0">
        XBuild
      </text>
    </svg>
  );
}
