import * as cheerio from 'cheerio';
import * as fs from 'fs';
import admin from 'firebase-admin';

/**
 * LEGACY SITE MIGRATION SCRIPT
 * 
 * Purpose: Crawl volapuek.bonghwang.space and import posts to /volapuek board
 * 
 * Usage:
 * 1. Set up Firebase Admin SDK credentials (serviceAccountKey.json)
 * 2. npm install cheerio axios firebase-admin
 * 3. ts-node scripts/migrate-volapuek.ts
 * 
 * CLEANUP:
 * - After migration completes successfully, revert the API changes:
 *   git revert <commit-hash> (the one with "MIGRATION TEMP")
 */

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://bonghwangspace.firebaseio.com',
});

const db = admin.firestore();

interface LegacyPost {
  title: string;
  author: string;
  date: Date;
  content: string;
  url: string;
}

/**
 * Crawl legacy Vola Pük posts from volapuek.bonghwang.space
 * Returns array of posts with preserved metadata
 */
async function crawlLegacySite(): Promise<LegacyPost[]> {
  const posts: LegacyPost[] = [];
  
  try {
    // TODO: Replace with actual legacy site list page URL
    const listUrl = 'https://volapuek.bonghwang.space/bbs/board.php?bo_table=volapuek';
    
    console.log(`🔍 Crawling from ${listUrl}...`);
    
    // Fetch and parse would go here (requires axios + cheerio)
    // This is pseudocode - actual implementation depends on legacy HTML structure
    
    console.log(`✅ Found ${posts.length} posts to migrate`);
    return posts;
  } catch (error) {
    console.error('❌ Crawl failed:', error);
    throw error;
  }
}

/**
 * Import post to new system with original date
 * Uses the temporary customCreatedAt parameter in createPost
 */
async function importPostToNewSystem(post: LegacyPost): Promise<void> {
  try {
    const timestamp = admin.firestore.Timestamp.fromDate(post.date);
    
    const postsRef = db.collection('posts');
    const boardRef = db.collection('boards').doc('volapuek');
    
    // Get next postId
    const counterRef = db.collection('counters').doc('board_volapuek');
    const counterDoc = await counterRef.get();
    const nextPostId = counterDoc.exists ? (counterDoc.data()?.lastPostId || 0) + 1 : 1;
    
    // Create post with preserved date
    await db.runTransaction(async (t) => {
      // Update counter
      t.update(counterRef, { lastPostId: nextPostId });
      
      // Add post with original createdAt
      t.set(postsRef.doc(), {
        postId: nextPostId,
        boardId: 'volapuek',
        title: post.title,
        content: post.content,
        authorName: post.author,
        authorUid: null,
        likes: 0,
        dislikes: 0,
        views: 0,
        commentCount: 0,
        // CRITICAL: This uses the temporary customCreatedAt support
        // After migration, this field will be ignored (reverts to serverTimestamp)
        createdAt: timestamp,
      });
    });
    
    console.log(`  ✓ Imported: "${post.title}" (${post.date.toISOString()})`);
  } catch (error) {
    console.error(`  ✗ Failed to import "${post.title}":`, error);
    throw error;
  }
}

/**
 * Main migration flow
 */
async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  LEGACY SITE MIGRATION: Volapuek Board');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  try {
    // Step 1: Crawl legacy site
    const posts = await crawlLegacySite();
    
    if (posts.length === 0) {
      console.log('⚠️  No posts found. Migration cancelled.');
      return;
    }
    
    // Step 2: Confirm before importing
    console.log(`\n📋 Ready to import ${posts.length} posts. Continue? [y/N]`);
    // In production, would wait for user input here
    
    // Step 3: Import each post
    console.log('\n📝 Importing posts...\n');
    for (let i = 0; i < posts.length; i++) {
      await importPostToNewSystem(posts[i]);
      process.stdout.write(`\rProgress: ${i + 1}/${posts.length}`);
    }
    
    console.log('\n\n✅ Migration complete!');
    console.log('');
    console.log('📌 NEXT STEPS:');
    console.log('   1. Verify posts appear in /volapuek board');
    console.log('   2. Test that original dates are preserved');
    console.log('   3. Run: git revert <migration-commit-hash>');
    console.log('   4. Deploy changes to production');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

main();
