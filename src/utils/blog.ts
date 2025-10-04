import { statements, type BlogPostData, type TopicData, type TocItem } from "../lib/database";

export async function getAllPostsWithTopics(): Promise<(BlogPostData & { topic?: TopicData })[]> {
  console.log("Fetching all posts with topics from SQLite database...");
  
  try {
    const posts = statements.getAllPosts.all() as (BlogPostData & { 
      topic_name?: string;
      topic_color?: string;
    })[];
    
    return posts.map(post => ({
      ...post,
      topic: post.topic_name ? {
        id: post.topic_id,
        name: post.topic_name,
        description: '',
        color: post.topic_color || '#F4A261'
      } : undefined
    }));
  } catch (error) {
    console.error("Error fetching posts from database:", error);
    return [];
  }
}

export async function getPostBySlugWithDetails(slug: string): Promise<{
  post: BlogPostData & { topic?: TopicData };
  tocItems: TocItem[];
} | undefined> {
  try {
    const postRow = statements.getPostBySlug.get(slug) as (BlogPostData & { 
      topic_name?: string;
      topic_color?: string;
    }) | null;
    
    if (!postRow) return undefined;

    const post: BlogPostData & { topic?: TopicData } = {
      ...postRow,
      topic: postRow.topic_name ? {
        id: postRow.topic_id,
        name: postRow.topic_name,
        description: '',
        color: postRow.topic_color || '#F4A261'
      } : undefined
    };

    // Generate TOC from content instead of database
    const { generateTocFromContent } = await import("../lib/database");
    const tocItems = generateTocFromContent(postRow.content);

    return { post, tocItems };
  } catch (error) {
    console.error("Error fetching post by slug:", error);
    return undefined;
  }
}

export async function getPostContent(slug: string): Promise<string> {
  try {
    const post = statements.getPostBySlug.get(slug) as BlogPostData | null;
    return post?.content || "";
  } catch (error) {
    console.error("Error fetching post content:", error);
    return "";
  }
}

export async function getAllTopics(): Promise<TopicData[]> {
  try {
    return statements.getAllTopics.all() as TopicData[];
  } catch (error) {
    console.error("Error fetching topics:", error);
    return [];
  }
}

// Backward compatibility functions for existing admin pages
export async function getPostBySlug(slug: string): Promise<BlogPostData | undefined> {
  try {
    const post = statements.getPostBySlug.get(slug) as BlogPostData | null;
    return post || undefined;
  } catch (error) {
    console.error("Error fetching post by slug:", error);
    return undefined;
  }
}

export async function getAllPosts(): Promise<BlogPostData[]> {
  try {
    return statements.getAllPosts.all() as BlogPostData[];
  } catch (error) {
    console.error("Error fetching all posts:", error);
    return [];
  }
}

// Export helper functions from database
export { addAnchorsToContent } from "../lib/database";