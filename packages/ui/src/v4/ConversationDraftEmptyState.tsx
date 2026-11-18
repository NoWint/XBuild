/** 草稿首页真实问候：保留时间边界和 Office 文案，展示使用共享 voice 字体角色。 */
import { useEffect, useState } from "react";
import { cn } from "@/components/lib/utils.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { useIsOfficeMode } from "@/hooks/useInterfaceMode.js";
import { ZCodeAboutLogo } from "@/components/ui/ZCodeAboutLogo.js";
import { motion, useReducedMotion } from "motion/react";

const GREETING_BOUNDARY_HOURS = [5, 9, 12, 14, 18, 23] as const;

export type ChatEmptyGreetingMessageId =
  | "chat.empty.greeting.morningEarly"
  | "chat.empty.greeting.morning"
  | "chat.empty.greeting.noon"
  | "chat.empty.greeting.afternoon"
  | "chat.empty.greeting.evening"
  | "chat.empty.greeting.lateNight";

export function getChatEmptyGreetingMessageId(date: Date = new Date()): ChatEmptyGreetingMessageId {
  const hour = date.getHours();
  if (hour >= 5 && hour < 9) return "chat.empty.greeting.morningEarly";
  if (hour >= 9 && hour < 12) return "chat.empty.greeting.morning";
  if (hour >= 12 && hour < 14) return "chat.empty.greeting.noon";
  if (hour >= 14 && hour < 18) return "chat.empty.greeting.afternoon";
  if (hour >= 18 && hour < 23) return "chat.empty.greeting.evening";
  return "chat.empty.greeting.lateNight";
}

export function getNextChatEmptyGreetingDelayMs(date: Date = new Date()) {
  const candidates = GREETING_BOUNDARY_HOURS.map((hour) => {
    const boundary = new Date(date);
    boundary.setHours(hour, 0, 0, 0);
    return boundary;
  });
  const tomorrowFirstBoundary = new Date(date);
  tomorrowFirstBoundary.setDate(tomorrowFirstBoundary.getDate() + 1);
  tomorrowFirstBoundary.setHours(GREETING_BOUNDARY_HOURS[0], 0, 0, 0);
  const nextBoundary =
    candidates.find((candidate) => candidate.getTime() > date.getTime()) ?? tomorrowFirstBoundary;
  return Math.max(1, nextBoundary.getTime() - date.getTime());
}

export function ConversationDraftEmptyState({
  className,
  compactForRemoteControl = false,
}: {
  className?: string;
  compactForRemoteControl?: boolean;
}) {
  const { intl } = useZCodeIntl();
  const isOfficeMode = useIsOfficeMode();
  const reducedMotion = useReducedMotion() === true;
  const [greetingDate, setGreetingDate] = useState(() => new Date());
  const greeting = intl.formatMessage({
    id: isOfficeMode ? "chat.empty.greeting.office" : getChatEmptyGreetingMessageId(greetingDate),
  });

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setGreetingDate(new Date()),
      getNextChatEmptyGreetingDelayMs(greetingDate),
    );
    return () => window.clearTimeout(timeout);
  }, [greetingDate]);

  return (
    <div
      className={cn(
        "xb-reading-rail relative mb-4 flex min-w-0 flex-col items-center justify-center text-foreground",
        className,
      )}
    >
      {/* XBuild 尖星来自用户提供的横版标识；沿用既有 Logo 入口，不复制 Claude 八芒星。
          借鉴 Lusion 的分段进场，但只播放一次，不引入持续 WebGL 或背景粒子。 */}
      <motion.div
        data-v4-draft-greeting-group="true"
        initial={reducedMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.56, ease: [0.16, 1, 0.3, 1] }}
        className="flex min-w-0 items-center justify-center gap-3 px-4"
      >
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, rotate: -24, scale: 0.72 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.68, ease: [0.16, 1, 0.3, 1] }}
          className="flex size-9 shrink-0 items-center justify-center text-[var(--desktop-brand-accent)]"
        >
          <ZCodeAboutLogo
            data-brand="xbuild"
            data-testid="v4-draft-brand-mark"
            className="size-8"
          />
        </motion.div>
        <h1
          data-v4-draft-greeting="true"
          className={cn(
            "xb-greeting min-w-0 text-center font-voice text-foreground",
            compactForRemoteControl ? "text-ui-welcome-compact" : "text-ui-welcome",
          )}
        >
          {greeting}
        </h1>
      </motion.div>
    </div>
  );
}
