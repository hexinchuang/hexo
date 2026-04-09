# Hexo Blog with Butterfly Theme

This is a fully configured Hexo blog using the Butterfly theme with a custom admin panel and Cloudflare Workers backend.

## Features

- Modern UI with Butterfly theme
- Custom admin panel at `/admin`
- Cloudflare Workers backend for content management
- GitHub API integration
- Full responsive design
- Support for articles, categories, tags, comments, and announcements

## Deployment Instructions

1. Fork this repository
2. Update `_config.yml` with your site details
3. Update `worker.js` with your GitHub credentials
4. Deploy the Cloudflare Worker
5. Enable GitHub Pages in your repository settings

## Admin Panel

The admin panel is accessible at `/admin`. It allows you to:
- Manage articles (create, edit, delete)
- Manage categories and tags
- Moderate comments
- Update announcements
- Change site settings

## Cloudflare Workers Integration

The site integrates with Cloudflare Workers to connect to GitHub API for content management. Update the worker script with your GitHub token and repository details.

## Customization

- Modify `_config.yml` in the theme folder to customize appearance
- Update CSS files in `themes/butterfly/source/css` for styling changes
- Modify templates in `themes/butterfly/layout` for structural changes

## Branch Configuration

This project uses the `main` branch as the default branch for deployment, not `master`.

## License

MIT