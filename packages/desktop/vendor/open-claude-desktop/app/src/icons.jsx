import React from "react";
import * as Phosphor from "@phosphor-icons/react";

// 上游私有图标字体的语义名保留为组件接口，绘制统一使用随壳提供的 MIT Phosphor。
// 不把私有字体的码点、轮廓或字体文件重新带入公开分发。
const aliases = {
  Activity: "Pulse", Add: "Plus", AddCircle: "PlusCircle", AddLarge: "Plus",
  ActivityFilled: "Pulse",
  Agent: "Robot", AgentsSimple: "Users", AgentSimple: "Robot", Android: "AndroidLogo",
  Ant: "Bug", Apple: "AppleLogo", ArrowDownCircle: "ArrowCircleDown",
  ArrowInSquare: "ArrowSquareIn", ArrowLeftCircle: "ArrowCircleLeft",
  ArrowOutSquare: "ArrowSquareOut", ArrowReturn: "ArrowBendDownLeft",
  ArrowRightCircle: "ArrowCircleRight", ArrowSplitRight: "ArrowsSplit",
  ArrowUpCircle: "ArrowCircleUp", Artifacts: "Package", Attachment: "Paperclip",
  Batch: "Stack", Beaker: "Flask", BookClosed: "Book", BookText: "BookOpenText",
  Box: "Package", BrowseSelect: "CursorClick", Bullhorn: "Megaphone", Cache: "Database",
  Capacity: "Gauge", CaretDownUp: "CaretUpDown", ChangesPlusMinus: "GitDiff",
  ChangesPlusMinusFilled: "GitDiff", Chart: "ChartBar", ChatAdd: "ChatCircle",
  ChatAddFilled: "ChatCircle", ChatDelete: "ChatCircleSlash", ChatDeleteFilled: "ChatCircleSlash",
  ChatFilled: "ChatCircle", ChatSimple: "Chat", ChatSimpleFilled: "Chat", ChatsFilled: "Chats",
  CheckCircleFilled: "CheckCircle", CheckDouble: "Checks", Checklist: "ListChecks",
  ChecklistFilled: "ListChecks", ClipboardArrow: "Clipboard", CloudFilled: "Cloud",
  CloudSlashFilled: "CloudSlash", CodeBrackets: "BracketsCurly", CodeFilled: "Code",
  CoffeeCup: "Coffee", Collapse: "ArrowsIn", CommandCard: "Cards", CommandLine: "Terminal",
  CommandLineFilled: "Terminal", CommandLinePrompt: "TerminalWindow", Compact: "ArrowsInLineVertical",
  Computer: "Desktop", ComputerClassic: "DesktopTower", Concierge: "Bell", Connectors: "PlugsConnected",
  Create: "PencilSimple", CursorFilled: "Cursor", DNA: "Dna", Disconnect: "Plugs",
  Dispatch: "PaperPlaneRight", DollarSign: "CurrencyDollar", DotsCircle: "DotsThreeCircle",
  DotsHorizontal: "DotsThree", DotsVertical: "DotsThreeVertical", Edit: "PencilSimple",
  EditFilled: "PencilSimple", Email: "Envelope", Evals: "ChartLineUp", Expand: "ArrowsOut",
  ExtendedThinking: "Brain", Fastforward: "FastForward", FileAdd: "FilePlus", FileUpload: "UploadSimple",
  Filter: "Funnel", GhostFilled: "Ghost", GitMergeConflict: "GitMerge", GitMergedSimple: "GitMerge",
  GitMergeQueue: "GitPullRequest", GitPullRequestClosed: "GitPullRequest", GitPullRequestDraft: "GitPullRequest",
  Github: "GithubLogo", Grid: "SquaresFour", Haptics: "Vibrate", Help: "Question", History: "ClockCounterClockwise",
  Home: "House", ID: "IdentificationCard", Indent: "TextIndent", InfoSimple: "Info",
  Interactive: "HandPointing", LaptopFilled: "Laptop", LaptopSlash: "Laptop", Library: "Books",
  Linux: "LinuxLogo", ListAdd: "ListPlus", ListBullet: "ListBullets", ListNumbered: "ListNumbers",
  Location: "MapPin", LocationQuestionMark: "MapPin", LocationSlash: "MapPin", LockShield: "ShieldCheck",
  Logout: "SignOut", Mcp: "PlugsConnected", Mention: "At", Menu: "List", MicrophoneFilled: "Microphone",
  MobilePhone: "DeviceMobile", MoonFilled: "Moon", NotificationSlash: "BellSlash", Organization: "Buildings",
  Owl: "Bird", PaletteFilled: "Palette", Pin: "PushPin", PinFilled: "PushPin", PinSlash: "PushPinSlash",
  PlayCircleFilled: "PlayCircle", PlayFilled: "Play", Plugin: "PuzzlePiece", Press: "HandTap",
  Pro: "Sparkle", Projects: "FolderOpen", ProjectsFilled: "FolderOpen", ProjectsX: "FolderMinus",
  Prompt: "TerminalWindow", Recording: "Record", Reorder: "List", Research: "MagnifyingGlass",
  Screenshare: "Screencast", Search: "MagnifyingGlass", SearchCircle: "MagnifyingGlass", Select: "Selection",
  Settings: "Gear", ShareAndroid: "ShareNetwork", ShieldSearch: "ShieldCheck",
  SidebarClose: "Sidebar", SidebarOpen: "Sidebar", SlashShortcutCommand: "Command", Slides: "Presentation",
  Sort: "ArrowsDownUp", Speaker: "SpeakerHigh", Spreadsheet: "Table", StarFilled: "Star", StarSlash: "Star",
  StopFilled: "Stop", Styles: "PaintBrush", SunFilled: "Sun", Tasks: "CheckSquare", Team: "UsersThree",
  Temperature: "Thermometer", TemperatureSimple: "Thermometer", TextBold: "TextB", TextItalics: "TextItalic",
  ThumbsDownFilled: "ThumbsDown", ThumbsUpFilled: "ThumbsUp", Toggles: "ToggleRight", Token: "Coins",
  Tool: "Wrench", Trust: "ShieldCheck", Verified: "SealCheck", Voice: "Microphone", WarningShield: "Warning",
  Windows: "WindowsLogo", Workspace: "Desktop", WrenchFilled: "Wrench", Orbit: "Globe", SidebarRight: "Sidebar",
  MinimizeBottomLeft: "ArrowDownLeft", MinimizeBottomRight: "ArrowDownRight", MinimizeTopLeft: "ArrowUpLeft",
  MinimizeTopRight: "ArrowUpRight", EyeFrame: "Eye", Frame: "FrameCorners", HealthConnect: "Heart",
  Scale: "Scales", Goal: "Target", ProgressQuarter: "Circle", UsageGaugeHigh: "Gauge", UsageGaugeMiddle: "Gauge",
  Quote: "Quotes", MemorySlash: "Memory", WindowNew: "AppWindow", BookmarkFilled: "Bookmark",
  AlignStretch: "AlignCenterHorizontal", ArrowLine: "ArrowLineRight", Diagram: "TreeStructure", Dropdown: "CaretDown",
  EyeDropper: "Eyedropper", FrameHash: "Hash", Heading1: "TextHOne", Heading2: "TextHTwo", Heading3: "TextHThree",
  JustifyCenter: "TextAlignCenter", LineHeight: "Textbox", Outdent: "TextOutdent", TextHighlight: "Highlighter",
  ZoomIn: "MagnifyingGlassPlus", ZoomOut: "MagnifyingGlassMinus", AlignCenter: "TextAlignCenter",
  AlignEnd: "TextAlignRight", AlignStart: "TextAlignLeft", CornerBottomLeft: "ArrowDownLeft",
  CornerBottomRight: "ArrowDownRight", CornerTopLeft: "ArrowUpLeft", CornerTopRight: "ArrowUpRight",
  JustifyEnd: "TextAlignRight", JustifySpaceBetween: "TextAlignJustify", JustifyStart: "TextAlignLeft",
  LetterSpacing: "Textbox", TableCellSplit: "Table", TableCellsMerge: "Table", TableColumnDelete: "Table",
  TableColumnInsertLeft: "Table", TableColumnInsertRight: "Table", TableRowDelete: "Table",
  TableRowInsertAbove: "Table", TableRowInsertBelow: "Table", SmileyAdd: "Smiley", SideBottom: "Sidebar",
  SideLeft: "Sidebar", SideRight: "Sidebar", SideTop: "Sidebar", Comment: "ChatCenteredText",
  CommentFilled: "ChatCenteredText", FolderLink: "Folder", CirclesAdd: "CirclesThreePlus",
  Collection: "Cards", ListCard: "Cards", Placeholder: "Placeholder",
};

export function Icon({ name, size = 16, weight = "regular", className = "", customIcon, ...props }) {
  if (customIcon) return <svg {...props} aria-hidden="true" data-cds="Icon" width={size} height={size} viewBox={`0 0 ${customIcon.viewBox} ${customIcon.viewBox}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {customIcon.paths.map((path, index) => typeof path === "string" ? <path key={index} d={path} /> : <path key={index} {...path} />)}
  </svg>;
  const Component = Phosphor[aliases[name] ?? name] ?? Phosphor.Placeholder;
  return <Component {...props} aria-hidden="true" data-cds="Icon" size={size} weight={weight === "strong" ? "bold" : "regular"} className={className} />;
}
const make = (name) => (props) => <Icon name={name} {...props} />;
export const SidebarSimple = make("Sidebar"), ArrowLeft = make("ArrowLeft"), ArrowRight = make("ArrowRight"),
  Plus = make("Add"), Code = make("Code"), ChatCircle = make("Chat"), Folder = make("Folder"),
  FolderOpen = make("FolderOpen"), CaretDown = make("CaretDown"), CaretRight = make("CaretRight"),
  ArrowUp = make("ArrowUp"), Stop = make("Stop"), Check = make("Check"), Terminal = make("CommandLine"),
  FileText = make("File"), X = make("X"), MagnifyingGlass = make("Search"), Gear = make("Settings"),
  SquaresFour = make("Grid"), Sun = make("Sun"), Moon = make("Moon"), Paperclip = make("Attachment"),
  ArrowClockwise = make("ArrowClockwise"), GitBranch = make("GitBranch"), ShieldCheck = make("Trust"),
  Copy = make("Copy"), WarningCircle = make("WarningCircle"), Monitor = make("Laptop"), Files = make("Files"),
  Clock = make("Clock"), SignIn = make("User"), ArrowsOutSimple = make("ArrowsOut"), DotsThree = make("DotsHorizontal");
