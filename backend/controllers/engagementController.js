import pool from '../config/database.js';

/**
 * Get daily engagement timeline data
 * Returns data in format compatible with engagement_timeline.json
 */
export async function getEngagementTimeline(req, res) {
  try {
    const { start_date, end_date, topics, party, legislator, keyword } = req.query;

    // Build date filter
    let dateFilter = '';
    const params = [];
    let paramIndex = 1;

    if (start_date && end_date) {
      dateFilter = `WHERE p.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(start_date, end_date);
      paramIndex += 2;
    } else if (start_date) {
      dateFilter = `WHERE p.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    } else if (end_date) {
      dateFilter = `WHERE p.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Build topic filter
    let topicFilter = '';
    if (topics) {
      const topicList = Array.isArray(topics) ? topics : topics.split(',');
      const placeholders = topicList.map((_, i) => `$${paramIndex + i}`).join(',');
      topicFilter = dateFilter 
        ? ` AND t.topic_label = ANY(ARRAY[${placeholders}])`
        : `WHERE t.topic_label = ANY(ARRAY[${placeholders}])`;
      params.push(...topicList);
      paramIndex += topicList.length;
    }

    // Build party filter
    let partyFilter = '';
    if (party && party !== 'both') {
      // Map 'D' to 'Democratic', 'R' to 'Republican'
      const partyMap = { 'D': 'Democratic', 'R': 'Republican' };
      const partyValue = partyMap[party] || party;
      partyFilter = (dateFilter || topicFilter) 
        ? ` AND l.party = $${paramIndex}`
        : `WHERE l.party = $${paramIndex}`;
      params.push(partyValue);
      paramIndex++;
    }

    // Build legislator filter
    let legislatorFilter = '';
    if (legislator) {
      legislatorFilter = (dateFilter || topicFilter || partyFilter)
        ? ` AND p.lid = $${paramIndex}`
        : `WHERE p.lid = $${paramIndex}`;
      params.push(legislator);
      paramIndex++;
    }

    // Build keyword filter
    let keywordFilter = '';
    if (keyword && keyword.trim()) {
      keywordFilter = (dateFilter || topicFilter || partyFilter || legislatorFilter)
        ? ` AND p.text ILIKE $${paramIndex}`
        : `WHERE p.text ILIKE $${paramIndex}`;
      params.push(`%${keyword.trim()}%`);
      paramIndex++;
    }
    // Note: If no topics specified, return all topics (frontend can filter client-side if needed)

    // Query to get daily engagement per topic and post counts
    // v3 schema: Includes all engagement metrics (replies, quotes)
    // Note: Removed HAVING clause to include topics with 0 engagement but posts
    const query = `
      SELECT 
        p.created_at as date,
        t.topic_label,
        COALESCE(SUM(
          COALESCE(p.like_count, 0) + 
          COALESCE(p.retweet_count, 0) + 
          COALESCE(p.reply_count, 0) + 
          COALESCE(p.quote_count, 0)
        ), 0) as engagement,
        COUNT(p.id) as post_count
      FROM posts p
      JOIN topics t ON p.topic = t.topic
      JOIN legislators l ON p.lid = l.lid
      ${dateFilter}${topicFilter}${partyFilter}${legislatorFilter}${keywordFilter}
      GROUP BY p.created_at, t.topic_label
      HAVING COUNT(p.id) > 0
      ORDER BY p.created_at, t.topic_label
    `;

    const result = await pool.query(query, params);

    // Transform to format expected by frontend (array of daily objects)
    const dailyData = {};
    result.rows.forEach(row => {
      // Ensure date is formatted as YYYY-MM-DD string
      let dateStr;
      if (row.date instanceof Date) {
        dateStr = row.date.toISOString().split('T')[0];
      } else if (typeof row.date === 'string') {
        // If it's already a string, use it directly (PostgreSQL DATE returns as string)
        dateStr = row.date.split('T')[0]; // Handle ISO strings
      } else {
        console.warn('Unexpected date format:', row.date);
        return; // Skip this row
      }
      
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { date: dateStr };
      }
      dailyData[dateStr][row.topic_label] = parseInt(row.engagement) || 0;
      // Store post count per topic (using a separate key pattern)
      dailyData[dateStr][`${row.topic_label}_posts`] = parseInt(row.post_count) || 0;
    });

    // Convert to array and sort by date
    const timeline = Object.values(dailyData).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    res.json(timeline);
  } catch (error) {
    console.error('Error fetching engagement timeline:', error);
    res.status(500).json({ error: 'Failed to fetch engagement timeline', message: error.message });
  }
}

/**
 * Get topics sorted by total engagement
 * Used for sidebar topic selection
 */
export async function getTopicsByEngagement(req, res) {
  try {
    const { start_date, end_date, limit = 500, party, legislator } = req.query;

    let query = `
      SELECT 
        t.topic_label,
        COUNT(p.id) as post_count,
        SUM(
          COALESCE(p.like_count, 0) + 
          COALESCE(p.retweet_count, 0) + 
          COALESCE(p.reply_count, 0) + 
          COALESCE(p.quote_count, 0)
        ) as total_engagement
      FROM topics t
      JOIN posts p ON t.topic = p.topic
      JOIN legislators l ON p.lid = l.lid
    `;

    const params = [];
    const conditions = [];

    if (start_date) {
      params.push(start_date);
      conditions.push(`p.created_at >= $${params.length}`);
    }

    if (end_date) {
      params.push(end_date);
      conditions.push(`p.created_at <= $${params.length}`);
    }

    if (party && party !== 'both') {
      // Map 'D' to 'Democratic', 'R' to 'Republican'
      const partyMap = { 'D': 'Democratic', 'R': 'Republican' };
      const partyValue = partyMap[party] || party;
      params.push(partyValue);
      conditions.push(`l.party = $${params.length}`);
    }

    if (legislator) {
      params.push(legislator);
      conditions.push(`p.lid = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      GROUP BY t.topic_label
      HAVING COUNT(p.id) > 0
      ORDER BY total_engagement DESC, post_count DESC
      LIMIT $${params.length + 1}
    `;

    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    
    // Return just the topic labels in order
    res.json(result.rows.map(row => row.topic_label));
  } catch (error) {
    console.error('Error fetching topics by engagement:', error);
    res.status(500).json({ error: 'Failed to fetch topics by engagement', message: error.message });
  }
}

