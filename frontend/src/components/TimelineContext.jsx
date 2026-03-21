import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  FaChartBar,
  FaSpinner,
  FaNewspaper,
  FaThumbsUp,
  FaExchangeAlt,
  FaDemocrat,
  FaRepublican,
  FaExclamationTriangle,
  FaHandshakeSlash,
  FaGlobe,
  FaCalendarAlt,
  FaHashtag,
  FaChartLine
} from 'react-icons/fa';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';
import { formatNumber, topicNames, formatTopicLabel } from '../utils/utils';
import HelpTooltip from './HelpTooltip';
import { API_BASE } from '../utils/api';

// ============================================================================
// UI helpers (2025-style: compact, responsive, progressive disclosure)
// ============================================================================
function Card({ children, className = '' }) {
  return (
    <div className={`bg-base-200/60 border border-base-300/60 rounded-xl shadow-sm hover:shadow-md transition-shadow ${className}`}>
      {children}
    </div>
  );
}

Card.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
};

function Section({ title, icon: Icon, iconClassName = 'text-primary', tooltip, children, right }) {
  return (
    <Card className="relative p-4 sm:p-5">
      {tooltip ? (
        <div className="absolute top-3 right-3 opacity-70 hover:opacity-100 transition-opacity">
          <HelpTooltip content={tooltip} placement="left" />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3 mb-4 pr-8">
        <div className="flex items-center gap-2 min-w-0">
          {Icon ? <Icon className={iconClassName} size={18} /> : null}
          <h2 className="text-base sm:text-lg font-semibold text-base-content truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {right}
        </div>
      </div>
      {children}
    </Card>
  );
}

Section.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  iconClassName: PropTypes.string,
  tooltip: PropTypes.string,
  right: PropTypes.node,
  children: PropTypes.node
};

function StatLine({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="text-base-content/60">{label}</div>
      <div className="font-semibold text-base-content">{children}</div>
    </div>
  );
}

StatLine.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node
};

function KpiTile({
  icon: Icon,
  accent = 'primary',
  title,
  value,
  loading,
  format = 'number',
  decimals = 2,
  suffix = '',
  hint,
  tooltip,
  details,
}) {
  const accentMap = {
    primary: { pill: 'bg-primary/15 text-primary', value: 'text-primary' },
    info: { pill: 'bg-blue-500/15 text-blue-500', value: 'text-blue-500' },
    success: { pill: 'bg-green-500/15 text-green-500', value: 'text-green-500' },
    warning: { pill: 'bg-orange-500/15 text-orange-500', value: 'text-orange-500' },
    danger: { pill: 'bg-red-500/15 text-red-500', value: 'text-red-500' },
    neutral: { pill: 'bg-base-content/10 text-base-content', value: 'text-base-content' },
    secondary: { pill: 'bg-secondary/15 text-secondary', value: 'text-secondary' },
  };
  const a = accentMap[accent] || accentMap.primary;

  return (
    <div className="group relative rounded-2xl bg-base-100/80 border border-base-300/60 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
      {tooltip ? (
        <div className="absolute top-3 right-3 z-10 opacity-70 group-hover:opacity-100 transition-opacity">
          <HelpTooltip content={tooltip} placement="left" />
        </div>
      ) : null}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              {Icon ? (
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center ${a.pill}`}>
                  <Icon size={18} />
                </div>
              ) : null}
              <div className="min-w-0 pt-0.5">
                <div className="text-xs sm:text-sm font-semibold text-base-content/75 leading-snug whitespace-normal break-words">
                  {title}
                </div>
                {hint ? (
                  <div className="text-xs text-base-content/55 leading-snug whitespace-normal break-words mt-0.5">
                    {hint}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div className={`text-2xl sm:text-3xl font-bold leading-none ${a.value}`}>
            <MetricValue
              value={value}
              loading={loading}
              format={format}
              decimals={decimals}
              suffix={suffix}
              className=""
              size="lg"
            />
          </div>
        </div>

        {details ? (
          <div className="mt-3 hidden group-hover:block">
            <div className="rounded-xl bg-base-200/60 border border-base-300/60 p-3 text-sm text-base-content/70">
              {details}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

KpiTile.propTypes = {
  icon: PropTypes.elementType,
  accent: PropTypes.oneOf(['primary', 'info', 'success', 'warning', 'danger', 'neutral', 'secondary']),
  title: PropTypes.string.isRequired,
  value: PropTypes.number,
  loading: PropTypes.bool,
  format: PropTypes.oneOf(['number', 'decimal', 'raw']),
  decimals: PropTypes.number,
  suffix: PropTypes.string,
  hint: PropTypes.string,
  tooltip: PropTypes.string,
  details: PropTypes.node
};

function KpiWideCard({
  icon: Icon,
  accent = 'primary',
  title,
  hint,
  value,
  loading,
  format = 'number',
  decimals = 2,
  suffix = '',
  tooltip,
  details,
}) {
  const accentMap = {
    primary: { pill: 'bg-primary/15 text-primary', value: 'text-primary' },
    info: { pill: 'bg-blue-500/15 text-blue-500', value: 'text-blue-500' },
    success: { pill: 'bg-green-500/15 text-green-500', value: 'text-green-500' },
    warning: { pill: 'bg-orange-500/15 text-orange-500', value: 'text-orange-500' },
    danger: { pill: 'bg-red-500/15 text-red-500', value: 'text-red-500' },
    neutral: { pill: 'bg-base-content/10 text-base-content', value: 'text-base-content' },
    secondary: { pill: 'bg-secondary/15 text-secondary', value: 'text-secondary' },
  };
  const a = accentMap[accent] || accentMap.primary;

  return (
    <div className="relative rounded-2xl bg-base-100/80 border border-base-300/60 shadow-sm hover:shadow-md transition-all">
      {tooltip ? (
        <div className="absolute top-3 right-3 z-10 opacity-70 hover:opacity-100 transition-opacity">
          <HelpTooltip content={tooltip} placement="left" />
        </div>
      ) : null}

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4 pr-8">
          {Icon ? (
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center ${a.pill} shrink-0`}>
              <Icon size={20} />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="text-sm sm:text-base font-semibold text-base-content/80 leading-snug whitespace-normal sm:whitespace-nowrap">
              {title}
            </div>
            {hint ? (
              <div className="mt-1 text-xs sm:text-sm text-base-content/55 leading-snug whitespace-normal sm:whitespace-nowrap">
                {hint}
              </div>
            ) : null}

            {details ? (
              <details className="mt-3">
                <summary className="cursor-pointer select-none text-xs text-base-content/60 hover:text-base-content">
                  Details
                </summary>
                <div className="mt-2 rounded-xl bg-base-200/60 border border-base-300/60 p-3 text-sm text-base-content/70">
                  {details}
                </div>
              </details>
            ) : null}
          </div>

          <div className={`text-2xl sm:text-3xl font-bold leading-none ${a.value} text-right shrink-0`}>
            <MetricValue
              value={value}
              loading={loading}
              format={format}
              decimals={decimals}
              suffix={suffix}
              size="lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

KpiWideCard.propTypes = {
  icon: PropTypes.elementType,
  accent: PropTypes.oneOf(['primary', 'info', 'success', 'warning', 'danger', 'neutral', 'secondary']),
  title: PropTypes.string.isRequired,
  hint: PropTypes.string,
  value: PropTypes.number,
  loading: PropTypes.bool,
  format: PropTypes.oneOf(['number', 'decimal', 'raw']),
  decimals: PropTypes.number,
  suffix: PropTypes.string,
  tooltip: PropTypes.string,
  details: PropTypes.node
};

function KpiFlipCard({
  icon: Icon,
  accent = 'primary',
  label,
  value,
  loading,
  format = 'number',
  decimals = 2,
  suffix = '',
  tooltip,
  backContent,
  flipped,
  onToggle,
}) {
  const accentMap = {
    primary: { pill: 'bg-primary/15 text-primary', value: 'text-primary', border: 'border-primary/20' },
    info: { pill: 'bg-blue-500/15 text-blue-500', value: 'text-blue-500', border: 'border-blue-500/20' },
    success: { pill: 'bg-green-500/15 text-green-500', value: 'text-green-500', border: 'border-green-500/20' },
    warning: { pill: 'bg-orange-500/15 text-orange-500', value: 'text-orange-500', border: 'border-orange-500/20' },
    danger: { pill: 'bg-red-500/15 text-red-500', value: 'text-red-500', border: 'border-red-500/20' },
    neutral: { pill: 'bg-base-content/10 text-base-content', value: 'text-base-content', border: 'border-base-content/10' },
    secondary: { pill: 'bg-secondary/15 text-secondary', value: 'text-secondary', border: 'border-secondary/20' },
  };
  const a = accentMap[accent] || accentMap.primary;

  const canFlip = Boolean(backContent);

  const handleToggle = () => {
    if (!canFlip) return;
    onToggle?.();
  };

  return (
    <div className="relative [perspective:1000px]">
      <button
        type="button"
        onClick={handleToggle}
        className={`relative w-full text-left rounded-2xl bg-base-100/80 border border-base-300/60 ${a.border} shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/40`}
        aria-pressed={flipped ? 'true' : 'false'}
        aria-label={canFlip ? `${label} (click to flip)` : label}
      >
        {tooltip ? (
          <div className="absolute top-2 right-2 z-20 opacity-70 hover:opacity-100 transition-opacity">
            <HelpTooltip content={tooltip} placement="left" />
          </div>
        ) : null}

        <div
          className={`relative rounded-2xl p-3 sm:p-4 min-h-[112px] sm:min-h-[124px] transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          {/* Front */}
          <div className="absolute inset-0 p-3 sm:p-4 flex flex-col items-center justify-center text-center [backface-visibility:hidden]">
            {Icon ? (
              <div className={`absolute top-2 left-2 z-20 w-10 h-10 rounded-2xl flex items-center justify-center ${a.pill}`}>
                <Icon size={16} />
              </div>
            ) : null}
            <div className={`text-3xl sm:text-4xl font-extrabold leading-none ${a.value}`}>
              <MetricValue
                value={value}
                loading={loading}
                format={format}
                decimals={decimals}
                suffix={suffix}
                size="lg"
              />
            </div>
            <div className="mt-2 text-sm sm:text-base font-semibold text-base-content/80 leading-snug">
              {label}
            </div>
            {canFlip ? (
              <div className="mt-1 text-[11px] text-base-content/40">
                Flip
              </div>
            ) : null}
          </div>

          {/* Back */}
          <div className="absolute inset-0 p-3 sm:p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {Icon ? (
              <div className={`absolute top-2 left-2 z-20 w-10 h-10 rounded-2xl flex items-center justify-center ${a.pill}`}>
                <Icon size={16} />
              </div>
            ) : null}
            <div className="flex items-start justify-between gap-2 pr-8 pl-12">
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-semibold text-base-content mt-0.5 leading-snug">{label}</div>
              </div>
              <div className={`text-lg sm:text-xl font-bold ${a.value}`}>
                {loading ? '…' : (
                  <MetricValue value={value} loading={false} format={format} decimals={decimals} suffix={suffix} size="md" />
                )}
              </div>
            </div>

            <div className="mt-2 rounded-xl bg-base-200/60 border border-base-300/60 p-2.5 text-sm text-base-content/70 pl-12">
              {backContent}
            </div>

            <div className="mt-1 text-[11px] text-base-content/40">
              Back
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

KpiFlipCard.propTypes = {
  icon: PropTypes.elementType,
  accent: PropTypes.oneOf(['primary', 'info', 'success', 'warning', 'danger', 'neutral', 'secondary']),
  label: PropTypes.string.isRequired,
  value: PropTypes.number,
  loading: PropTypes.bool,
  format: PropTypes.oneOf(['number', 'decimal', 'raw']),
  decimals: PropTypes.number,
  suffix: PropTypes.string,
  tooltip: PropTypes.string,
  backContent: PropTypes.node,
  flipped: PropTypes.bool,
  onToggle: PropTypes.func,
};

// ============================================================================
// Loading Value Component - Shows spinner until value is loaded
// ============================================================================
function MetricValue({ value, loading, format = 'number', decimals = 2, suffix = '', className = '', size = 'lg' }) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-xl'
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${sizeClasses[size]} ${className}`}>
        <FaSpinner className="animate-spin text-base-content/40" size={size === 'lg' ? 20 : 14} />
      </div>
    );
  }

  let displayValue;
  if (format === 'number') {
    displayValue = formatNumber(value || 0);
  } else if (format === 'decimal') {
    displayValue = (value || 0).toFixed(decimals);
  } else if (format === 'raw') {
    displayValue = value ?? 'N/A';
  } else {
    displayValue = value;
  }

  return (
    <span className={`font-bold ${sizeClasses[size]} ${className}`}>
      {displayValue}{suffix}
    </span>
  );
}

MetricValue.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  loading: PropTypes.bool,
  format: PropTypes.oneOf(['number', 'decimal', 'raw']),
  decimals: PropTypes.number,
  suffix: PropTypes.string,
  className: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl'])
};

// ============================================================================
// Metric Card Component - Reusable card with loading state
// ============================================================================
// NOTE: MetricCard intentionally removed in favor of KpiTile (cleaner 2025 styling).

// ============================================================================
// Party Card Component - Shows party-specific metrics
// ============================================================================
function PartyCard({ party, data, loading }) {
  const isDemo = party === 'Democratic';
  const Icon = isDemo ? FaDemocrat : FaRepublican;
  const borderColor = isDemo ? 'border-blue-500/70' : 'border-red-500/70';
  const textColor = isDemo ? 'text-blue-500' : 'text-red-500';

  const engagementTotal =
    (data?.totalLikes || 0) + (data?.totalRetweets || 0) + (data?.totalReplies || 0) + (data?.totalQuotes || 0);

  return (
    <div className={`rounded-2xl bg-base-100/80 border border-base-300/60 shadow-sm hover:shadow-md transition-all p-4 border-l-4 ${borderColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={textColor} size={18} />
          <h3 className="text-sm sm:text-base font-semibold text-base-content truncate">{party}</h3>
        </div>
        <div className="text-xs text-base-content/50 whitespace-nowrap">
          Avg eng.{' '}
          <span className="font-semibold text-base-content">
            {loading ? <FaSpinner className="animate-spin inline" size={10} /> : (data?.avgEngagement ?? 0).toFixed(1)}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-base-content/60">Posts</div>
          <div className={`text-xl font-bold ${textColor}`}>
            {loading ? <FaSpinner className="animate-spin inline" size={14} /> : formatNumber(data?.totalPosts || 0)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-base-content/60">Active legislators</div>
          <div className="text-xl font-bold text-green-500">
            {loading ? <FaSpinner className="animate-spin inline" size={14} /> : formatNumber(data?.numberLegislators || 0)}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-base-200/50 border border-base-300/50 p-3">
        <div className="flex items-center justify-between text-xs text-base-content/60">
          <span>Engagement totals</span>
          <span className="font-semibold text-base-content">{loading ? '…' : formatNumber(engagementTotal)}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between"><span className="text-base-content/60">Likes</span><span className="font-semibold text-base-content">{loading ? '…' : formatNumber(data?.totalLikes || 0)}</span></div>
          <div className="flex justify-between"><span className="text-base-content/60">Retweets</span><span className="font-semibold text-base-content">{loading ? '…' : formatNumber(data?.totalRetweets || 0)}</span></div>
          <div className="flex justify-between"><span className="text-base-content/60">Replies</span><span className="font-semibold text-base-content">{loading ? '…' : formatNumber(data?.totalReplies || 0)}</span></div>
          <div className="flex justify-between"><span className="text-base-content/60">Quotes</span><span className="font-semibold text-base-content">{loading ? '…' : formatNumber(data?.totalQuotes || 0)}</span></div>
        </div>
      </div>

      <details className="mt-3 group">
        <summary className="cursor-pointer select-none text-xs text-base-content/60 hover:text-base-content flex items-center justify-between">
          <span>More details</span>
          <span className="text-base-content/40 group-open:hidden">expand</span>
          <span className="text-base-content/40 hidden group-open:inline">collapse</span>
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-base-content/70">
          <div className="flex justify-between bg-base-100/70 rounded-lg p-2">
            <span>Top state</span>
            <span className="font-semibold text-base-content">{loading ? '…' : (data?.mostActiveState ?? 'N/A')}</span>
          </div>
          <div className="flex justify-between bg-base-100/70 rounded-lg p-2">
            <span>Uncivil</span>
            <span className="font-semibold text-red-500">{loading ? '…' : formatNumber(data?.uncivilPosts || 0)}</span>
          </div>
        </div>
      </details>
    </div>
  );
}

PartyCard.propTypes = {
  party: PropTypes.oneOf(['Democratic', 'Republican']).isRequired,
  data: PropTypes.object,
  loading: PropTypes.bool
};

// ============================================================================
// Main TimelineContext Component
// ============================================================================
export default function TimelineContext({ 
  startDate, 
  endDate, 
  selectedTopics = [],
  // eslint-disable-next-line no-unused-vars
  keyword = '', 
  setLegislator,
  activeTopics = [],  // This is the actual list of selected topics from sidebar
  selectedParty = 'both'
}) {
  // Use activeTopics if provided, otherwise fall back to selectedTopics
  const effectiveTopics = activeTopics.length > 0 ? activeTopics : selectedTopics;
  const [summaryMetrics, setSummaryMetrics] = useState(null);
  const [legislatorMeta, setLegislatorMeta] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [error, setError] = useState('');
  const [flippedKpi, setFlippedKpi] = useState(null); // 'posts' | 'engagement' | 'uncivil' | 'lowcred'

  // Build query params once, memoized
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (startDate) {
      const dateStr = typeof startDate.format === 'function' 
        ? startDate.format('YYYY-MM-DD') 
        : startDate;
      params.append('start_date', dateStr);
    }
    if (endDate) {
      const dateStr = typeof endDate.format === 'function' 
        ? endDate.format('YYYY-MM-DD') 
        : endDate;
      params.append('end_date', dateStr);
    }
    // Use effectiveTopics (activeTopics or selectedTopics)
    if (effectiveTopics && effectiveTopics.length > 0) {
      effectiveTopics.forEach(t => params.append('topics', t));
    }
    if (selectedParty && selectedParty !== 'both') {
      params.append('party', selectedParty);
    }
    if (keyword && keyword.trim()) {
      params.append('keyword', keyword.trim());
    }
    
    return params.toString();
  }, [startDate, endDate, effectiveTopics, selectedParty, keyword]);

  // Fetch overview data
  useEffect(() => {
    const controller = new AbortController();
    
    const fetchData = async () => {
      setLoadingOverview(true);
      setError('');
      
      try {
        const res = await fetch(`${API_BASE}/default_overview_data/?${queryParams}`, {
          signal: controller.signal
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        setSummaryMetrics(data.summaryMetrics);
        setLegislatorMeta(data.legislatorMeta || null);
      } catch (err) {
        if (err.name === 'AbortError') return; // Ignore aborted requests
        
        console.error('Error loading overview data:', err);
        setError('Failed to load overview data');
        // Set empty defaults so UI still renders
        setSummaryMetrics({
          Democratic: { totalPosts: 0, totalLikes: 0, totalRetweets: 0, totalReplies: 0, totalQuotes: 0, numberLegislators: 0, avgEngagement: 0, mostActiveState: null, uncivilPosts: 0, lowCredibilityPosts: 0 },
          Republican: { totalPosts: 0, totalLikes: 0, totalRetweets: 0, totalReplies: 0, totalQuotes: 0, numberLegislators: 0, avgEngagement: 0, mostActiveState: null, uncivilPosts: 0, lowCredibilityPosts: 0 }
        });
        setLegislatorMeta(null);
      } finally {
        setLoadingOverview(false);
      }
    };

    fetchData();
    
    return () => controller.abort();
  }, [queryParams]);

  // Computed values - safely handle null metrics (v3 schema with comprehensive engagement)
  const totals = useMemo(() => {
    if (!summaryMetrics) return null;
    const dem = summaryMetrics.Democratic || {};
    const rep = summaryMetrics.Republican || {};
    return {
      posts: (dem.totalPosts || 0) + (rep.totalPosts || 0),
      likes: (dem.totalLikes || 0) + (rep.totalLikes || 0),
      retweets: (dem.totalRetweets || 0) + (rep.totalRetweets || 0),
      replies: (dem.totalReplies || 0) + (rep.totalReplies || 0),
      quotes: (dem.totalQuotes || 0) + (rep.totalQuotes || 0),
      totalEngagement: (dem.totalLikes || 0) + (rep.totalLikes || 0) + 
                      (dem.totalRetweets || 0) + (rep.totalRetweets || 0) +
                      (dem.totalReplies || 0) + (rep.totalReplies || 0) +
                      (dem.totalQuotes || 0) + (rep.totalQuotes || 0),
      legislators: (dem.numberLegislators || 0) + (rep.numberLegislators || 0),
      uncivil: (dem.uncivilPosts || 0) + (rep.uncivilPosts || 0),
      lowCred: (dem.lowCredibilityPosts || 0) + (rep.lowCredibilityPosts || 0)
    };
  }, [summaryMetrics]);

  const derived = useMemo(() => {
    const posts = totals?.posts || 0;
    const legs = totals?.legislators || 0;
    const engagement = totals?.totalEngagement || 0;
    const uncivil = totals?.uncivil || 0;
    const lowCred = totals?.lowCred || 0;

    const per = (num, den) => (den > 0 ? num / den : 0);
    return {
      engagementPerPost: per(engagement, posts),
      postsPerLegislator: per(posts, legs),
      uncivilRate: per(uncivil, posts) * 100,
      lowCredRate: per(lowCred, posts) * 100,
    };
  }, [totals]);

  const metaOverall = legislatorMeta?.overall || null;
  const metaByParty = legislatorMeta?.byParty || {};

  const genderOverall = useMemo(() => {
    if (!metaOverall?.gender) return null;
    const M = metaOverall.gender.M || 0;
    const F = metaOverall.gender.F || 0;
    const U = metaOverall.gender.Unknown || 0;
    const total = M + F + U;
    return { M, F, U, total };
  }, [metaOverall]);

  // Static values from props (available immediately)
  const isWeekly = endDate.diff(startDate, 'days') > 365;
  const durationDays = endDate.diff(startDate, 'days');

  return (
    <div className="h-full bg-base-100 rounded-xl shadow-lg overflow-y-auto">
      {/* Header - Always visible */}
      <div className="sticky top-0 z-10 bg-base-100/80 backdrop-blur border-b border-base-300/60">
        <div className="p-4 sm:p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 bg-primary/90 rounded-xl flex items-center justify-center shrink-0">
              <FaChartBar size={18} className="text-primary-content" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-base-content leading-tight">Timeline Overview</h1>
              <p className="text-xs sm:text-sm text-base-content/60">Essential context + expandable detail</p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[10px] sm:text-xs text-base-content/60 uppercase tracking-wide">Period</div>
            <div className="text-xs sm:text-sm font-semibold text-base-content">
              {startDate.format('MMM D, YYYY')} – {endDate.format('MMM D, YYYY')}
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mt-4 alert alert-warning text-sm">
          <FaExclamationTriangle className="mr-2" />
          {error}
        </div>
      )}

      {/* Content */}
      <div className="p-4 sm:p-5 space-y-5">
        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <KpiFlipCard
            icon={FaNewspaper}
            accent="info"
            label="Total posts"
            value={totals?.posts || 0}
            loading={loadingOverview}
            format="number"
            tooltip="Total number of social media posts made by all legislators during the analysis period."
            flipped={flippedKpi === 'posts'}
            onToggle={() => setFlippedKpi(prev => (prev === 'posts' ? null : 'posts'))}
            backContent={
              <div className="space-y-1.5">
                <StatLine label="Active legislators">{formatNumber(totals?.legislators || 0)}</StatLine>
                <StatLine label="Posts / legislator">
                  {loadingOverview ? '…' : derived.postsPerLegislator.toFixed(2)}
                </StatLine>
              </div>
            }
          />
          <KpiFlipCard
            icon={FaThumbsUp}
            accent="success"
            label="Total engagement"
            value={totals?.totalEngagement || 0}
            loading={loadingOverview}
            format="number"
            tooltip="Total engagement across all posts: likes, retweets, replies, and quote tweets (v3 schema)."
            flipped={flippedKpi === 'engagement'}
            onToggle={() => setFlippedKpi(prev => (prev === 'engagement' ? null : 'engagement'))}
            backContent={
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-base-100/70 border border-base-300/60 p-2">
                    <div className="text-xs text-base-content/55">Likes</div>
                    <div className="font-bold text-base-content">{formatNumber(totals?.likes || 0)}</div>
                  </div>
                  <div className="rounded-lg bg-base-100/70 border border-base-300/60 p-2">
                    <div className="text-xs text-base-content/55">Retweets</div>
                    <div className="font-bold text-base-content">{formatNumber(totals?.retweets || 0)}</div>
                  </div>
                  <div className="rounded-lg bg-base-100/70 border border-base-300/60 p-2">
                    <div className="text-xs text-base-content/55">Replies</div>
                    <div className="font-bold text-base-content">{formatNumber(totals?.replies || 0)}</div>
                  </div>
                  <div className="rounded-lg bg-base-100/70 border border-base-300/60 p-2">
                    <div className="text-xs text-base-content/55">Quotes</div>
                    <div className="font-bold text-base-content">{formatNumber(totals?.quotes || 0)}</div>
                  </div>
                </div>
                <div className="pt-1">
                  <StatLine label="Engagement / post">
                    {loadingOverview ? '…' : derived.engagementPerPost.toFixed(2)}
                  </StatLine>
                </div>
              </div>
            }
          />
          <KpiFlipCard
            icon={FaHandshakeSlash}
            accent="danger"
            label="Uncivil posts"
            value={totals?.uncivil || 0}
            loading={loadingOverview}
            format="number"
            tooltip="Number of posts classified as uncivil or inflammatory (toxicity score > 0.5)."
            flipped={flippedKpi === 'uncivil'}
            onToggle={() => setFlippedKpi(prev => (prev === 'uncivil' ? null : 'uncivil'))}
            backContent={
              <div className="space-y-1.5">
                <StatLine label="Uncivil rate">
                  {loadingOverview ? '…' : `${derived.uncivilRate.toFixed(2)}%`}
                </StatLine>
                <StatLine label="Per 1,000 posts">
                  {loadingOverview ? '…' : ((totals?.posts || 0) > 0 ? ((totals?.uncivil || 0) / (totals?.posts || 0) * 1000).toFixed(2) : '0.00')}
                </StatLine>
              </div>
            }
          />
          <KpiFlipCard
            icon={FaExclamationTriangle}
            accent="warning"
            label="Low credibility"
            value={totals?.lowCred || 0}
            loading={loadingOverview}
            format="number"
            tooltip="Number of posts flagged for low credibility based on misinformation detection."
            flipped={flippedKpi === 'lowcred'}
            onToggle={() => setFlippedKpi(prev => (prev === 'lowcred' ? null : 'lowcred'))}
            backContent={
              <div className="space-y-1.5">
                <StatLine label="Low-cred rate">
                  {loadingOverview ? '…' : `${derived.lowCredRate.toFixed(2)}%`}
                </StatLine>
                <StatLine label="Per 1,000 posts">
                  {loadingOverview ? '…' : ((totals?.posts || 0) > 0 ? ((totals?.lowCred || 0) / (totals?.posts || 0) * 1000).toFixed(2) : '0.00')}
                </StatLine>
              </div>
            }
          />
        </div>

        <Section
          title="Party comparison"
          icon={FaGlobe}
          tooltip="Side-by-side comparison of activity, engagement mix, and quality metrics."
        >
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <PartyCard party="Democratic" data={summaryMetrics?.Democratic} loading={loadingOverview} />
            <PartyCard party="Republican" data={summaryMetrics?.Republican} loading={loadingOverview} />
          </div>
        </Section>

        <Section
          title="Legislator metadata"
          icon={FaChartLine}
          tooltip="Computed over active legislators in scope using enriched official metadata. Expand for breakdowns."
          right={
            <div className="text-xs text-base-content/60">
              Active legs:{' '}
              <span className="font-semibold text-base-content">
                {loadingOverview ? <FaSpinner className="animate-spin inline" size={12} /> : formatNumber(metaOverall?.activeLegislators || 0)}
              </span>
            </div>
          }
        >
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiTile
              icon={FaChartLine}
              accent="primary"
              title="Avg vote %"
              hint={metaOverall?.avgVotePct == null ? 'N/A in scope' : 'Across active legislators'}
              value={metaOverall?.avgVotePct ?? 0}
              loading={loadingOverview}
              format="decimal"
              decimals={2}
              suffix="%"
              tooltip="Average vote percentage (vote_pct) across active legislators in scope."
            />
            <KpiTile
              icon={FaChartLine}
              accent="neutral"
              title="Avg ideology"
              hint={metaOverall?.avgMrpIdeology == null ? 'N/A in scope' : 'mrp_ideology'}
              value={metaOverall?.avgMrpIdeology ?? 0}
              loading={loadingOverview}
              format="decimal"
              decimals={2}
              tooltip="Average MRP ideology score (mrp_ideology) across active legislators in scope."
            />
            <KpiTile
              icon={FaChartLine}
              accent="warning"
              title="Avg polarization"
              hint={metaOverall?.avgPolarization == null ? 'N/A in scope' : 'polarization'}
              value={metaOverall?.avgPolarization ?? 0}
              loading={loadingOverview}
              format="decimal"
              decimals={2}
              tooltip="Average polarization score across active legislators in scope."
            />
            <KpiTile
              icon={FaChartLine}
              accent="secondary"
              title="Avg tenure"
              hint={metaOverall?.avgTenureYears == null ? 'N/A in scope' : 'Years in office'}
              value={metaOverall?.avgTenureYears ?? 0}
              loading={loadingOverview}
              format="decimal"
              decimals={2}
              tooltip="Average tenure (years) computed from yr_elected and yr_left_office (or analysis end year if still in office)."
              details={
                <div className="space-y-1">
                  <StatLine label="Median tenure">
                    {metaOverall?.medianTenureYears == null ? 'N/A' : metaOverall.medianTenureYears.toFixed(2)}
                  </StatLine>
                </div>
              }
            />
          </div>

          <details className="mt-4 group">
            <summary className="cursor-pointer select-none text-sm text-base-content/70 hover:text-base-content flex items-center justify-between">
              <span>Breakdowns & distributions</span>
              <span className="text-xs text-base-content/40 group-open:hidden">expand</span>
              <span className="text-xs text-base-content/40 hidden group-open:inline">collapse</span>
            </summary>

            <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-base-content">Gender (active legislators)</div>
                  <div className="text-xs text-base-content/60">
                    {loadingOverview ? <FaSpinner className="animate-spin inline" size={12} /> : `${formatNumber(genderOverall?.total || 0)} total`}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-base-100/70 border border-base-300/60 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-base-content/50">M</div>
                    <div className="mt-1 text-lg font-bold text-base-content">{loadingOverview ? '…' : formatNumber(genderOverall?.M || 0)}</div>
                  </div>
                  <div className="rounded-xl bg-base-100/70 border border-base-300/60 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-base-content/50">F</div>
                    <div className="mt-1 text-lg font-bold text-base-content">{loadingOverview ? '…' : formatNumber(genderOverall?.F || 0)}</div>
                  </div>
                  <div className="rounded-xl bg-base-100/70 border border-base-300/60 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-base-content/50">Unknown</div>
                    <div className="mt-1 text-lg font-bold text-base-content">{loadingOverview ? '…' : formatNumber(genderOverall?.U || 0)}</div>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-sm font-semibold text-base-content mb-2">Party metadata (active legislators)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="bg-base-100/60 rounded-lg p-3">
                    <div className="flex justify-between text-xs text-base-content/60">
                      <span className="font-semibold text-base-content/80">Democratic</span>
                      <span>{loadingOverview ? '…' : formatNumber(metaByParty?.Democratic?.activeLegislators || 0)}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-base-content/60">
                      <span>Avg tenure</span>
                      <span className="font-semibold text-base-content">{loadingOverview ? '…' : (metaByParty?.Democratic?.avgTenureYears == null ? 'N/A' : metaByParty.Democratic.avgTenureYears.toFixed(2))}</span>
                    </div>
                  </div>
                  <div className="bg-base-100/60 rounded-lg p-3">
                    <div className="flex justify-between text-xs text-base-content/60">
                      <span className="font-semibold text-base-content/80">Republican</span>
                      <span>{loadingOverview ? '…' : formatNumber(metaByParty?.Republican?.activeLegislators || 0)}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-base-content/60">
                      <span>Avg tenure</span>
                      <span className="font-semibold text-base-content">{loadingOverview ? '…' : (metaByParty?.Republican?.avgTenureYears == null ? 'N/A' : metaByParty.Republican.avgTenureYears.toFixed(2))}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
              <Card className="p-4">
                <div className="text-sm font-semibold text-base-content mb-3">Top races (active legislators)</div>
                {(() => {
                  const rows = (legislatorMeta?.topRaces || []).slice(0, 6);
                  const total = Math.max(1, metaOverall?.activeLegislators || 0);
                  return rows.length ? (
                    <div className="space-y-2">
                      {rows.map(r => (
                        <div key={r.race} className="flex items-center justify-between gap-3 rounded-xl bg-base-100/60 border border-base-300/50 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-sm text-base-content/80 truncate">{r.race}</div>
                            <div className="text-xs text-base-content/50">
                              {loadingOverview ? '' : `${((r.count || 0) / total * 100).toFixed(1)}%`}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-base-content">
                            {loadingOverview ? '…' : formatNumber(r.count || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-base-content/60">{loadingOverview ? 'Loading…' : 'No race metadata in scope.'}</div>
                  );
                })()}
              </Card>

              <Card className="p-4">
                <div className="text-sm font-semibold text-base-content mb-3">Top office levels (active legislators)</div>
                {(() => {
                  const rows = (legislatorMeta?.topOfficeLevels || []).slice(0, 6);
                  const total = Math.max(1, metaOverall?.activeLegislators || 0);
                  return rows.length ? (
                    <div className="space-y-2">
                      {rows.map(o => (
                        <div key={o.office_level} className="flex items-center justify-between gap-3 rounded-xl bg-base-100/60 border border-base-300/50 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-sm text-base-content/80 truncate">{o.office_level}</div>
                            <div className="text-xs text-base-content/50">
                              {loadingOverview ? '' : `${((o.count || 0) / total * 100).toFixed(1)}%`}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-base-content">
                            {loadingOverview ? '…' : formatNumber(o.count || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-base-content/60">{loadingOverview ? 'Loading…' : 'No office metadata in scope.'}</div>
                  );
                })()}
              </Card>
            </div>
          </details>
        </Section>

        <Section title="Scope" icon={FaCalendarAlt} tooltip="What you’re looking at: date span, topics, and basic integrity stats.">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaCalendarAlt className="text-primary" size={14} />
                <div className="font-semibold text-sm text-base-content">Time window</div>
              </div>
              <div className="text-sm text-base-content/70 space-y-1">
                <div className="flex justify-between"><span>Duration</span><span className="font-semibold text-base-content">{durationDays} days</span></div>
                <div className="flex justify-between"><span>Granularity</span><span className="font-semibold text-base-content">{isWeekly ? 'Weekly' : 'Daily'}</span></div>
                <div className="flex justify-between"><span>Start</span><span className="font-semibold text-base-content">{startDate.format('MMM D, YYYY')}</span></div>
                <div className="flex justify-between"><span>End</span><span className="font-semibold text-base-content">{endDate.format('MMM D, YYYY')}</span></div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaHashtag className="text-primary" size={14} />
                <div className="font-semibold text-sm text-base-content">Topics</div>
              </div>
              <div className="text-sm text-base-content/70 flex justify-between mb-2">
                <span>Selected</span><span className="font-semibold text-base-content">{effectiveTopics.length}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {effectiveTopics.slice(0, 4).map(topic => {
                  const displayName = topicNames[topic] || formatTopicLabel(topic) || topic.charAt(0).toUpperCase() + topic.slice(1);
                  return (
                    <span key={topic} className="px-2 py-1 bg-primary/15 text-primary text-xs rounded-full">
                      {displayName}
                    </span>
                  );
                })}
                {effectiveTopics.length > 4 && (
                  <span className="px-2 py-1 bg-base-300/70 text-base-content/70 text-xs rounded-full">
                    +{effectiveTopics.length - 4} more
                  </span>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaChartLine className="text-primary" size={14} />
                <div className="font-semibold text-sm text-base-content">Integrity</div>
              </div>
              <div className="text-sm text-base-content/70 space-y-1">
                <div className="flex justify-between"><span>Total posts</span><span className="font-semibold text-base-content">{loadingOverview ? '…' : formatNumber(totals?.posts || 0)}</span></div>
                <div className="flex justify-between"><span>Active legislators</span><span className="font-semibold text-base-content">{loadingOverview ? '…' : formatNumber(totals?.legislators || 0)}</span></div>
                <div className="flex justify-between"><span>Total engagement</span><span className="font-semibold text-base-content">{loadingOverview ? '…' : formatNumber(totals?.totalEngagement || 0)}</span></div>
                <div className="flex justify-between"><span>Uncivil posts</span><span className="font-semibold text-red-500">{loadingOverview ? '…' : formatNumber(totals?.uncivil || 0)}</span></div>
              </div>
            </Card>
          </div>
        </Section>

        {/* Call to Action */}
        <div className="text-center">
          <button 
            onClick={() => setLegislator(null)}
            className="btn btn-primary btn-wide"
          >
            <FaExchangeAlt className="mr-2" />
            Explore Interaction Threads
          </button>
        </div>
      </div>
    </div>
  );
}

TimelineContext.propTypes = {
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  selectedTopics: PropTypes.arrayOf(PropTypes.string),
  keyword: PropTypes.string,
  setLegislator: PropTypes.func.isRequired,
  activeTopics: PropTypes.arrayOf(PropTypes.string),
  selectedParty: PropTypes.string
};
