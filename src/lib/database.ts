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
    topic_id INTEGER DEFAULT 1,
    pub_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics (id)
  )
`);

// Create topics table
db.exec(`
  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#F4A261',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert default topic if not exists
db.exec(`
  INSERT OR IGNORE INTO topics (id, name, description, color) 
  VALUES (1, 'Genel Hukuk', 'Genel hukuki konular ve makaleler', '#F4A261')
`);

// Create indexes for better performance
db.exec('CREATE INDEX IF NOT EXISTS idx_posts_pub_date ON posts(pub_date DESC)');
db.exec('CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug)');
db.exec('CREATE INDEX IF NOT EXISTS idx_posts_title ON posts(title)');
db.exec('CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id)');

// Topic interface
export interface TopicData {
  id: number;
  name: string;
  description: string;
  color: string;
  created_at?: string;
  updated_at?: string;
}

// Simple TOC interface for client-side generation
export interface TocItem {
  heading_text: string;
  heading_level: number;
  anchor_id: string;
  order_index: number;
}

// Blog post interface
export interface BlogPostData {
  id: number;
  slug: string;
  title: string;
  description: string;
  content: string;
  hero_image: string;
  alt_text: string;
  topic_id: number;
  pub_date: string;
  updated_date: string;
  created_at?: string;
  updated_at?: string;
  topic?: TopicData;
}

// Prepared statements for better performance
export const statements = {
  getAllPosts: db.prepare(`
    SELECT p.*, t.name as topic_name, t.color as topic_color
    FROM posts p
    LEFT JOIN topics t ON p.topic_id = t.id
    ORDER BY p.pub_date DESC
  `),
  
  getPostBySlug: db.prepare(`
    SELECT p.*, t.name as topic_name, t.color as topic_color
    FROM posts p
    LEFT JOIN topics t ON p.topic_id = t.id
    WHERE p.slug = ?
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
  `),
  
  // Topic statements
  getAllTopics: db.prepare(`
    SELECT * FROM topics 
    ORDER BY name ASC
  `),
  
  insertTopic: db.prepare(`
    INSERT INTO topics (name, description, color)
    VALUES (?, ?, ?)
  `),
  
  updateTopic: db.prepare(`
    UPDATE topics 
    SET name = ?, description = ?, color = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  
  deleteTopic: db.prepare(`
    DELETE FROM topics 
    WHERE id = ? AND id != 1
  `),
  
  // Updated post statements to include topic_id
  insertPostWithTopic: db.prepare(`
    INSERT INTO posts (slug, title, description, content, hero_image, alt_text, topic_id, pub_date, updated_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  updatePostWithTopic: db.prepare(`
    UPDATE posts 
    SET title = ?, description = ?, content = ?, hero_image = ?, alt_text = ?, topic_id = ?, updated_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE slug = ?
  `),
  
  updatePostWithSlugAndTopic: db.prepare(`
    UPDATE posts 
    SET slug = ?, title = ?, description = ?, content = ?, hero_image = ?, alt_text = ?, topic_id = ?, updated_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE slug = ?
  `)
};

// Helper functions
export function slugify(text: string): string {
  const turkishChars: { [key: string]: string } = {
    'ı': 'i',
    'ğ': 'g',
    'ü': 'u',
    'ş': 's',
    'ö': 'o',
    'ç': 'c',
    'İ': 'i',
    'Ğ': 'g',
    'Ü': 'u',
    'Ş': 's',
    'Ö': 'o',
    'Ç': 'c'
  };

  return text
    .trim()
    // Convert Turkish characters to their ASCII equivalents BEFORE lowercase conversion
    .replace(/[ıığüşöçİĞÜŞÖÇ]/g, (match) => turkishChars[match] || match)
    .toLowerCase()
    // Remove any remaining non-ASCII characters, keep only letters, numbers, spaces and hyphens
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

// TOC Helper Functions
export function generateTocFromContent(content: string): TocItem[] {
  const tocItems: TocItem[] = [];
  const headingRegex = /<h([2-4])[^>]*>(.*?)<\/h[2-4]>/gi;
  let match;
  let orderIndex = 0;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].replace(/<[^>]*>/g, '').trim(); // Remove any HTML tags from heading text
    const anchorId = slugify(text);

    tocItems.push({
      heading_text: text,
      heading_level: level,
      anchor_id: anchorId,
      order_index: orderIndex++
    });
  }

  return tocItems;
}

export function addAnchorsToContent(content: string): string {
  return content.replace(/<h([2-4])([^>]*)>(.*?)<\/h[2-4]>/gi, (match, level, attrs, text) => {
    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    const anchorId = slugify(cleanText);
    return `<h${level}${attrs} id="${anchorId}">${text}</h${level}>`;
  });
}

// Topic Helper Functions - Simplified (no slugs needed)
export function getAllTopics(): TopicData[] {
  return statements.getAllTopics.all() as TopicData[];
}

export function getTopicById(id: number): TopicData | null {
  return statements.getAllTopics.all().find((topic: TopicData) => topic.id === id) || null;
}

export function createTopic(name: string, description: string, color: string): number {
  const result = statements.insertTopic.run(name, description, color);
  return result.lastInsertRowid as number;
}

export function updateTopic(id: number, name: string, description: string, color: string): void {
  statements.updateTopic.run(name, description, color, id);
}

export function deleteTopic(id: number): void {
  if (id === 1) return; // Can't delete default topic
  
  // Move posts to default topic
  db.exec(`UPDATE posts SET topic_id = 1 WHERE topic_id = ${id}`);
  
  // Delete topic
  statements.deleteTopic.run(id);
}

console.log('Database initialized at:', dbPath);