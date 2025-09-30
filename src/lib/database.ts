import { Database } from 'bun:sqlite';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'blog.db');
export const db = new Database(dbPath);

// Enable WAL mode for better performance
db.exec('PRAGMA journal_mode = WAL');

// Create posts table
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    content TEXT NOT NULL,
    hero_image TEXT DEFAULT '',
    alt_text TEXT DEFAULT '',
    pub_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create indexes for better performance
db.exec('CREATE INDEX IF NOT EXISTS idx_posts_pub_date ON posts(pub_date DESC)');
db.exec('CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug)');
db.exec('CREATE INDEX IF NOT EXISTS idx_posts_title ON posts(title)');

// Blog post interface
export interface BlogPostData {
  id: number;
  slug: string;
  title: string;
  description: string;
  content: string;
  hero_image: string;
  alt_text: string;
  pub_date: string;
  updated_date: string;
  created_at?: string;
  updated_at?: string;
}

// Prepared statements for better performance
export const statements = {
  getAllPosts: db.prepare(`
    SELECT * FROM posts 
    ORDER BY pub_date DESC
  `),
  
  getPostBySlug: db.prepare(`
    SELECT * FROM posts 
    WHERE slug = ?
  `),
  
  getPostById: db.prepare(`
    SELECT * FROM posts 
    WHERE id = ?
  `),
  
  insertPost: db.prepare(`
    INSERT INTO posts (slug, title, description, content, hero_image, alt_text, pub_date, updated_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  updatePost: db.prepare(`
    UPDATE posts 
    SET title = ?, description = ?, content = ?, hero_image = ?, alt_text = ?, updated_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE slug = ?
  `),
  
  updatePostWithSlug: db.prepare(`
    UPDATE posts 
    SET slug = ?, title = ?, description = ?, content = ?, hero_image = ?, alt_text = ?, updated_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE slug = ?
  `),
  
  deletePost: db.prepare(`
    DELETE FROM posts 
    WHERE slug = ?
  `),
  
  slugExists: db.prepare(`
    SELECT COUNT(*) as count FROM posts 
    WHERE slug = ?
  `),
  
  slugExistsExcluding: db.prepare(`
    SELECT COUNT(*) as count FROM posts 
    WHERE slug = ? AND slug != ?
  `)
};

// Helper functions
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createPostSlug(title: string): string {
  const baseSlug = slugify(title);
  const result = statements.slugExists.get(baseSlug) as { count: number } | null;
  
  if (!result || result.count === 0) {
    return baseSlug;
  }
  
  // If slug exists, append a number
  let counter = 1;
  let newSlug = `${baseSlug}-${counter}`;
  
  while (true) {
    const exists = statements.slugExists.get(newSlug) as { count: number } | null;
    if (!exists || exists.count === 0) {
      break;
    }
    counter++;
    newSlug = `${baseSlug}-${counter}`;
  }
  
  return newSlug;
}

export function createPostSlugForUpdate(title: string, currentSlug: string): string {
  const baseSlug = slugify(title);
  
  // If the new slug is the same as current, keep it
  if (baseSlug === currentSlug) {
    return currentSlug;
  }
  
  const result = statements.slugExistsExcluding.get(baseSlug, currentSlug) as { count: number } | null;
  
  if (!result || result.count === 0) {
    return baseSlug;
  }
  
  // If slug exists, append a number
  let counter = 1;
  let newSlug = `${baseSlug}-${counter}`;
  
  while (true) {
    const exists = statements.slugExistsExcluding.get(newSlug, currentSlug) as { count: number } | null;
    if (!exists || exists.count === 0) {
      break;
    }
    counter++;
    newSlug = `${baseSlug}-${counter}`;
  }
  
  return newSlug;
}

console.log('Database initialized at:', dbPath);