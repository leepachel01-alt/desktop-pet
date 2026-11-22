# 桌面实现和交付

## 窗口、输入与状态

Electron 可用无框透明置顶窗口。用受限的 preload 桥传坐标、开关和拖动状态，并隔离渲染层。窗口覆盖显示器工作区时默认让输入穿透。光标进入宠物或菜单按钮范围才接收输入。用系统 DIP 坐标转换成内容坐标，检查副屏的负原点、任务栏和缩放差异。拖动期间保留捕获，跨屏时移动同一个窗口并重新换算坐标，释放或失去捕获时恢复穿透。漫游和追随分别调度，漫游限定安全落点，可被光标输入或互动中断。

修改透明层后测试下方窗口仍可点击。磨砂视觉可以用半透明填充、边缘和阴影，网页内模糊滤镜无法保证模糊原生透明窗口下方的其他应用。

## 从大巴系列 HTML 恢复桌面工程

源 HTML 需要包含 ID 为 daba-frames 的 JSON script，并具备大巴后期休息、转身、走跑和六项互动的素材。恢复脚本使用 Python 3 和 Pillow。在技能目录运行：

    python3 scripts/scaffold_daba_desktop.py /absolute/path/pet.html /absolute/path/new-project --app-name "大巴桌面宠物" --app-id com.example.dabapet --version 1.2.0

脚本只提取源页面的帧、方向和叫声，桌面模板来自 v1.2 实测版本，包含跟随、空闲走动、透明点击穿透、拖动、浅色光圈和本地菜单。若输入是早期页面、其他宠物或不同帧结构，根据缺项调整控制器和素材格式。恢复既有安装的更新时，沿用原产品名、应用 ID 和架构。新的独立产品使用自己的标识。

生成后进入新目录，运行 npm install 和 npm start。确认动作后，运行 npm run package:mac 或 npm run package:win 构建安装包。模板固定了已实测的 Electron 和打包器版本。升级前核对目标操作系统、Electron 和打包器的兼容性。若应用要发出叫声，确认素材带内嵌音频。

## 安装包

- macOS 可输出各自的 Intel、Apple 芯片 DMG，也可按需构建通用包。优先在 Mac 打包，检查 DMG 可挂载、存在应用和 Applications 快捷方式、Mach-O 架构一致且签名可验证。
- Windows 可用 NSIS 本地安装包，同时加入 x64 和 ARM64。若在 macOS 交叉打包，检查 NSIS 与解包工具能否取得。若有编辑资源或签名步骤要求 Wine，再验证相应工具。在下载 Electron 有阻碍时，可用可信镜像或本地发行包，并使用可信官方校验和验证压缩包。
- 区分临时签名、macOS 公证和 Windows 发布者签名。准确写出实际状态。离线应用的资源、叫声和运行时随包交付。只在获授权时发布或上传。
- 在目标系统实际安装，或用从安装介质复制出的应用启动，测试托盘、点击、拖动、声音和退出。无目标系统时检查包结构、架构、内嵌文件和校验和，并注明未实跑。多屏坐标模拟不能替代多屏实测。

[Electron 窗口交互](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions) · [electron-builder 架构打包](https://www.electron.build/docs/architecture/)
