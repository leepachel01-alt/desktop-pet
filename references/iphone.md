# iPhone 的实现边界

先确认用户想要应用内触控，还是在系统主屏幕或其他 App 上浮动。iOS 返回主屏幕时把前台 App 切到后台。原生 App 和添加到主屏幕的网页 App 都没有通用的跨 App 透明置顶窗口接口。小组件在组件区域显示并支持按钮等互动，画中画是系统管理的视频播放界面。若用户要求与电脑版相同的自由移动、拖动和光圈互动，说明系统限制，明确已有网页入口要点开才会运行宠物。

- [UIKit 的后台执行过程](https://developer.apple.com/documentation/uikit/about-the-background-execution-sequence)
- [WidgetKit 的交互能力](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities)
- [Apple 的画中画说明](https://support.apple.com/zh-cn/guide/iphone/-iphcc3587b5d/ios)

用户接受应用内触控时，按本次授权选原生或网页交付：

- **Safari 网页 App**。配置主屏幕图标和 standalone 清单，适配安全区、横竖屏、点按与拖动阈值。声音由实际用户手势触发。局域网方案只提供用户授权的素材，限制可访问目录和接口。普通局域网 HTTP 方案依赖宿主开机及同网。若承诺离线，需用安全上下文和缓存，并实测断网关闭再打开。未获授权时不将私有素材发布至公网。[添加到主屏幕](https://support.apple.com/zh-cn/guide/iphone/iphea86e5236/ios)
- **原生 iOS**。确认安装渠道、SDK、签名证书、配置描述文件和设备权限。编译、签名和真机安装分开验收。无法签名时，如实标明交付的是项目或未签名构建。[Apple Developer 账户和 Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account/)

可在桌面 WebKit 做兼容检查、在浏览器做触控模拟。交付注明覆盖范围，真机安装与系统主屏幕仍需真机验证。
