import pool from '../config/database.js';
export async function getPostsJSON(req, res) {
  try {
    const { legislator, sort = 'date', start_date, end_date } = req.query;

    if (!legislator) {
      return res.status(400).json({ error: 'legislator_id is required' });
    }
  let query = `
    SELECT 
    p.id,
    p.tweet_id,
    l.name,
    l.handle,
    p.created_at,
    p.text,
    l.state,
    l.chamber,
    l.party,
    p.retweet_count,
    p.like_count,
    p.count_misinfo,
    p.tox_toxicity,
    p.political_score,
    p.is_political,
    t.topic_label
FROM posts p
JOIN legislators l ON p.lid = l.lid
LEFT JOIN topics t ON p.topic = t.topic
WHERE l.lid = $1
    `;
    const params = [legislator];

    if (start_date) {
      query += ` AND p.created_at >= $${params.length + 1}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND p.created_at <= $${params.length + 1}`;
      params.push(end_date);
    }

    // Sorting
    switch (sort) {
      case 'date':
      default:
        query += ' ORDER BY p.created_at DESC';
    }

    const result = await pool.query(query, params);

    const posts = result.rows.map(row => ({
      id: row.id,
      date: row.created_at,
      text: row.text,
      engagement: row.retweet_count + row.like_count,
      civility: row.tox_toxicity,
      credibility: row.political_score,
      topic: row.topic_label
    }));

    res.json({ posts });
  } catch (error) {
    console.error('Error fetching posts JSON:', error);
    res.status(500).json({ error: error.message });
  }
}