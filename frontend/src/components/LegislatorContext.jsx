import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaUser, FaArrowLeft, FaChartLine, FaUsers, FaShieldAlt, FaStar, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getTopicColor, topicNames, formatTopicLabel } from '../utils/utils';
import HelpTooltip from './HelpTooltip';
import { API_BASE } from '../utils/api';
import LegislatorPosts from './LegislatorPosts';

export default function LegislatorContext({ 
  legislator, 
  setLegislator,
  startDate,
  endDate,
  // eslint-disable-next-line no-unused-vars
  selectedTopics,
  // eslint-disable-next-line no-unused-vars
  keyword,
  activeTopics,
  // eslint-disable-next-line no-unused-vars
  selectedParty = 'both' // Not used for individual legislator profiles
}) {
  const [sortFilters, setSortFilters] = useState({
    date: 'desc', // desc, asc, none
    engagement: 'none',
    civility: 'none',
    credibility: 'none'
  });

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPosts, setShowPosts] = useState(false);

  // Load legislator profile data from API
  useEffect(() => {
    const controller = new AbortController();
    
    const loadProfile = async () => {
      if (!legislator?.legislator_id) {
        setLoading(false);
        setProfileData(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = {};
        if (startDate) {
          params.start_date = typeof startDate.format === 'function' 
            ? startDate.format('YYYY-MM-DD') 
            : startDate;
        }
        if (endDate) {
          params.end_date = typeof endDate.format === 'function' 
            ? endDate.format('YYYY-MM-DD') 
            : endDate;
        }
        if (activeTopics && activeTopics.length > 0) {
          params.topics = activeTopics;
        }

        const queryString = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach(v => queryString.append(key, v));
          } else {
            queryString.append(key, value);
          }
        });

        const res = await fetch(`${API_BASE}/legislators/${legislator.legislator_id}/profile?${queryString.toString()}`, {
          signal: controller.signal
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP error! status: ${res.status} - ${errorText.substring(0, 100)}`);
        }
        const profile = await res.json();
        
        if (controller.signal.aborted) return;
        
        setProfileData(profile);
        setError(null);
      } catch (err) {
        if (err.name === 'AbortError') return; // Ignore aborted requests
        console.error('Error loading legislator profile:', err);
        setError(err.message);
        setProfileData(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadProfile();
    
    return () => controller.abort();
  }, [legislator?.legislator_id, startDate, endDate, activeTopics]);

  // Helper to format chamber display
  const formatChamber = (chamber) => {
    if (!chamber) return '';
    return chamber === 'H' ? 'House' : chamber === 'S' ? 'Senate' : chamber;
  };

  // Helper to format party display
  const formatParty = (party) => {
    if (!party) return '';
    if (party === 'Democratic') return 'Democrat';
    if (party === 'Republican') return 'Republican';
    return party;
  };


  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handleBack = () => {
    setLegislator(null);
  };

  const toggleSort = (filterKey) => {
    setSortFilters(prev => {
      const current = prev[filterKey];
      const next = current === 'none' ? 'desc' : current === 'desc' ? 'asc' : 'none';
      return { ...prev, [filterKey]: next };
    });
  };

  const getSortIcon = (filterKey) => {
    const sort = sortFilters[filterKey];
    if (sort === 'desc') return <FaSortDown className="text-primary" />;
    if (sort === 'asc') return <FaSortUp className="text-primary" />;
    return <FaSort className="text-base-content/40" />;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-base-300 border border-base-400 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-base-content">{payload[0].name}</p>
          <p className="text-base-content/70">{payload[0].value}%</p>
        </div>
      );
    }
    return null;
  };

  // Add PropTypes for CustomTooltip
  CustomTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.number
    }))
  };

  // Use profile data if available, otherwise use legislator basic info
  const displayData = profileData || (legislator ? {
    name: legislator.name,
    party: legislator.party,
    state: legislator.state,
    chamber: legislator.chamber,
    handle: legislator.handle,
    metrics: {
      totalPosts: 0,
      totalEngagement: 0,
      uncivilPosts: 0,
      lowCredibilityPosts: 0
    },
    breakdowns: {
      posts: { twitter: 0, facebook: 0 },
      engagement: { likes: 0, shares: 0 }
    },
    topTopicsByPosts: [],
    topTopicsByEngagement: []
  } : null);

  // Format topic data with colors and human-readable names
  const formatTopics = (topics) => {
    if (!topics || !Array.isArray(topics)) return [];
    return topics.map(topic => {
      const topicKey = topic.topic_label || topic.name;
      const displayName = topicNames[topicKey] || formatTopicLabel(topicKey) || topicKey;
      return {
        ...topic,
        color: getTopicColor(topicKey),
        displayName: displayName
      };
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-spin text-4xl text-primary mb-4">⏳</div>
        <p className="text-lg">Loading legislator data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-red-500 text-xl mb-2">⚠️</div>
        <p className="text-lg font-semibold mb-2">Error loading legislator data</p>
        <p className="text-sm text-base-content/70 text-center">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            // Trigger reload
            const loadProfile = async () => {
              try {
                const params = {};
                if (startDate) {
                  params.start_date = typeof startDate.format === 'function' 
                    ? startDate.format('YYYY-MM-DD') 
                    : startDate;
                }
                if (endDate) {
                  params.end_date = typeof endDate.format === 'function' 
                    ? endDate.format('YYYY-MM-DD') 
                    : endDate;
                }
                if (activeTopics && activeTopics.length > 0) {
                  params.topics = activeTopics;
                }
                const queryString = new URLSearchParams();
                Object.entries(params).forEach(([key, value]) => {
                  if (Array.isArray(value)) {
                    value.forEach(v => queryString.append(key, v));
                  } else {
                    queryString.append(key, value);
                  }
                });
                const res = await fetch(`${API_BASE}/legislators/${legislator.legislator_id}/profile?${queryString.toString()}`);
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                const profile = await res.json();
                setProfileData(profile);
                setError(null);
              } catch (err) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            };
            loadProfile();
          }}
          className="btn btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!displayData) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-lg">No legislator selected</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-base-100 rounded-lg shadow-lg overflow-y-auto">
      {/* Header with Back Button */}
      <div className="sticky top-0 bg-base-200 border-b border-base-300 p-3 z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 px-3 py-2 bg-base-100 hover:bg-base-300 rounded-lg transition-colors duration-200 text-base-content"
          >
            <FaArrowLeft size={16} />
            <span className="font-medium">Back to Timeline</span>
          </button>
        </div>
      </div>

      {/* Profile Content */}
      <div className="p-4 space-y-4">
        {/* Profile Header */}
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
              <FaUser size={28} className="text-primary-content" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-base-content">
              {displayData.name} ({displayData.party?.charAt(0) || '?'} - {displayData.state || 'N/A'})
            </h1>
            <p className="text-sm text-base-content/70 mt-1">
              {formatParty(displayData.party) || 'Unknown'} • {displayData.chamber ? `${formatChamber(displayData.chamber)}` : 'Unknown Chamber'} • {displayData.state || 'Unknown State'}
              {displayData.handle && ` • @${displayData.handle}`}
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <div className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">Analysis Period</div>
              <div className="text-sm font-bold text-primary">
                {startDate.format('MMM D, YYYY')} - {endDate.format('MMM D, YYYY')}
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-base-200 rounded-lg p-3 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Total number of social media posts made by the legislator across all platforms during the analysis period."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaChartLine className="text-blue-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Total<br />Posts</span>
            </div>
            <div className="text-xl font-bold text-blue-500">
              {formatNumber(displayData.metrics?.totalPosts || 0)}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              {formatNumber(displayData.breakdowns?.posts?.twitter || 0)} Twitter<br />
              {displayData.breakdowns?.posts?.facebook ? `${formatNumber(displayData.breakdowns.posts.facebook)} Facebook` : ''}
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-4 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Total engagement (likes, shares, comments, retweets) received across all posts during the analysis period."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaUsers className="text-green-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Total<br />Engagement</span>
            </div>
            <div className="text-xl font-bold text-green-500">
              {formatNumber(displayData.metrics?.totalEngagement || 0)}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              {formatNumber(displayData.breakdowns?.engagement?.likes || 0)} Likes<br />
              {formatNumber(displayData.breakdowns?.engagement?.shares || 0)} Retweets
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-4 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Number of posts classified as uncivil or inflammatory based on language analysis and content moderation criteria."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaShieldAlt className="text-red-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Uncivil<br />Posts</span>
            </div>
            <div className="text-xl font-bold text-red-500">
              {displayData.metrics?.uncivilPosts || 0}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              Uncivil Posts
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-4 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Number of posts flagged for low credibility based on fact-checking, source verification, and misinformation detection algorithms."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaStar className="text-orange-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Low<br />Credibility</span>
            </div>
            <div className="text-xl font-bold text-orange-500">
              {displayData.metrics?.lowCredibilityPosts || 0}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              Low Credibility Posts
            </div>
          </div>
        </div>


        {/* Top Topics with Two Panes */}
        <div className="bg-base-200 rounded-lg p-3">
          <h2 className="text-lg font-semibold text-base-content mb-4">Top Topics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Posts */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-base-content">By Posts</h3>
                <HelpTooltip 
                  content="Shows the distribution of topics based on the number of posts made by the legislator. Higher percentages indicate more frequent posting about that topic."
                  placement="left"
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={formatTopics(displayData.topTopicsByPosts || [])}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {formatTopics(displayData.topTopicsByPosts || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {formatTopics(displayData.topTopicsByPosts || []).length === 0 ? (
                    <div className="text-xs text-base-content/50 text-center py-2">No topic data available</div>
                  ) : (
                    formatTopics(displayData.topTopicsByPosts || []).map((topic, idx) => (
                      <div key={topic.name || idx} className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: topic.color }}
                        />
                        <span className="text-sm font-medium text-base-content">{topic.displayName || topic.name || topic.topic_label}</span>
                        <span className="text-sm text-base-content/70">{topic.value}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* By Engagement */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-base-content">By Engagement</h3>
                <HelpTooltip 
                  content="Shows the distribution of topics based on total engagement (likes, shares, comments) received. Higher percentages indicate topics that generate more public interaction."
                  placement="left"
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={formatTopics(displayData.topTopicsByEngagement || [])}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {formatTopics(displayData.topTopicsByEngagement || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {formatTopics(displayData.topTopicsByEngagement || []).length === 0 ? (
                    <div className="text-xs text-base-content/50 text-center py-2">No topic data available</div>
                  ) : (
                    formatTopics(displayData.topTopicsByEngagement || []).map((topic, idx) => (
                      <div key={topic.name || idx} className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: topic.color }}
                        />
                        <span className="text-sm font-medium text-base-content">{topic.displayName || topic.name || topic.topic_label}</span>
                        <span className="text-sm text-base-content/70">{topic.value}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Explore Posts Section */}
        <div className="bg-base-200 rounded-lg p-3">
          <h2 className="text-lg font-semibold text-base-content mb-4">Explore Posts</h2>
          
          {/* Sort Filters */}
          <div className="mb-6">
            <h3 className="font-medium text-base-content mb-3">Sort By</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button 
                onClick={() => toggleSort('date')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                  sortFilters.date !== 'none' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-base-300 bg-base-100 hover:border-base-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FaChartLine className="text-blue-500" size={16} />
                  <span className="text-sm font-medium">Date</span>
                </div>
                {getSortIcon('date')}
              </button>

              <button 
                onClick={() => toggleSort('engagement')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                  sortFilters.engagement !== 'none' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-base-300 bg-base-100 hover:border-base-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FaUsers className="text-green-500" size={16} />
                  <span className="text-sm font-medium">Engagement</span>
                </div>
                {getSortIcon('engagement')}
              </button>

              <button 
                onClick={() => toggleSort('civility')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                  sortFilters.civility !== 'none' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-base-300 bg-base-100 hover:border-base-400'
                }`}
              >
                <div className="flex items-center justify-between space-x-2">
                  <FaShieldAlt className="text-red-500" size={16} />
                  <span className="text-sm font-medium">Civility</span>
                </div>
                {getSortIcon('civility')}
              </button>

              <button 
                onClick={() => toggleSort('credibility')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                  sortFilters.credibility !== 'none' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-base-300 bg-base-100 hover:border-base-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FaStar className="text-orange-500" size={16} />
                  <span className="text-sm font-medium">Credibility</span>
                </div>
                {getSortIcon('credibility')}
              </button>
            </div>
          </div>
          
          {/* Action Button */}
          <div className="pt-4 border-t border-base-300">
            {/* <button className="btn btn-primary w-full">
              <FaChartLine className="mr-2" />
              View Posts ({formatNumber(displayData.metrics?.totalPosts || 0)} total)
            </button> */}

            <button
              className="btn btn-primary w-full"
              onClick={() => setShowPosts(prev => !prev)}
              disabled={!legislator} // optional: only clickable if legislator selected
            >
              <FaChartLine className="mr-2" />
              {showPosts ? 'Hide Posts' : `View Posts (${formatNumber(displayData.metrics?.totalPosts || 0)} total)`}
            </button>
            {showPosts && legislator && (
            <LegislatorPosts
              legislator={legislator}
              sortFilters={sortFilters}
              startDate={startDate}
              endDate={endDate}
            />
          )}

          </div>
        </div>
      </div>
    </div>
  );
}

// PropTypes validation
LegislatorContext.propTypes = {
  legislator: PropTypes.object,
  setLegislator: PropTypes.func.isRequired,
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  selectedTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  keyword: PropTypes.string,
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedParty: PropTypes.string
};
