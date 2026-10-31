import { cn } from "@/components/lib/utils.js";

/**
 * XBuild 品牌 mark（来自 Xiatian AI 中转站 nowint.qzz.io 的几何标识）：
 * r6 圆角方块 + 内嵌镂空方块，对角线金属光泽。currentColor 适配明暗主题。
 */
export function ZCodeAboutLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 21 21"
      fill="none"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="xbuild-mark-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="0.5" stopColor="#6f6f6f" />
          <stop offset="1" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#xbuild-mark-sheen)"
        d="M6 0 H15 A6 6 0 0 1 21 6 V15 A6 6 0 0 1 15 21 H6 A6 6 0 0 1 0 15 V6 A6 6 0 0 1 6 0 Z M7.5 5.5 H13.5 A2 2 0 0 1 15.5 7.5 V13.5 A2 2 0 0 1 13.5 15.5 H7.5 A2 2 0 0 1 5.5 13.5 V7.5 A2 2 0 0 1 7.5 5.5 Z"
      />
    </svg>
  );
}

/** 字标锁底：mark + XBuild 文本（SVG text 继承应用字体）。 */
export function ZCodeWordmarkLogo({ className }: { className?: string }) {
  return (
    <svg
      width="244"
      height="54"
      viewBox="0 0 244 54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="xbuild-wordmark-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="0.5" stopColor="#6f6f6f" />
          <stop offset="1" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <g transform="scale(2.5714)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          fill="url(#xbuild-wordmark-sheen)"
          d="M6 0 H15 A6 6 0 0 1 21 6 V15 A6 6 0 0 1 15 21 H6 A6 6 0 0 1 0 15 V6 A6 6 0 0 1 6 0 Z M7.5 5.5 H13.5 A2 2 0 0 1 15.5 7.5 V13.5 A2 2 0 0 1 13.5 15.5 H7.5 A2 2 0 0 1 5.5 13.5 V7.5 A2 2 0 0 1 7.5 5.5 Z"
        />
      </g>
      <text
        x="68"
        y="39"
        fill="currentColor"
        fontSize="36"
        fontWeight="600"
        letterSpacing="-1"
      >
        XBuild
      </text>
    </svg>
  );
}
