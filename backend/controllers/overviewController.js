import pool from '../config/database.js';

/**
 * GET /api/default_overview_data/
 * Returns overview metrics aggregated by party
 * Query params: start_date, end_date, topics (comma-separated)
 */
export async function getDefaultOverviewData(req, res) {
  try {
    const { start_date, end_date, topics, party, keyword } = req.query;

    // Build base filter
    let baseFilter = '';
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      baseFilter += ` AND p.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      baseFilter += ` AND p.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Add keyword search filter
    if (keyword && keyword.trim()) {
      baseFilter += ` AND p.text ILIKE $${paramIndex}`;
      params.push(`%${keyword.trim()}%`);
      paramIndex++;
    }

    if (topics) {
      const topicList = Array.isArray(topics) ? topics : topics.split(',');
      const placeholders = topicList.map((_, i) => `$${paramIndex + i}`).join(',');
      baseFilter += ` AND t.topic_label = ANY(ARRAY[${placeholders}])`;
      params.push(...topicList);
      paramIndex += topicList.length;
    }

    // Build party filter - if party is specified, only show that party
    // Include NULL parties in totals, grouping them appropriately
    let partyFilter = `WHERE 1=1`;  // No party filter by default - include all
    if (party && party !== 'both') {
      // Map 'D' to 'Democratic', 'R' to 'Republican'
      const partyMap = { 'D': 'Democratic', 'R': 'Republican' };
      const partyValue = partyMap[party] || party;
      partyFilter = `WHERE l.party = $${paramIndex}`;
      params.push(partyValue);
      paramIndex++;
    }

    // Get summary metrics by party
    // v3 schema: Includes all engagement metrics (replies, quotes) and comprehensive toxicity
    // Using tox_toxicity > 0.5 as proxy for uncivil posts
    const query = `
      SELECT 
        l.party,
        COUNT(DISTINCT p.id) as total_posts,
        SUM(p.like_count) as total_likes,
        SUM(p.retweet_count) as total_retweets,
        SUM(COALESCE(p.reply_count, 0)) as total_replies,
        SUM(COALESCE(p.quote_count, 0)) as total_quotes,
        COUNT(DISTINCT l.lid) as number_legislators,
        AVG(COALESCE(p.like_count, 0) + COALESCE(p.retweet_count, 0) + 
            COALESCE(p.reply_count, 0) + COALESCE(p.quote_count, 0)) as avg_engagement,
        SUM(CASE WHEN p.tox_toxicity > 0.5 THEN 1 ELSE 0 END) as uncivil_posts,
        SUM(COALESCE(p.count_misinfo, 0)) as low_credibility_posts
      FROM posts p
      JOIN legislators l ON p.lid = l.lid
      JOIN topics t ON p.topic = t.topic
      ${partyFilter}
        ${baseFilter}
      GROUP BY l.party
    `;

    const result = await pool.query(query, params);

    const summaryMetrics = {
      Democratic: {
        totalPosts: 0,
        totalLikes: 0,
        totalRetweets: 0,
        totalReplies: 0,
        totalQuotes: 0,
        numberLegislators: 0,
        avgEngagement: 0.0,
        mostActiveState: null,
        uncivilPosts: 0,
        lowCredibilityPosts: 0
      },
      Republican: {
        totalPosts: 0,
        totalLikes: 0,
        totalRetweets: 0,
        totalReplies: 0,
        totalQuotes: 0,
        numberLegislators: 0,
        avgEngagement: 0.0,
        mostActiveState: null,
        uncivilPosts: 0,
        lowCredibilityPosts: 0
      }
    };

    // Aggregate all results - handle both party-specific and null party data
    // First, get totals across all parties (including null)
    let totalPosts = 0, totalLikes = 0, totalRetweets = 0, totalReplies = 0, totalQuotes = 0;
    let totalLegislators = 0, totalUncivil = 0, totalLowCred = 0, totalEngagement = 0, engagementCount = 0;
    
    result.rows.forEach(row => {
      totalPosts += parseInt(row.total_posts) || 0;
      totalLikes += parseInt(row.total_likes) || 0;
      totalRetweets += parseInt(row.total_retweets) || 0;
      totalReplies += parseInt(row.total_replies) || 0;
      totalQuotes += parseInt(row.total_quotes) || 0;
      totalLegislators += parseInt(row.number_legislators) || 0;
      totalUncivil += parseInt(row.uncivil_posts) || 0;
      totalLowCred += parseInt(row.low_credibility_posts) || 0;
      if (row.avg_engagement) {
        totalEngagement += parseFloat(row.avg_engagement) * parseInt(row.total_posts);
        engagementCount += parseInt(row.total_posts);
      }
    });

    // Get most active state overall (not party-specific)
    const stateQuery = `
      SELECT 
        l.state,
        COUNT(DISTINCT p.id) as post_count
      FROM posts p
      JOIN legislators l ON p.lid = l.lid
      JOIN topics t ON p.topic = t.topic
      WHERE l.state IS NOT NULL
        ${baseFilter}
      GROUP BY l.state
      ORDER BY post_count DESC
      LIMIT 1
    `;
    const stateResult = await pool.query(stateQuery, params);
    const mostActiveState = stateResult.rows[0]?.state || null;

    // ------------------------------------------------------------------------
    // Legislator metadata (new v3 enrichment)
    // Computed over *active legislators* in the current filter scope.
    // ------------------------------------------------------------------------
    const endYear =
      typeof end_date === 'string' && end_date.length >= 4
        ? parseInt(end_date.slice(0, 4), 10)
        : new Date().getFullYear();

    // Only queries that reference endYearParam should receive metaParams.
    // Other queries must receive the original `params` or Postgres will error
    // with "bind message supplies X parameters, but prepared statement requires Y".
    const metaParams = [...params, endYear];
    const endYearParam = `$${metaParams.length}`;

    const legislatorMetaOverallQuery = `
      WITH filtered_posts AS (
        SELECT DISTINCT p.lid
        FROM posts p
        JOIN legislators l ON p.lid = l.lid
        JOIN topics t ON p.topic = t.topic
        ${partyFilter}
          ${baseFilter}
      ),
      active_legs AS (
        SELECT l.*
        FROM legislators l
        JOIN filtered_posts fp ON fp.lid = l.lid
      )
      SELECT
        COUNT(*)::int AS active_legislators,
        COUNT(*) FILTER (WHERE gender = 'M')::int AS gender_m,
        COUNT(*) FILTER (WHERE gender = 'F')::int AS gender_f,
        COUNT(*) FILTER (WHERE gender IS NULL OR gender NOT IN ('M','F'))::int AS gender_unknown,
        AVG(vote_pct) AS avg_vote_pct,
        AVG(mrp_ideology) AS avg_mrp_ideology,
        AVG(polarization) AS avg_polarization,
        AVG(
          (COALESCE(yr_left_office, ${endYearParam}) - yr_elected + 1)
        ) FILTER (WHERE yr_elected IS NOT NULL) AS avg_tenure_years,
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY (COALESCE(yr_left_office, ${endYearParam}) - yr_elected + 1)
        ) FILTER (WHERE yr_elected IS NOT NULL) AS median_tenure_years
      FROM active_legs;
    `;

    const legislatorMetaByPartyQuery = `
      WITH filtered_posts AS (
        SELECT DISTINCT p.lid
        FROM posts p
        JOIN legislators l ON p.lid = l.lid
        JOIN topics t ON p.topic = t.topic
        ${partyFilter}
          ${baseFilter}
      ),
      active_legs AS (
        SELECT l.*
        FROM legislators l
        JOIN filtered_posts fp ON fp.lid = l.lid
      )
      SELECT
        COALESCE(l.party, 'Unknown') AS party,
        COUNT(*)::int AS active_legislators,
        COUNT(*) FILTER (WHERE gender = 'M')::int AS gender_m,
        COUNT(*) FILTER (WHERE gender = 'F')::int AS gender_f,
        COUNT(*) FILTER (WHERE gender IS NULL OR gender NOT IN ('M','F'))::int AS gender_unknown,
        AVG(vote_pct) AS avg_vote_pct,
        AVG(mrp_ideology) AS avg_mrp_ideology,
        AVG(polarization) AS avg_polarization,
        AVG(
          (COALESCE(yr_left_office, ${endYearParam}) - yr_elected + 1)
        ) FILTER (WHERE yr_elected IS NOT NULL) AS avg_tenure_years,
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY (COALESCE(yr_left_office, ${endYearParam}) - yr_elected + 1)
        ) FILTER (WHERE yr_elected IS NOT NULL) AS median_tenure_years
      FROM active_legs l
      GROUP BY COALESCE(l.party, 'Unknown');
    `;

    const topRacesQuery = `
      WITH filtered_posts AS (
        SELECT DISTINCT p.lid
        FROM posts p
        JOIN legislators l ON p.lid = l.lid
        JOIN topics t ON p.topic = t.topic
        ${partyFilter}
          ${baseFilter}
      ),
      active_legs AS (
        SELECT l.*
        FROM legislators l
        JOIN filtered_posts fp ON fp.lid = l.lid
      )
      SELECT
        COALESCE(NULLIF(TRIM(race), ''), 'Unknown') AS race,
        COUNT(*)::int AS count
      FROM active_legs
      GROUP BY COALESCE(NULLIF(TRIM(race), ''), 'Unknown')
      ORDER BY count DESC
      LIMIT 8;
    `;

    const topOfficeLevelsQuery = `
      WITH filtered_posts AS (
        SELECT DISTINCT p.lid
        FROM posts p
        JOIN legislators l ON p.lid = l.lid
        JOIN topics t ON p.topic = t.topic
        ${partyFilter}
          ${baseFilter}
      ),
      active_legs AS (
        SELECT l.*
        FROM legislators l
        JOIN filtered_posts fp ON fp.lid = l.lid
      )
      SELECT
        COALESCE(NULLIF(TRIM(office_level), ''), 'Unknown') AS office_level,
        COUNT(*)::int AS count
      FROM active_legs
      GROUP BY COALESCE(NULLIF(TRIM(office_level), ''), 'Unknown')
      ORDER BY count DESC
      LIMIT 8;
    `;

    const [
      legislatorMetaOverallRes,
      legislatorMetaByPartyRes,
      topRacesRes,
      topOfficeLevelsRes,
    ] = await Promise.all([
      // Uses endYearParam → needs metaParams
      pool.query(legislatorMetaOverallQuery, metaParams),
      // Uses endYearParam → needs metaParams
      pool.query(legislatorMetaByPartyQuery, metaParams),
      // Does NOT use endYearParam → must use params
      pool.query(topRacesQuery, params),
      // Does NOT use endYearParam → must use params
      pool.query(topOfficeLevelsQuery, params),
    ]);

    const legislatorMetaOverallRow = legislatorMetaOverallRes.rows[0] || {};
    const legislatorMeta = {
      overall: {
        activeLegislators: legislatorMetaOverallRow.active_legislators ?? 0,
        gender: {
          M: legislatorMetaOverallRow.gender_m ?? 0,
          F: legislatorMetaOverallRow.gender_f ?? 0,
          Unknown: legislatorMetaOverallRow.gender_unknown ?? 0,
        },
        avgVotePct: legislatorMetaOverallRow.avg_vote_pct !== null ? Number(legislatorMetaOverallRow.avg_vote_pct) : null,
        avgMrpIdeology: legislatorMetaOverallRow.avg_mrp_ideology !== null ? Number(legislatorMetaOverallRow.avg_mrp_ideology) : null,
        avgPolarization: legislatorMetaOverallRow.avg_polarization !== null ? Number(legislatorMetaOverallRow.avg_polarization) : null,
        avgTenureYears: legislatorMetaOverallRow.avg_tenure_years !== null ? Number(legislatorMetaOverallRow.avg_tenure_years) : null,
        medianTenureYears: legislatorMetaOverallRow.median_tenure_years !== null ? Number(legislatorMetaOverallRow.median_tenure_years) : null,
      },
      byParty: {},
      topRaces: topRacesRes.rows || [],
      topOfficeLevels: topOfficeLevelsRes.rows || [],
    };

    for (const row of legislatorMetaByPartyRes.rows || []) {
      legislatorMeta.byParty[row.party] = {
        activeLegislators: row.active_legislators ?? 0,
        gender: {
          M: row.gender_m ?? 0,
          F: row.gender_f ?? 0,
          Unknown: row.gender_unknown ?? 0,
        },
        avgVotePct: row.avg_vote_pct !== null ? Number(row.avg_vote_pct) : null,
        avgMrpIdeology: row.avg_mrp_ideology !== null ? Number(row.avg_mrp_ideology) : null,
        avgPolarization: row.avg_polarization !== null ? Number(row.avg_polarization) : null,
        avgTenureYears: row.avg_tenure_years !== null ? Number(row.avg_tenure_years) : null,
        medianTenureYears: row.median_tenure_years !== null ? Number(row.median_tenure_years) : null,
      };
    }

    // Try to find party-specific data, fallback to total split
    const demRow = result.rows.find(r => r.party === 'Democratic');
    const repRow = result.rows.find(r => r.party === 'Republican');
    
    // If no party data exists, split totals evenly for display purposes
    const hasPartyData = demRow || repRow;
    
    if (hasPartyData) {
      // Use actual party data where available
      summaryMetrics.Democratic = {
        totalPosts: parseInt(demRow?.total_posts) || 0,
        totalLikes: parseInt(demRow?.total_likes) || 0,
        totalRetweets: parseInt(demRow?.total_retweets) || 0,
        totalReplies: parseInt(demRow?.total_replies) || 0,
        totalQuotes: parseInt(demRow?.total_quotes) || 0,
        numberLegislators: parseInt(demRow?.number_legislators) || 0,
        avgEngagement: parseFloat(demRow?.avg_engagement) || 0.0,
        mostActiveState: mostActiveState,
        uncivilPosts: parseInt(demRow?.uncivil_posts) || 0,
        lowCredibilityPosts: parseInt(demRow?.low_credibility_posts) || 0
      };
      summaryMetrics.Republican = {
        totalPosts: parseInt(repRow?.total_posts) || 0,
        totalLikes: parseInt(repRow?.total_likes) || 0,
        totalRetweets: parseInt(repRow?.total_retweets) || 0,
        totalReplies: parseInt(repRow?.total_replies) || 0,
        totalQuotes: parseInt(repRow?.total_quotes) || 0,
        numberLegislators: parseInt(repRow?.number_legislators) || 0,
        avgEngagement: parseFloat(repRow?.avg_engagement) || 0.0,
        mostActiveState: mostActiveState,
        uncivilPosts: parseInt(repRow?.uncivil_posts) || 0,
        lowCredibilityPosts: parseInt(repRow?.low_credibility_posts) || 0
      };
    } else {
      // No party data - put all totals in "Democratic" slot for display
      // (frontend will show combined totals anyway)
      const avgEng = engagementCount > 0 ? totalEngagement / engagementCount : 0;
      summaryMetrics.Democratic = {
        totalPosts: totalPosts,
        totalLikes: totalLikes,
        totalRetweets: totalRetweets,
        totalReplies: totalReplies,
        totalQuotes: totalQuotes,
        numberLegislators: totalLegislators,
        avgEngagement: avgEng,
        mostActiveState: mostActiveState,
        uncivilPosts: totalUncivil,
        lowCredibilityPosts: totalLowCred
      };
      summaryMetrics.Republican = {
        totalPosts: 0,
        totalLikes: 0,
        totalRetweets: 0,
        totalReplies: 0,
        totalQuotes: 0,
        numberLegislators: 0,
        avgEngagement: 0.0,
        mostActiveState: null,
        uncivilPosts: 0,
        lowCredibilityPosts: 0
      };
    }

    res.json({ summaryMetrics, legislatorMeta });
  } catch (error) {
    console.error('Error fetching overview data:', error);
    res.status(500).json({ error: error.message });
  }
}
