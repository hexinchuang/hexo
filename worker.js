// Cloudflare Worker for Hexo CMS Backend
// Connects to GitHub API to manage content

const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN_HERE'; // Set in Cloudflare Worker environment variables
const REPO_OWNER = 'YOUR_USERNAME'; // Replace with your GitHub username
const REPO_NAME = 'YOUR_REPOSITORY_NAME'; // Replace with your repository name
const BRANCH_NAME = 'main'; // Using main branch instead of master

export default {
  async fetch(request, env) {
    // Get token and repo info from environment variables
    const githubToken = env.GITHUB_TOKEN || GITHUB_TOKEN;
    const repoOwner = env.REPO_OWNER || REPO_OWNER;
    const repoName = env.REPO_NAME || REPO_NAME;
    const branchName = env.BRANCH_NAME || BRANCH_NAME;
    
    if (!githubToken || !repoOwner || !repoName) {
      return new Response(JSON.stringify({ error: 'Missing required environment variables' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS for frontend requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      if (path.startsWith('/api/articles')) {
        if (request.method === 'GET') {
          return await handleGetArticles(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleCreateArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'PUT') {
          return await handleUpdateArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'DELETE') {
          return await handleDeleteArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      } else if (path.startsWith('/api/categories')) {
        if (request.method === 'GET') {
          return await handleGetCategories(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleCreateCategory(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'PUT') {
          return await handleUpdateCategory(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'DELETE') {
          return await handleDeleteCategory(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      } else if (path.startsWith('/api/tags')) {
        if (request.method === 'GET') {
          return await handleGetTags(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleCreateTag(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'PUT') {
          return await handleUpdateTag(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'DELETE') {
          return await handleDeleteTag(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      } else if (path.startsWith('/api/comments')) {
        if (request.method === 'GET') {
          return await handleGetComments(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleCreateComment(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'DELETE') {
          return await handleDeleteComment(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      } else if (path.startsWith('/api/announcements')) {
        if (request.method === 'GET') {
          return await handleGetAnnouncements(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleCreateAnnouncement(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'PUT') {
          return await handleUpdateAnnouncement(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'DELETE') {
          return await handleDeleteAnnouncement(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      } else if (path.startsWith('/api/stats')) {
        if (request.method === 'GET') {
          return await handleGetStats(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      }
      
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Helper function to make GitHub API requests
async function githubRequest(path, options = {}, token) {
  const url = `https://api.github.com/repos/${options.repoOwner}/${options.repoName}${path}`;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Cloudflare-Worker'
  };
  
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Helper function to get file content from GitHub
async function getFileContent(githubToken, repoOwner, repoName, filePath, branchName) {
  try {
    const response = await githubRequest(`/contents/${filePath}`, {
      method: 'GET',
      repoOwner,
      repoName
    }, githubToken);
    
    if (response.encoding === 'base64') {
      return atob(response.content);
    }
    return response.content;
  } catch (error) {
    if (error.message.includes('404')) {
      return null; // File doesn't exist
    }
    throw error;
  }
}

// Helper function to create/update file content on GitHub
async function updateFileContent(githubToken, repoOwner, repoName, filePath, content, branchName, message = 'Update via CMS') {
  const contentBase64 = btoa(unescape(encodeURIComponent(content)));
  
  // Check if file exists to get its SHA
  let sha = null;
  try {
    const fileResponse = await githubRequest(`/contents/${filePath}`, {
      method: 'GET',
      repoOwner,
      repoName
    }, githubToken);
    sha = fileResponse.sha;
  } catch (error) {
    // File doesn't exist, we'll create it
  }
  
  const requestBody = {
    message,
    content: contentBase64,
    branch: branchName
  };
  
  if (sha) {
    requestBody.sha = sha;
  }
  
  return await githubRequest(`/contents/${filePath}`, {
    method: 'PUT',
    repoOwner,
    repoName,
    body: requestBody
  }, githubToken);
}

// Article handlers
async function handleGetArticles(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  // Get all articles from the _posts directory
  const articlesDir = 'source/_posts';
  
  try {
    const response = await githubRequest(`/contents/${articlesDir}`, {
      method: 'GET',
      repoOwner,
      repoName
    }, githubToken);
    
    const articles = [];
    
    for (const item of response) {
      if (item.type === 'file' && item.name.endsWith('.md')) {
        // Get content of each article
        const content = await getFileContent(githubToken, repoOwner, repoName, item.path, branchName);
        
        if (content) {
          // Extract frontmatter and content
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          let frontmatter = {};
          let articleContent = content;
          
          if (frontmatterMatch) {
            const frontmatterStr = frontmatterMatch[1];
            frontmatter = parseFrontmatter(frontmatterStr);
            articleContent = content.substring(frontmatterMatch[0].length).trim();
          }
          
          articles.push({
            title: item.name.replace(/\.md$/, ''),
            slug: item.name.replace(/\.md$/, ''),
            content: articleContent,
            ...frontmatter,
            path: item.path,
            lastModified: item.git_url // We'll get actual date later
          });
        }
      }
    }
    
    // Also get commit history to get actual dates
    const commitsResponse = await githubRequest(`/commits`, {
      method: 'GET',
      repoOwner,
      repoName,
      branchName
    }, githubToken);
    
    // Update articles with commit dates
    articles.forEach(article => {
      const commit = commitsResponse.find(c => 
        c.files && c.files.some(f => f.filename === article.path)
      );
      
      if (commit) {
        article.date = commit.commit.author.date;
      }
    });
    
    return new Response(JSON.stringify(articles), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting articles:', error);
    return new Response(JSON.stringify({ error: 'Failed to get articles' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  // Validate required fields
  if (!data.title || !data.content) {
    return new Response(JSON.stringify({ error: 'Title and content are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Generate slug from title
  const slug = data.title.toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Create frontmatter
  const frontmatter = [
    '---',
    `title: "${data.title}"`,
    `date: "${new Date().toISOString()}"`,
    `updated: "${new Date().toISOString()}"`,
    `tags: [${(data.tags || []).map(tag => `"${tag}"`).join(', ')}]` || '',
    `categories: ["${data.category || 'Uncategorized'}"]` || '',
    `cover: "${data.cover || ''}"` || '',
    '---'
  ].filter(line => line !== '').join('\n');
  
  const content = `${frontmatter}\n\n${data.content}`;
  const fileName = `source/_posts/${slug}.md`;
  
  try {
    await updateFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      fileName, 
      content, 
      branchName, 
      `Add new article: ${data.title}`
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Article created successfully',
      slug: slug
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating article:', error);
    return new Response(JSON.stringify({ error: 'Failed to create article' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleUpdateArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  if (!data.path || !data.content) {
    return new Response(JSON.stringify({ error: 'Path and content are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Create updated frontmatter
  const frontmatter = [
    '---',
    `title: "${data.title || 'Untitled'}"`,
    `date: "${data.date || new Date().toISOString()}"`,
    `updated: "${new Date().toISOString()}"`,
    `tags: [${(data.tags || []).map(tag => `"${tag}"`).join(', ')}]` || '',
    `categories: ["${data.category || 'Uncategorized'}"]` || '',
    `cover: "${data.cover || ''}"` || '',
    '---'
  ].filter(line => line !== '').join('\n');
  
  const content = `${frontmatter}\n\n${data.content}`;
  
  try {
    await updateFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      data.path, 
      content, 
      branchName, 
      `Update article: ${data.title || 'Untitled'}`
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Article updated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating article:', error);
    return new Response(JSON.stringify({ error: 'Failed to update article' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleDeleteArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  if (!data.path) {
    return new Response(JSON.stringify({ error: 'Path is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get file SHA first
    const fileResponse = await githubRequest(`/contents/${data.path}`, {
      method: 'GET',
      repoOwner,
      repoName
    }, githubToken);
    
    const deleteResponse = await githubRequest(`/contents/${data.path}`, {
      method: 'DELETE',
      repoOwner,
      repoName,
      body: {
        message: `Delete article: ${data.path}`,
        sha: fileResponse.sha,
        branch: branchName
      }
    }, githubToken);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Article deleted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete article' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Category handlers
async function handleGetCategories(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  try {
    // In a Hexo site, categories are typically extracted from article frontmatter
    // For now, we'll return a list of categories based on existing articles
    const articlesResponse = await handleGetArticles(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
    const articles = await articlesResponse.json();
    
    const categoriesSet = new Set();
    
    articles.forEach(article => {
      if (Array.isArray(article.categories)) {
        article.categories.forEach(cat => categoriesSet.add(cat));
      } else if (typeof article.categories === 'string') {
        categoriesSet.add(article.categories);
      }
    });
    
    const categories = Array.from(categoriesSet).map(name => ({
      name,
      count: articles.filter(a => 
        (Array.isArray(a.categories) && a.categories.includes(name)) || 
        (typeof a.categories === 'string' && a.categories === name)
      ).length
    }));
    
    return new Response(JSON.stringify(categories), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    return new Response(JSON.stringify({ error: 'Failed to get categories' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateCategory(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  // Categories are handled through article frontmatter in Hexo
  // This is a placeholder that could be extended to maintain a categories list
  const data = await request.json();
  
  if (!data.name) {
    return new Response(JSON.stringify({ error: 'Category name is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Category added to available categories',
    category: data.name
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Tag handlers
async function handleGetTags(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  try {
    // Similar to categories, tags are extracted from article frontmatter
    const articlesResponse = await handleGetArticles(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
    const articles = await articlesResponse.json();
    
    const tagsMap = new Map();
    
    articles.forEach(article => {
      if (Array.isArray(article.tags)) {
        article.tags.forEach(tag => {
          tagsMap.set(tag, (tagsMap.get(tag) || 0) + 1);
        });
      }
    });
    
    const tags = Array.from(tagsMap.entries()).map(([name, count]) => ({
      name,
      count
    }));
    
    return new Response(JSON.stringify(tags), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting tags:', error);
    return new Response(JSON.stringify({ error: 'Failed to get tags' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Comment handlers
async function handleGetComments(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  // For simplicity, we'll store comments in a separate file
  // In practice, you'd likely use a dedicated service or GitHub issues
  try {
    let comments = [];
    
    // Try to get existing comments
    const commentsContent = await getFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      'comments.json', 
      branchName
    );
    
    if (commentsContent) {
      comments = JSON.parse(commentsContent);
    }
    
    return new Response(JSON.stringify(comments), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    return new Response(JSON.stringify([]), { // Return empty array if no comments exist yet
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateComment(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  if (!data.author || !data.content || !data.article) {
    return new Response(JSON.stringify({ error: 'Author, content, and article are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get existing comments
    let existingComments = [];
    const commentsContent = await getFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      'comments.json', 
      branchName
    );
    
    if (commentsContent) {
      existingComments = JSON.parse(commentsContent);
    }
    
    // Add new comment
    const newComment = {
      id: Date.now().toString(),
      author: data.author,
      email: data.email || '',
      content: data.content,
      article: data.article,
      date: new Date().toISOString(),
      approved: true // Auto-approve comments as per requirement
    };
    
    existingComments.push(newComment);
    
    // Save updated comments
    await updateFileContent(
      githubToken,
      repoOwner,
      repoName,
      'comments.json',
      JSON.stringify(existingComments, null, 2),
      branchName,
      'Update comments'
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Comment added successfully',
      comment: newComment
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return new Response(JSON.stringify({ error: 'Failed to add comment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleDeleteComment(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  if (!data.id) {
    return new Response(JSON.stringify({ error: 'Comment ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get existing comments
    let existingComments = [];
    const commentsContent = await getFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      'comments.json', 
      branchName
    );
    
    if (commentsContent) {
      existingComments = JSON.parse(commentsContent);
    }
    
    // Remove comment
    existingComments = existingComments.filter(comment => comment.id !== data.id);
    
    // Save updated comments
    await updateFileContent(
      githubToken,
      repoOwner,
      repoName,
      'comments.json',
      JSON.stringify(existingComments, null, 2),
      branchName,
      'Update comments'
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Comment deleted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete comment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Announcement handlers
async function handleGetAnnouncements(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  try {
    // Try to get announcements from a file
    const announcementsContent = await getFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      'announcements.json', 
      branchName
    );
    
    if (announcementsContent) {
      const announcements = JSON.parse(announcementsContent);
      return new Response(JSON.stringify(announcements), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error getting announcements:', error);
    return new Response(JSON.stringify([]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateAnnouncement(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  if (!data.text) {
    return new Response(JSON.stringify({ error: 'Announcement text is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get existing announcements
    let existingAnnouncements = [];
    const announcementsContent = await getFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      'announcements.json', 
      branchName
    );
    
    if (announcementsContent) {
      existingAnnouncements = JSON.parse(announcementsContent);
    }
    
    // Add new announcement
    const newAnnouncement = {
      id: Date.now().toString(),
      text: data.text,
      date: new Date().toISOString()
    };
    
    existingAnnouncements.push(newAnnouncement);
    
    // Save updated announcements
    await updateFileContent(
      githubToken,
      repoOwner,
      repoName,
      'announcements.json',
      JSON.stringify(existingAnnouncements, null, 2),
      branchName,
      'Update announcements'
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Announcement added successfully',
      announcement: newAnnouncement
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return new Response(JSON.stringify({ error: 'Failed to add announcement' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Stats handler
async function handleGetStats(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  try {
    // Get articles count
    const articlesResponse = await handleGetArticles(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
    const articles = await articlesResponse.json();
    
    // Get comments count
    const commentsResponse = await handleGetComments(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
    const comments = await commentsResponse.json();
    
    // Get categories count
    const categoriesResponse = await handleGetCategories(request, githubToken, repoOwner, repoName, branchName, corsHeaders);\    
    const categories = await categoriesResponse.json();
    
    // Get tags count
    const tagsResponse = await handleGetTags(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
    const tags = await tagsResponse.json();
    
    const stats = {
      articles: articles.length,
      drafts: articles.filter(a => a.published === false).length,
      comments: comments.length,
      categories: categories.length,
      tags: tags.length,
      lastUpdated: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    return new Response(JSON.stringify({ error: 'Failed to get stats' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Simple frontmatter parser
function parseFrontmatter(fmString) {
  const result = {};
  
  // Split by newlines and process each line
  const lines = fmString.split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      
      // Parse arrays like ["tag1", "tag2"]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.substring(1, value.length - 1)
          .split(',')
          .map(item => item.trim().replace(/^["']|["']$/g, ''));
      }
      
      result[key] = value;
    }
  }
  
  return result;
}// Cloudflare Worker for Hexo CMS Backend
// Connects to GitHub API to manage content

const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN_HERE'; // Set in Cloudflare Worker environment variables
const REPO_OWNER = 'YOUR_USERNAME'; // Replace with your GitHub username
const REPO_NAME = 'YOUR_REPOSITORY_NAME'; // Replace with your repository name
const BRANCH_NAME = 'main'; // Using main branch instead of master

export default {
  async fetch(request, env) {
    // Get token and repo info from environment variables
    const githubToken = env.GITHUB_TOKEN || GITHUB_TOKEN;
    const repoOwner = env.REPO_OWNER || REPO_OWNER;
    const repoName = env.REPO_NAME || REPO_NAME;
    const branchName = env.BRANCH_NAME || BRANCH_NAME;
    
    if (!githubToken || !repoOwner || !repoName) {
      return new Response(JSON.stringify({ error: 'Missing required environment variables' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS for frontend requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      if (path.startsWith('/api/articles')) {
        if (request.method === 'GET') {
          return await handleGetArticles(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleCreateArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'PUT') {
          return await handleUpdateArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'DELETE') {
          return await handleDeleteArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      } else if (path.startsWith('/api/categories')) {
        if (request.method === 'GET') {
          return await handleGetCategories(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleCreateCategory(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'PUT') {
          return await handleUpdateCategory(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'DELETE') {
          return await handleDeleteCategory(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      } else if (path.startsWith('/api/tags')) {
        if (request.method === 'GET') {
          return await handleGetTags(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleCreateTag(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'PUT') {
          return await handleUpdateTag(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'DELETE') {
          return await handleDeleteTag(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      } else if (path.startsWith('/api/comments')) {
        if (request.method === 'GET') {
          return await handleGetComments(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleCreateComment(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'DELETE') {
          return await handleDeleteComment(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      } else if (path.startsWith('/api/announcements')) {
        if (request.method === 'GET') {
          return await handleGetAnnouncements(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleCreateAnnouncement(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'PUT') {
          return await handleUpdateAnnouncement(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        } else if (request.method === 'DELETE') {
          return await handleDeleteAnnouncement(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      } else if (path.startsWith('/api/stats')) {
        if (request.method === 'GET') {
          return await handleGetStats(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
        }
      }
      
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Helper function to make GitHub API requests
async function githubRequest(path, options = {}, token) {
  const url = `https://api.github.com/repos/${options.repoOwner}/${options.repoName}${path}`;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Cloudflare-Worker'
  };
  
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Helper function to get file content from GitHub
async function getFileContent(githubToken, repoOwner, repoName, filePath, branchName) {
  try {
    const response = await githubRequest(`/contents/${filePath}`, {
      method: 'GET',
      repoOwner,
      repoName
    }, githubToken);
    
    if (response.encoding === 'base64') {
      return atob(response.content);
    }
    return response.content;
  } catch (error) {
    if (error.message.includes('404')) {
      return null; // File doesn't exist
    }
    throw error;
  }
}

// Helper function to create/update file content on GitHub
async function updateFileContent(githubToken, repoOwner, repoName, filePath, content, branchName, message = 'Update via CMS') {
  const contentBase64 = btoa(unescape(encodeURIComponent(content)));
  
  // Check if file exists to get its SHA
  let sha = null;
  try {
    const fileResponse = await githubRequest(`/contents/${filePath}`, {
      method: 'GET',
      repoOwner,
      repoName
    }, githubToken);
    sha = fileResponse.sha;
  } catch (error) {
    // File doesn't exist, we'll create it
  }
  
  const requestBody = {
    message,
    content: contentBase64,
    branch: branchName
  };
  
  if (sha) {
    requestBody.sha = sha;
  }
  
  return await githubRequest(`/contents/${filePath}`, {
    method: 'PUT',
    repoOwner,
    repoName,
    body: requestBody
  }, githubToken);
}

// Article handlers
async function handleGetArticles(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  // Get all articles from the _posts directory
  const articlesDir = 'source/_posts';
  
  try {
    const response = await githubRequest(`/contents/${articlesDir}`, {
      method: 'GET',
      repoOwner,
      repoName
    }, githubToken);
    
    const articles = [];
    
    for (const item of response) {
      if (item.type === 'file' && item.name.endsWith('.md')) {
        // Get content of each article
        const content = await getFileContent(githubToken, repoOwner, repoName, item.path, branchName);
        
        if (content) {
          // Extract frontmatter and content
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          let frontmatter = {};
          let articleContent = content;
          
          if (frontmatterMatch) {
            const frontmatterStr = frontmatterMatch[1];
            frontmatter = parseFrontmatter(frontmatterStr);
            articleContent = content.substring(frontmatterMatch[0].length).trim();
          }
          
          articles.push({
            title: item.name.replace(/\.md$/, ''),
            slug: item.name.replace(/\.md$/, ''),
            content: articleContent,
            ...frontmatter,
            path: item.path,
            lastModified: item.git_url // We'll get actual date later
          });
        }
      }
    }
    
    // Also get commit history to get actual dates
    const commitsResponse = await githubRequest(`/commits`, {
      method: 'GET',
      repoOwner,
      repoName,
      branchName
    }, githubToken);
    
    // Update articles with commit dates
    articles.forEach(article => {
      const commit = commitsResponse.find(c => 
        c.files && c.files.some(f => f.filename === article.path)
      );
      
      if (commit) {
        article.date = commit.commit.author.date;
      }
    });
    
    return new Response(JSON.stringify(articles), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting articles:', error);
    return new Response(JSON.stringify({ error: 'Failed to get articles' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  // Validate required fields
  if (!data.title || !data.content) {
    return new Response(JSON.stringify({ error: 'Title and content are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Generate slug from title
  const slug = data.title.toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Create frontmatter
  const frontmatter = [
    '---',
    `title: "${data.title}"`,
    `date: "${new Date().toISOString()}"`,
    `updated: "${new Date().toISOString()}"`,
    `tags: [${(data.tags || []).map(tag => `"${tag}"`).join(', ')}]` || '',
    `categories: ["${data.category || 'Uncategorized'}"]` || '',
    `cover: "${data.cover || ''}"` || '',
    '---'
  ].filter(line => line !== '').join('\n');
  
  const content = `${frontmatter}\n\n${data.content}`;
  const fileName = `source/_posts/${slug}.md`;
  
  try {
    await updateFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      fileName, 
      content, 
      branchName, 
      `Add new article: ${data.title}`
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Article created successfully',
      slug: slug
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating article:', error);
    return new Response(JSON.stringify({ error: 'Failed to create article' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleUpdateArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  if (!data.path || !data.content) {
    return new Response(JSON.stringify({ error: 'Path and content are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Create updated frontmatter
  const frontmatter = [
    '---',
    `title: "${data.title || 'Untitled'}"`,
    `date: "${data.date || new Date().toISOString()}"`,
    `updated: "${new Date().toISOString()}"`,
    `tags: [${(data.tags || []).map(tag => `"${tag}"`).join(', ')}]` || '',
    `categories: ["${data.category || 'Uncategorized'}"]` || '',
    `cover: "${data.cover || ''}"` || '',
    '---'
  ].filter(line => line !== '').join('\n');
  
  const content = `${frontmatter}\n\n${data.content}`;
  
  try {
    await updateFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      data.path, 
      content, 
      branchName, 
      `Update article: ${data.title || 'Untitled'}`
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Article updated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating article:', error);
    return new Response(JSON.stringify({ error: 'Failed to update article' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleDeleteArticle(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  if (!data.path) {
    return new Response(JSON.stringify({ error: 'Path is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get file SHA first
    const fileResponse = await githubRequest(`/contents/${data.path}`, {
      method: 'GET',
      repoOwner,
      repoName
    }, githubToken);
    
    const deleteResponse = await githubRequest(`/contents/${data.path}`, {
      method: 'DELETE',
      repoOwner,
      repoName,
      body: {
        message: `Delete article: ${data.path}`,
        sha: fileResponse.sha,
        branch: branchName
      }
    }, githubToken);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Article deleted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete article' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Category handlers
async function handleGetCategories(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  try {
    // In a Hexo site, categories are typically extracted from article frontmatter
    // For now, we'll return a list of categories based on existing articles
    const articlesResponse = await handleGetArticles(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
    const articles = await articlesResponse.json();
    
    const categoriesSet = new Set();
    
    articles.forEach(article => {
      if (Array.isArray(article.categories)) {
        article.categories.forEach(cat => categoriesSet.add(cat));
      } else if (typeof article.categories === 'string') {
        categoriesSet.add(article.categories);
      }
    });
    
    const categories = Array.from(categoriesSet).map(name => ({
      name,
      count: articles.filter(a => 
        (Array.isArray(a.categories) && a.categories.includes(name)) || 
        (typeof a.categories === 'string' && a.categories === name)
      ).length
    }));
    
    return new Response(JSON.stringify(categories), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    return new Response(JSON.stringify({ error: 'Failed to get categories' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateCategory(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  // Categories are handled through article frontmatter in Hexo
  // This is a placeholder that could be extended to maintain a categories list
  const data = await request.json();
  
  if (!data.name) {
    return new Response(JSON.stringify({ error: 'Category name is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Category added to available categories',
    category: data.name
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Tag handlers
async function handleGetTags(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  try {
    // Similar to categories, tags are extracted from article frontmatter
    const articlesResponse = await handleGetArticles(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
    const articles = await articlesResponse.json();
    
    const tagsMap = new Map();
    
    articles.forEach(article => {
      if (Array.isArray(article.tags)) {
        article.tags.forEach(tag => {
          tagsMap.set(tag, (tagsMap.get(tag) || 0) + 1);
        });
      }
    });
    
    const tags = Array.from(tagsMap.entries()).map(([name, count]) => ({
      name,
      count
    }));
    
    return new Response(JSON.stringify(tags), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting tags:', error);
    return new Response(JSON.stringify({ error: 'Failed to get tags' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Comment handlers
async function handleGetComments(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  // For simplicity, we'll store comments in a separate file
  // In practice, you'd likely use a dedicated service or GitHub issues
  try {
    let comments = [];
    
    // Try to get existing comments
    const commentsContent = await getFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      'comments.json', 
      branchName
    );
    
    if (commentsContent) {
      comments = JSON.parse(commentsContent);
    }
    
    return new Response(JSON.stringify(comments), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    return new Response(JSON.stringify([]), { // Return empty array if no comments exist yet
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateComment(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  if (!data.author || !data.content || !data.article) {
    return new Response(JSON.stringify({ error: 'Author, content, and article are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get existing comments
    let existingComments = [];
    const commentsContent = await getFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      'comments.json', 
      branchName
    );
    
    if (commentsContent) {
      existingComments = JSON.parse(commentsContent);
    }
    
    // Add new comment
    const newComment = {
      id: Date.now().toString(),
      author: data.author,
      email: data.email || '',
      content: data.content,
      article: data.article,
      date: new Date().toISOString(),
      approved: true // Auto-approve comments as per requirement
    };
    
    existingComments.push(newComment);
    
    // Save updated comments
    await updateFileContent(
      githubToken,
      repoOwner,
      repoName,
      'comments.json',
      JSON.stringify(existingComments, null, 2),
      branchName,
      'Update comments'
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Comment added successfully',
      comment: newComment
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return new Response(JSON.stringify({ error: 'Failed to add comment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleDeleteComment(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  if (!data.id) {
    return new Response(JSON.stringify({ error: 'Comment ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get existing comments
    let existingComments = [];
    const commentsContent = await getFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      'comments.json', 
      branchName
    );
    
    if (commentsContent) {
      existingComments = JSON.parse(commentsContent);
    }
    
    // Remove comment
    existingComments = existingComments.filter(comment => comment.id !== data.id);
    
    // Save updated comments
    await updateFileContent(
      githubToken,
      repoOwner,
      repoName,
      'comments.json',
      JSON.stringify(existingComments, null, 2),
      branchName,
      'Update comments'
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Comment deleted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete comment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Announcement handlers
async function handleGetAnnouncements(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  try {
    // Try to get announcements from a file
    const announcementsContent = await getFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      'announcements.json', 
      branchName
    );
    
    if (announcementsContent) {
      const announcements = JSON.parse(announcementsContent);
      return new Response(JSON.stringify(announcements), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error getting announcements:', error);
    return new Response(JSON.stringify([]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateAnnouncement(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  const data = await request.json();
  
  if (!data.text) {
    return new Response(JSON.stringify({ error: 'Announcement text is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get existing announcements
    let existingAnnouncements = [];
    const announcementsContent = await getFileContent(
      githubToken, 
      repoOwner, 
      repoName, 
      'announcements.json', 
      branchName
    );
    
    if (announcementsContent) {
      existingAnnouncements = JSON.parse(announcementsContent);
    }
    
    // Add new announcement
    const newAnnouncement = {
      id: Date.now().toString(),
      text: data.text,
      date: new Date().toISOString()
    };
    
    existingAnnouncements.push(newAnnouncement);
    
    // Save updated announcements
    await updateFileContent(
      githubToken,
      repoOwner,
      repoName,
      'announcements.json',
      JSON.stringify(existingAnnouncements, null, 2),
      branchName,
      'Update announcements'
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Announcement added successfully',
      announcement: newAnnouncement
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return new Response(JSON.stringify({ error: 'Failed to add announcement' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Stats handler
async function handleGetStats(request, githubToken, repoOwner, repoName, branchName, corsHeaders) {
  try {
    // Get articles count
    const articlesResponse = await handleGetArticles(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
    const articles = await articlesResponse.json();
    
    // Get comments count
    const commentsResponse = await handleGetComments(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
    const comments = await commentsResponse.json();
    
    // Get categories count
    const categoriesResponse = await handleGetCategories(request, githubToken, repoOwner, repoName, branchName, corsHeaders);\    
    const categories = await categoriesResponse.json();
    
    // Get tags count
    const tagsResponse = await handleGetTags(request, githubToken, repoOwner, repoName, branchName, corsHeaders);
    const tags = await tagsResponse.json();
    
    const stats = {
      articles: articles.length,
      drafts: articles.filter(a => a.published === false).length,
      comments: comments.length,
      categories: categories.length,
      tags: tags.length,
      lastUpdated: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    return new Response(JSON.stringify({ error: 'Failed to get stats' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Simple frontmatter parser
function parseFrontmatter(fmString) {
  const result = {};
  
  // Split by newlines and process each line
  const lines = fmString.split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      
      // Parse arrays like ["tag1", "tag2"]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.substring(1, value.length - 1)
          .split(',')
          .map(item => item.trim().replace(/^["']|["']$/g, ''));
      }
      
      result[key] = value;
    }
  }
  
  return result;
}