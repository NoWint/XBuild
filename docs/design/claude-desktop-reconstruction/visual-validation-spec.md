# Desktop UI 视觉验收工具规格

2026-11-14；属于 UI Reconstruction 的工程验收，不是 App 业务单测。

## 输入与证据

- 工具读取用户合法提供/测试生成的 PNG，不执行图片目录中的代码，不访问 Claude profile、credentials 或聊天记录。
- `reference` 与 `candidate` 必须具有完全相同的像素宽高；不得缩放参考图去制造通过。
- 一对 metadata 必须同时提供或同时省略。提供时，要求 viewport、deviceScaleFactor、light/dark theme、state 完全一致；记录 reference product/version 与 source。不带 metadata 的数学比较只能称为 unverified image comparison，不能认证产品像素一致。
- 可显式提供有 reason 的 ignore rectangles；必须在图像内，不能把全部像素排除，报告 ignored/compared pixels 和原坐标。不得自动忽略消息、品牌、字体或失败区域。
- 默认 threshold 0.1（归一化每通道差异），maxDifferenceRatio 0.01。参数必须有限且在 [0,1] 内。数值只衡量所提供的截图，不证明未测页面/交互。

## 接口

`compareDesktopImages({referencePath, candidatePath, outputDirectory, threshold = 0.1, maxDifferenceRatio = 0.01, referenceMetadataPath, candidateMetadataPath, ignore = []})` 异步返回结果。`ignore` 为 `{x,y,width,height,reason}` 数组。

结果至少包含：status（matched/different）、certification（verified-state/unverified）、width、height、totalPixels、comparedPixels、ignoredPixels、differentPixels、differenceRatio、meanChannelDelta、maxChannelDelta、differenceBounds（无差异为 null）、threshold、maxDifferenceRatio、source metadata、outputs。

输出目录必须不存在或为空；拒绝覆盖非空目录、任一输入文件或 metadata。成功写入 `overlay.png`（50/50 混合）、`difference.png`（高对比差异）、`comparison.json`、`index.html`（原图/候选、Overlay 滑块和 Difference 可视化）。输出只引用本地副本，不上传外部服务；HTML 标签、标题、reason、metadata 必须转义。只有完整产物写入成功才返回 matched/different；IO 或解码失败明确报错，不计为 pass。

透明像素按可见合成色比较，不将全透明像素内部不同 RGB 当成差异；alpha 的可见变化需要计入。使用现有 CLI adapters 的公开 npm `jimp` 依赖处理 PNG，不导入 adapters 内部实现，不新增包依赖。所有文件 IO 异步。

## CLI

```bash
node scripts/compare-desktop-ui.mjs --reference ref.png --candidate xbuild.png --out-dir evidence/comparison
```

可选 `--reference-meta` / `--candidate-meta`、`--threshold`、`--max-difference-ratio`、`--ignore <json>`；`--help` 无副作用。matched 退出 0，different 退出 1，参数/metadata/输入/IO 错误退出 2。reference 缺失是错误，不输出虚构 score。

## 工程回归（先写后实现）

`node --test scripts/test/desktop-ui-visual-compare.test.mjs`：

1. help 返回 0，无输出文件。
2. 手工构造相同 2×2 PNG：differentPixels=0、ratio=0、bounds=null，真实输出可解码。
3. 手工构造一个完全不同像素：differentPixels=1、ratio=0.25，bounds 为该像素；maxRatio 0.01 时 different/exit1。
4. 两张全透明 PNG 隐藏 RGB 不同：零可见差异；opaque/transparent 的可见变化检测为不同。
5. 尺寸不等、NaN/Infinity/负值/超范围 threshold、缺失 reference、损坏 PNG 均报错且没有 matched。
6. 单个 ignored rectangle 排除指定不同像素，记录面积；越界/无 reason/全遮罩拒绝。
7. metadata theme/state/viewport/deviceScaleFactor 不等拒绝；一侧缺失拒绝；同状态包含 verified-state 但不泛化为全 app certification。
8. 非空 outputDirectory/与 input 相同/HTML injection 不得覆盖输入或执行内容。

独立真实浏览器回归为 `scripts/test/desktop-ui-visual-compare.browser.test.mjs`。通过
`DESKTOP_UI_VISUAL_BROWSER_PATH` 显式指定已有 Chromium；不下载浏览器或改项目依赖。
它在隔离 loopback 页面中实际截图验证 0/50/100% 的 RGBA 混合、透明 candidate
不会露出 reference、默认 checkerboard 与生成的 `overlay.png` 一致，以及本地 CSP/无外部请求。
JSDOM 的滑块事件检查只证明 DOM 行为，不声称像素合成或 CSP 通过。

## 完成口径

工程数学夹具通过不等于 Claude vs XBuild 验收通过。本机官方参考图未取得时，产品视觉报告明确 reference-capture-blocked；仍交付可运行工具、XBuild 窗口截图与计算样式测量。官方截图可用后使用同状态 metadata 执行真实对比。
