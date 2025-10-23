# Gesture Interaction Research Gallery

A modern, responsive web application for exploring gesture interaction research papers with advanced filtering, search, and categorization capabilities.

## Features

### 🔍 Advanced Search & Filtering
- **Full-text search** across titles, years, and tags
- **Multi-level filtering** with 9 major categories
- **Real-time results** update as you type
- **URL state synchronization** - share filtered views with colleagues

### 📊 Data Management
- **Sort options**: By year, title, or relevance
- **Export functionality**: Download filtered results as JSON or CSV
- **Pagination**: Smooth infinite scroll with lazy loading
- **Performance optimized**: Handles thousands of papers efficiently

### 🎨 User Experience
- **Dark mode support** with system preference detection
- **Fully responsive** design for all devices
- **PWA ready**: Works offline with service worker caching
- **Accessibility compliant**: ARIA labels and keyboard navigation

### 🚀 Technical Features
- **SEO optimized**: Meta tags, structured data, sitemap
- **GitHub Pages ready**: Static site, no backend required
- **Modern JavaScript**: ES6+ with class-based architecture
- **Performance**: Lazy loading, debouncing, virtual scrolling

## Deployment to GitHub Pages

### Step 1: Fork or Clone Repository
```bash
git clone https://github.com/yourusername/gesture-research-gallery.git
cd gesture-research-gallery
```

### Step 2: Update Configuration
1. Replace `yourusername` in the following files with your GitHub username:
   - `index-new.html` (meta tags and structured data)
   - `manifest.json` (start_url if using subdirectory)
   - `sitemap.xml` (URL references)
   - `robots.txt` (sitemap URL)

### Step 3: Rename Files
```bash
# Backup original index.html if needed
mv index.html index-old.html

# Use the new enhanced version
mv index-new.html index.html
```

### Step 4: Create GitHub Repository
1. Create a new repository on GitHub
2. Push your code:
```bash
git add .
git commit -m "Initial commit - Gesture Research Gallery"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo-name.git
git push -u origin main
```

### Step 5: Enable GitHub Pages
1. Go to Settings → Pages in your GitHub repository
2. Source: Deploy from a branch
3. Branch: Select `main` (or `master`)
4. Folder: Select `/ (root)`
5. Click Save

### Step 6: Access Your Site
Your site will be available at:
- `https://yourusername.github.io/your-repo-name/`

Or if using a custom domain:
- Add a `CNAME` file with your domain
- Configure DNS settings with your domain provider

## Project Structure
```
├── index.html              # Main HTML file
├── css/
│   └── styles.css         # Modern CSS with dark mode
├── js/
│   ├── app.js            # Main application logic
│   └── modal.js          # Paper detail modal
├── Papers/                # Paper images directory
├── images/                # Site assets
├── papers-data-new.js     # Paper database
├── manifest.json          # PWA manifest
├── sw.js                  # Service worker
├── robots.txt            # SEO robots file
├── sitemap.xml           # SEO sitemap
└── README.md             # This file
```

## Customization

### Adding New Papers
Edit `papers-data-new.js` to add new papers:
```javascript
{
  "id": uniqueId,
  "title": "Paper Title",
  "year": "2024",
  "category": "hardware|software|gesture-design",
  "image": "Papers/path/to/image.png",
  // Add relevant tags...
}
```

### Modifying Categories
Categories are automatically extracted from the data. To add new category types:
1. Add the field to paper objects in `papers-data-new.js`
2. Update filter generation in `app.js`
3. Add corresponding UI in `index.html`

### Styling
- Light/dark themes: Edit CSS variables in `styles.css`
- Layout: Modify grid settings in CSS
- Colors: Update color scheme in `:root` variables

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Tips
- Images should be optimized (WebP format recommended)
- Keep `papers-data-new.js` minified for production
- Enable GitHub Pages compression
- Use CDN for images if dataset grows large

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License
This project is open source and available under the MIT License.

## Troubleshooting

### Images not loading
- Check image paths in `papers-data-new.js`
- Ensure images are committed to repository
- Verify case-sensitive filenames on GitHub

### PWA not working
- Service worker requires HTTPS (automatic on GitHub Pages)
- Check browser console for SW registration errors
- Clear cache and reload

### Search not working
- Ensure `papers-data-new.js` is loaded
- Check browser console for JavaScript errors
- Verify data structure matches expected format

## Contact
For questions or support, please open an issue on GitHub.

---
Built with ❤️ for the research community
