# 桌面宠物

桌面宠物是一个 Codex 技能，用于将你提供的实拍照片、视频或现有离线动画制作成可交互的桌面宠物。它以大巴的制作过程为例，覆盖实拍选帧、透明窗口、拖动、散步、光圈互动、叫声和离线打包。

## 在 Codex 中使用

将仓库放到 Codex 的技能目录下，文件夹命名为 `desktop-pet`，让 `SKILL.md` 直接位于该文件夹内。随后在 Codex 中输入 `$desktop-pet`，说明要使用的素材、目标平台和想要的互动。

> 使用 $desktop-pet，基于我提供的宠物视频做一个可离线安装的 macOS 和 Windows 桌面宠物。

## 文件

- [技能入口](SKILL.md) 说明任务判断、制作流程和交付验证。
- [实拍动作](references/motion.md) 介绍选帧、动作衔接、分割和图集检查。
- [桌面实现](references/desktop.md) 介绍透明窗口、跨屏拖动和安装包。
- [iPhone 边界](references/iphone.md) 解释应用内触控、主屏幕入口和小组件的差异。
- [工程恢复脚本](scripts/scaffold_daba_desktop.py) 从兼容的大巴系列 HTML 提取当前素材并生成 Electron 工程。脚本使用 Python 3 和 Pillow，媒体由使用者提供。
