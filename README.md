# 证件照换底排版

> 篝火出品 · 收录于篝火 App 应用区

AI 证件照，换底色、排版打印

![界面截图](docs/screenshot.png)

## 下载

到 [Releases](https://github.com/campfire-code/id-photo/releases/latest) 下载对应安装包：

| 电脑 | 文件 |
|---|---|
| Windows 10 / 11 | `id-photo_版本号_windows-x64-setup.exe` |
| Mac（Apple 芯片） | `id-photo_版本号_mac-arm64.dmg` |
| Mac（Intel 芯片） | `id-photo_版本号_mac-x64.dmg` |

第一次打开：
- **Windows**：如果弹出「Windows 已保护你的电脑」，点「更多信息」→「仍要运行」。
- **Mac**：如果提示「无法验证开发者」，打开「系统设置 → 隐私与安全性」，在下方点「仍要打开」。

## 怎么用

<!-- 使用步骤 -->

## 验收用例

<!-- 用 samples/ 里的示例文件按步骤操作，应得到的结果 -->

## 自己编译

需要 Node.js 22、pnpm、Rust。

```bash
pnpm install
pnpm test          # 单元测试
pnpm tauri dev     # 开发运行
pnpm tauri build   # 打包
```

界面框架在 `src/kit`（所有 campfire-code 工具共用），本工具的逻辑在 `src/tool`。

## 致谢

本工具基于开源项目 [Zeyi-Lin/HivisionIDPhotos](https://github.com/Zeyi-Lin/HivisionIDPhotos)（Apache-2.0）。

## 归属

本工具由**篝火**出品，是篝火 App 应用区收录的开源工具之一，由篝火（GitHub 组织 [campfire-code](https://github.com/campfire-code)）维护与更新。全部工具的目录见 [toolkit-hub](https://github.com/campfire-code/toolkit-hub)。

## 许可证

MIT，版权方为篝火（campfire-code）。
