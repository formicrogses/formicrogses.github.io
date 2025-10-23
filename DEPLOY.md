# 🚀 快速部署指南 - GitHub Pages

## 部署步骤

### 1. 准备工作
```bash
# 重命名文件
mv index.html index-old.html
mv index-new.html index.html
```

### 2. 修改配置
在以下文件中将 `yourusername` 替换为你的GitHub用户名：
- `index.html` (第15、16、20行的URL)
- `sitemap.xml` (第4行)
- `robots.txt` (第3行)

### 3. 创建GitHub仓库
1. 在GitHub上创建新仓库
2. 不要初始化README、.gitignore或License

### 4. 上传代码
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

### 5. 启用GitHub Pages
1. 进入仓库Settings → Pages
2. Source选择: Deploy from a branch
3. Branch选择: main
4. Folder选择: / (root)
5. 点击Save

### 6. 访问网站
等待几分钟后访问: `https://你的用户名.github.io/仓库名/`

## 功能亮点

✅ **搜索功能** - 实时搜索论文标题、年份、标签  
✅ **高级筛选** - 9大类标签多级筛选  
✅ **URL状态同步** - 分享筛选结果链接  
✅ **数据导出** - 支持JSON/CSV格式导出  
✅ **排序功能** - 按年份/标题/相关度排序  
✅ **深色模式** - 自动适应系统主题  
✅ **PWA支持** - 离线访问能力  
✅ **SEO优化** - 完整的meta标签和sitemap  
✅ **响应式设计** - 完美支持移动端  
✅ **无限滚动** - 自动加载更多内容  

## 项目结构
```
网站/
├── index.html          # 主页面（使用新版本）
├── css/
│   └── styles.css      # 样式文件（含深色模式）
├── js/
│   ├── app.js          # 核心应用逻辑
│   └── modal.js        # 模态框组件
├── Papers/             # 论文图片目录
├── papers-data-new.js  # 论文数据
├── manifest.json       # PWA配置
├── sw.js              # Service Worker
├── robots.txt         # SEO机器人文件
├── sitemap.xml        # 网站地图
└── README.md          # 项目说明
```

## 性能优化建议

1. **图片优化**
   - 使用WebP格式
   - 压缩图片至100KB以下
   - 使用图片懒加载

2. **数据优化**
   - 压缩papers-data-new.js
   - 考虑分片加载大数据集

3. **缓存策略**
   - Service Worker已配置自动缓存
   - 首次访问后支持离线使用

## 常见问题

**Q: 图片不显示？**  
A: 检查Papers文件夹路径是否正确，GitHub区分大小写

**Q: 搜索不工作？**  
A: 确保papers-data-new.js文件已正确加载

**Q: PWA不工作？**  
A: GitHub Pages自动启用HTTPS，检查浏览器控制台错误

**Q: 如何添加新论文？**  
A: 编辑papers-data-new.js，添加新的论文对象

## 技术栈
- 纯前端静态网站（无需后端）
- 原生JavaScript ES6+
- CSS3 with CSS Variables
- PWA (Progressive Web App)
- Service Worker离线缓存

## 联系方式
如有问题，请在GitHub仓库提Issue

---
祝部署顺利！ 🎉
