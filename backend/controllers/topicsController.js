import pool from '../config/database.js';

/**
 * Get all topics with engagement metrics
 * Supports filtering by date range
 */
export async function getAllTopics(req, res) {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        t.topic,
        t.topic_label,
        COUNT(p.id) as post_count,
        SUM(p.like_count) as total_likes,
        SUM(p.retweet_count) as total_retweets,
        SUM(p.like_count + p.retweet_count) as total_engagement
      FROM topics t
      LEFT JOIN posts p ON t.topic = p.topic
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

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      GROUP BY t.topic, t.topic_label
      ORDER BY total_engagement DESC NULLS LAST, post_count DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics', message: error.message });
  }
}

/**
 * Get topic breakdown with party and state distributions
 */
export async function getTopicBreakdown(req, res) {
  try {
    const { topic, start_date, end_date, party, legislator, keyword } = req.query;

    if (!topic) {
      return res.status(400).json({ error: 'Topic parameter is required (topic_label)' });
    }

    // First, find the topic ID from the topic_label
    const topicLookup = await pool.query(
      'SELECT topic FROM topics WHERE topic_label = $1 LIMIT 1',
      [topic]
    );

    if (topicLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const topicId = topicLookup.rows[0].topic;

    // Get party breakdown
    let partyQuery = `
      SELECT 
        l.party,
        COUNT(p.id) as post_count,
        SUM(p.like_count) as total_likes,
        SUM(p.retweet_count) as total_retweets,
        SUM(p.like_count + p.retweet_count) as total_engagement
      FROM posts p
      JOIN legislators l ON p.lid = l.lid
      WHERE p.topic = $1
    `;

    const params = [topicId];
    let paramIndex = 2;

    if (start_date) {
      partyQuery += ` AND p.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      partyQuery += ` AND p.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Add party filter if specified
    if (party && party !== 'both') {
      const partyMap = { 'D': 'Democratic', 'R': 'Republican' };
      const partyValue = partyMap[party] || party;
      partyQuery += ` AND l.party = $${paramIndex}`;
      params.push(partyValue);
      paramIndex++;
    }

    if (legislator) {
      partyQuery += ` AND p.lid = $${paramIndex}`;
      params.push(legislator);
      paramIndex++;
    }

    // Add keyword search filter
    if (keyword && keyword.trim()) {
      partyQuery += ` AND p.text ILIKE $${paramIndex}`;
      params.push(`%${keyword.trim()}%`);
      paramIndex++;
    }

    partyQuery += ` AND l.party IS NOT NULL GROUP BY l.party`;

    // Get state breakdown
    let stateQuery = `
      SELECT 
        l.state,
        COUNT(p.id) as post_count
      FROM posts p
      JOIN legislators l ON p.lid = l.lid
      WHERE p.topic = $1
    `;

    const stateParams = [topicId];
    let stateParamIndex = 2;

    if (start_date) {
      stateQuery += ` AND p.created_at >= $${stateParamIndex}`;
      stateParams.push(start_date);
      stateParamIndex++;
    }

    if (end_date) {
      stateQuery += ` AND p.created_at <= $${stateParamIndex}`;
      stateParams.push(end_date);
      stateParamIndex++;
    }

    // Add party filter if specified
    if (party && party !== 'both') {
      const partyMap = { 'D': 'Democratic', 'R': 'Republican' };
      const partyValue = partyMap[party] || party;
      stateQuery += ` AND l.party = $${stateParamIndex}`;
      stateParams.push(partyValue);
      stateParamIndex++;
    }

    if (legislator) {
      stateQuery += ` AND p.lid = $${stateParamIndex}`;
      stateParams.push(legislator);
      stateParamIndex++;
    }

    // Add keyword search filter
    if (keyword && keyword.trim()) {
      stateQuery += ` AND p.text ILIKE $${stateParamIndex}`;
      stateParams.push(`%${keyword.trim()}%`);
      stateParamIndex++;
    }

    // For mapping, we want state totals that match the party mix (D/R only)
    stateQuery += ` AND l.state IS NOT NULL AND l.party IN ('Democratic','Republican') GROUP BY l.state ORDER BY post_count DESC`;

    // Get state-by-party breakdown (for partisan shading in grid map)
    let statePartyQuery = `
      SELECT 
        l.state,
        l.party,
        COUNT(p.id) as post_count
      FROM posts p
      JOIN legislators l ON p.lid = l.lid
      WHERE p.topic = $1
    `;

    const statePartyParams = [topicId];
    let statePartyParamIndex = 2;

    if (start_date) {
      statePartyQuery += ` AND p.created_at >= $${statePartyParamIndex}`;
      statePartyParams.push(start_date);
      statePartyParamIndex++;
    }

    if (end_date) {
      statePartyQuery += ` AND p.created_at <= $${statePartyParamIndex}`;
      statePartyParams.push(end_date);
      statePartyParamIndex++;
    }

    if (party && party !== 'both') {
      const partyMap = { 'D': 'Democratic', 'R': 'Republican' };
      const partyValue = partyMap[party] || party;
      statePartyQuery += ` AND l.party = $${statePartyParamIndex}`;
      statePartyParams.push(partyValue);
      statePartyParamIndex++;
    }

    if (legislator) {
      statePartyQuery += ` AND p.lid = $${statePartyParamIndex}`;
      statePartyParams.push(legislator);
      statePartyParamIndex++;
    }

    // Add keyword search filter
    if (keyword && keyword.trim()) {
      statePartyQuery += ` AND p.text ILIKE $${statePartyParamIndex}`;
      statePartyParams.push(`%${keyword.trim()}%`);
      statePartyParamIndex++;
    }

    statePartyQuery += ` AND l.state IS NOT NULL AND l.party IN ('Democratic','Republican') GROUP BY l.state, l.party ORDER BY l.state ASC`;

    const [partyResult, stateResult, statePartyResult] = await Promise.all([
      pool.query(partyQuery, params),
      pool.query(stateQuery, stateParams),
      pool.query(statePartyQuery, statePartyParams)
    ]);

    // Get topic info
    const topicInfo = { topic: topicId, topic_label: topic };

    // Format party breakdown
    const partyBreakdown = {};
    partyResult.rows.forEach(row => {
      partyBreakdown[row.party] = row.post_count;
    });

    // Format state breakdown
    const stateBreakdown = {};
    stateResult.rows.forEach(row => {
      stateBreakdown[row.state] = row.post_count;
    });

    const statePartyBreakdown = {};
    statePartyResult.rows.forEach(row => {
      if (!statePartyBreakdown[row.state]) statePartyBreakdown[row.state] = {};
      statePartyBreakdown[row.state][row.party] = row.post_count;
    });

    res.json({
      topic: topicInfo.topic,
      name: topicInfo.topic_label,
      party_breakdown: partyBreakdown,
      state_breakdown: stateBreakdown,
      state_party_breakdown: statePartyBreakdown
    });
  } catch (error) {
    console.error('Error fetching topic breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch topic breakdown', message: error.message });
  }
}

