# Paper Trail · 私人投稿台账

一个只在浏览器本地保存数据的投稿追踪与科研产出统计工具。适合手动维护 Springer Nature、Elsevier、ScholarOne、Editorial Manager 等平台中的投稿状态。

## 功能

- 区分“论文数量”和“投稿次数”，支持拒稿后转投
- 手动更新状态，完整保留状态时间线和修回截止日期
- 保存投稿网站链接、Manuscript ID、轮次和备注
- 按年度保存 JIF、JCR 学科类别、排名和 Quartile
- 统计在投、接收、发表、年度投稿节奏和分区分布
- JSON 完整备份/恢复、CSV 表格导出、JCR CSV 批量导入
- IndexedDB 本地存储；没有账户和后端服务器

## 本地运行

```bash
pnpm install
pnpm dev
```

构建和测试：

```bash
pnpm test
pnpm build
```

## GitHub Pages 部署

仓库已包含 `.github/workflows/deploy.yml`。在 GitHub 仓库中：

1. 打开 **Settings → Pages**。
2. 将 **Source** 设置为 **GitHub Actions**。
3. 推送 `main` 分支，工作流会自动测试、构建并部署。

GitHub Pages 只托管应用代码。论文、链接、JCR 导入文件和状态记录不会提交到 GitHub，而是保存在访问设备的浏览器 IndexedDB 中。

## JCR CSV 格式

第一行使用以下字段：

```csv
journal,issn,publisher,jcrYear,dataYear,jif,category,quartile,rank,total
Example Journal,1234-5678,Example Publisher,2025,2024,8.2,Cell Biology,Q1,12,205
```

一本期刊的多个学科类别使用多行表示。建议从有权限使用的 JCR 数据中自行整理导入，不要将授权数据文件提交到仓库。

## 隐私提醒

- 同一网址在不同浏览器或不同设备上拥有独立数据。
- 清理浏览器网站数据会删除记录，请定期导出 JSON 备份。
- 浏览器本地存储不等同于加密保险箱；请使用设备密码和磁盘加密保护电脑。
