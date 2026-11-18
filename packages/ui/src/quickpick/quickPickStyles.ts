export const quickPickDialogClassName =
  "top-1/2 max-w-lg -translate-y-1/2 overflow-hidden rounded-2xl! border-popover-border bg-popover p-0 shadow-md";

// 原因：CommandGroup 显式声明 base 标题；只在 quick pick 范围覆盖为分区辅助字号。
export const quickPickCommandClassName =
  "rounded-2xl bg-popover p-0.5 text-foreground [&_[cmdk-group-heading]]:text-ui-sm!";

export const quickPickInputClassName = "text-ui-base";

export const quickPickListClassName = "max-h-[min(460px,64vh)] py-0.5";

export const quickPickItemClassName =
  "xb-sidebar-row items-center rounded-md px-2.5 py-0.5 text-ui-caption";

export const quickPickShortcutPillClassName =
  "inline-flex h-4 min-w-7 items-center justify-center rounded-sm bg-surface px-1 py-0 font-sans text-ui-xs leading-none tracking-normal text-foreground-subtle";

export const quickPickMetadataClassName =
  "max-w-[45%] truncate font-sans text-ui-sm leading-none tracking-normal text-foreground-subtle";
