import { useEffect, useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import dayjs from 'dayjs';

export default function LegislatorPosts({ 
  legislator, 
  sortFilters, 
  startDate, 
  endDate,
  open,
  onClose
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    if (!legislator || !open) return;

    setLoading(true);
    setError(null);

    const url = `/api/posts-json?legislator=${legislator.legislator_id}&sort=${sortFilters.activeSort || 'date'}&start_date=${startDate?.format('YYYY-MM-DD')}&end_date=${endDate?.format('YYYY-MM-DD')}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const postsArray =
          Array.isArray(data) ? data :
          Array.isArray(data.posts) ? data.posts : [];

        setPosts(postsArray);
        setVisibleCount(10);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [legislator, sortFilters, startDate, endDate, open]);

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
                  Showing {Math.min(visibleCount, posts.length)} of {posts.length} posts
                </p>
              </div>

              <button
                className="btn btn-sm btn-error"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center space-x-2 text-gray-500">
                  <FaSpinner className="animate-spin" /> Loading posts…
                </div>
              ) : error ? (
                <div className="text-sm text-red-500">{error}</div>
              ) : posts.length === 0 ? (
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
                      {posts.slice(0, visibleCount).map(post => (
                        <tr key={post.id || post.tweet_id}>
                          <td>{dayjs(post.created_at || post.date).format('YYYY-MM-DD')}</td>
                         <td className="break-words whitespace-normal">{post.text}</td>
                          <td>{post.topic}</td>
                          <td>{post.engagement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Load More */}
                  {visibleCount < posts.length && (
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