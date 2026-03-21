import { useEffect, useState } from 'react';
import { FaSpinner, FaUsers, FaChartLine, FaShieldAlt, FaStar, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import dayjs from 'dayjs';

export default function LegislatorPosts({ 
  legislator, 
  startDate, 
  endDate,
  open,
  onClose
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(10);

  // ✅ SORT STATE
  const [sortFilters, setSortFilters] = useState({
    date: 'desc',
    engagement: 'none',
    civility: 'none',
    credibility: 'none'
  });

  // ✅ TOPIC FILTER STATE
  const [selectedTopic, setSelectedTopic] = useState('all');

  // ✅ Toggle sort
  const toggleSort = (filterKey) => {
    setSortFilters(prev => {
      const current = prev[filterKey];
      const next =
        current === 'none' ? 'desc' :
        current === 'desc' ? 'asc' :
        'none';

      return { ...prev, [filterKey]: next };
    });
  };

  // ✅ Icons
  const getSortIcon = (key) => {
    if (sortFilters[key] === 'desc') return <FaSortDown className="text-primary" />;
    if (sortFilters[key] === 'asc') return <FaSortUp className="text-primary" />;
    return <FaSort className="text-base-content/40" />;
  };

  // ✅ Active sort
  const getActiveSort = () => {
    const priority = ['date', 'engagement', 'civility', 'credibility'];
    for (let key of priority) {
      if (sortFilters[key] !== 'none') {
        return { key, order: sortFilters[key] };
      }
    }
    return { key: 'date', order: 'desc' };
  };

  useEffect(() => {
    if (!legislator || !open) return;

    setLoading(true);
    setError(null);

    fetch(`/api/posts-json?legislator=${legislator.legislator_id}&start_date=${startDate?.format('YYYY-MM-DD')}&end_date=${endDate?.format('YYYY-MM-DD')}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        let postsArray =
          Array.isArray(data) ? data :
          Array.isArray(data.posts) ? data.posts : [];

        setPosts(postsArray);
        setVisibleCount(10);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [legislator, startDate, endDate, open]);

  // ✅ UNIQUE TOPICS
  const uniqueTopics = [...new Set(posts.map(p => p.topic).filter(Boolean))];

  // ✅ FILTER POSTS BY TOPIC
  const filteredPosts = selectedTopic === 'all'
    ? posts
    : posts.filter(p => p.topic === selectedTopic);

  // ✅ APPLY SORTING ON FILTERED POSTS
  const sortedPosts = (() => {
    const { key, order } = getActiveSort();

    return [...filteredPosts].sort((a, b) => {
      let valA, valB;

      if (key === 'date') {
        valA = new Date(a.created_at || a.date);
        valB = new Date(b.created_at || b.date);
      } else if (key === 'engagement') {
        valA = a.engagement || 0;
        valB = b.engagement || 0;
      } else if (key === 'civility') {
        valA = a.civility_score || 0;
        valB = b.civility_score || 0;
      } else if (key === 'credibility') {
        valA = a.credibility_score || 0;
        valB = b.credibility_score || 0;
      }

      return order === 'asc' ? valA - valB : valB - valA;
    });
  })();

  if (!legislator) return null;

  return (
    <>
      {open && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
          onClick={onClose}
        >
          <div 
            className="bg-base-100 w-4/5 max-h-[80vh] rounded-lg p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <div>
                <h3 className="font-semibold text-lg">
                  Posts for {legislator.name}
                </h3>
                <p className="text-sm text-gray-500">
                  Showing {Math.min(visibleCount, sortedPosts.length)} of {sortedPosts.length} posts
                </p>
              </div>

              <button className="btn btn-sm btn-error" onClick={onClose}>
                Close
              </button>
            </div>

            {/* SORT + TOPIC FILTER */}
            <div className="mb-4 flex flex-wrap gap-3 items-center">

              {/* Sort Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleSort('date')}
                  className={`flex items-center justify-between px-2 py-1 border rounded text-xs ${
                    sortFilters.date !== 'none'
                      ? 'border-primary bg-primary/10'
                      : 'border-base-300 bg-base-100'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <FaChartLine size={12} className="text-blue-500" />
                    Date
                  </span>
                  {getSortIcon('date')}
                </button>

                <button
                  onClick={() => toggleSort('engagement')}
                  className={`flex items-center justify-between px-2 py-1 border rounded text-xs ${
                    sortFilters.engagement !== 'none'
                      ? 'border-primary bg-primary/10'
                      : 'border-base-300 bg-base-100'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <FaUsers size={12} className="text-green-500" />
                    Engagement
                  </span>
                  {getSortIcon('engagement')}
                </button>
              </div>

              {/* Topic Dropdown */}
              <select
                className="select select-xs border border-base-300"
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e.target.value);
                  setVisibleCount(10);
                }}
              >
                <option value="all">All Topics</option>
                {uniqueTopics.map((topic, idx) => (
                  <option key={idx} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>

            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center space-x-2 text-gray-500">
                  <FaSpinner className="animate-spin" /> Loading posts…
                </div>
              ) : error ? (
                <div className="text-sm text-red-500">{error}</div>
              ) : sortedPosts.length === 0 ? (
                <div className="text-sm text-gray-500">No posts found.</div>
              ) : (
                <>
                  <table className="table table-zebra w-full text-sm">
                    <thead className="sticky top-0 bg-base-100 z-10">
                      <tr>
                        <th>Date</th>
                        <th>Text</th>
                        <th>Topic</th>
                        <th>Engagement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPosts.slice(0, visibleCount).map(post => (
                        <tr key={post.id || post.tweet_id}>
                          <td>{dayjs(post.created_at || post.date).format('YYYY-MM-DD')}</td>
                          <td className="break-words whitespace-normal">{post.text}</td>
                          <td>{post.topic}</td>
                          <td>{post.engagement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {visibleCount < sortedPosts.length && (
                    <div className="text-center mt-4">
                      <button
                        className="btn btn-outline"
                        onClick={() => setVisibleCount(prev => prev + 10)}
                      >
                        Load More
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}