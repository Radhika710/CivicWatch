import { useRef, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import HelpTooltip from './HelpTooltip';
import { formatTopicLabel, topicNames } from '../utils/utils';
import { API_BASE } from '../utils/api';

export default function TopVisualization({
  activeTopics,
  startDate,
  endDate,
  legislator,
  // eslint-disable-next-line no-unused-vars
  keyword,
  selectedParty = 'both'
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [topicsData, setTopicsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipContent, setTooltipContent] = useState(null);
  const tippyInstanceRef = useRef(null);
  const [viewMode, setViewMode] = useState('treemap'); // 'treemap' | 'grid'

  const STATE_GRID = {
    AK: [0, 0],
    WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], WI: [5, 2], MI: [6, 2],
    NY: [8, 2], CT: [9, 2], RI: [10, 2], MA: [11, 2],
    OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IL: [5, 3], IN: [6, 3],
    OH: [7, 3], PA: [8, 3], NJ: [9, 3], DE: [10, 3],
    CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4],
    VA: [7, 4], DC: [8, 4], MD: [9, 4],
    AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], MS: [5, 5], TN: [6, 5], NC: [7, 5],
    OK: [3, 6], LA: [4, 6], AL: [5, 6], GA: [6, 6], SC: [7, 6],
    TX: [3, 7], FL: [7, 7],
    VT: [10, 1], NH: [11, 1], ME: [11, 0],
    HI: [0, 7],
  };
  const GRID_W = 12;
  const GRID_H = 8;

  const overallPartyTotals = useMemo(() => {
    let dem = 0;
    let rep = 0;
    for (const t of topicsData || []) {
      dem += t.democratic || 0;
      rep += t.republican || 0;
    }
    return { dem, rep, total: dem + rep };
  }, [topicsData]);

  // Midpoint normalization for partisan hue:
  // If Dems are more present overall, "neutral" should be that baseline, not 50/50.
  const partisanMidpoint = useMemo(() => {
    return overallPartyTotals.total > 0 ? overallPartyTotals.dem / overallPartyTotals.total : 0.5;
  }, [overallPartyTotals.dem, overallPartyTotals.total]);

  const aggregatedStateParty = useMemo(() => {
    const totals = {};
    for (const t of topicsData || []) {
      const sb = t.statePartyBreakdown || {};
      for (const [state, byParty] of Object.entries(sb)) {
        const d = parseInt(byParty?.Democratic || 0, 10) || 0;
        const r = parseInt(byParty?.Republican || 0, 10) || 0;
        if (!totals[state]) totals[state] = { dem: 0, rep: 0 };
        totals[state].dem += d;
        totals[state].rep += r;
      }
    }
    return totals;
  }, [topicsData]);

  const aggregatedStateTotals = useMemo(() => {
    return Object.fromEntries(
      Object.entries(aggregatedStateParty).map(([st, v]) => [st, (v.dem || 0) + (v.rep || 0)])
    );
  }, [aggregatedStateParty]);

  const gridMax = useMemo(() => {
    return Math.max(1, ...Object.values(aggregatedStateTotals).map(v => v || 0));
  }, [aggregatedStateTotals]);

  // Hue by party mix (R -> purple -> D), centered at partisanMidpoint instead of 0.5
  const partyHue = useMemo(() => {
    return d3
      .scaleLinear()
      .domain([0, partisanMidpoint, 1])
      .range(['#dc3545', '#764ba2', '#2196F3'])
      .clamp(true);
  }, [partisanMidpoint]);

  // Opacity by volume (so low-volume states are still visible, but subtle)
  const intensity = useMemo(() => {
    return d3.scaleSqrt().domain([0, gridMax]).range([0.12, 1]).clamp(true);
  }, [gridMax]);

  // Load topics data from API
  useEffect(() => {
    const controller = new AbortController();
    
    const loadData = async () => {
      if (!activeTopics || activeTopics.length === 0) {
        setLoading(false);
        setTopicsData([]);
        setError(null);
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
        if (selectedParty && selectedParty !== 'both') {
          params.party = selectedParty;
        }
        if (legislator?.legislator_id) {
          params.legislator = legislator.legislator_id;
        }
        if (keyword && keyword.trim()) {
          params.keyword = keyword.trim();
        }

        // Get topic breakdowns for all active topics
        const topicBreakdowns = await Promise.all(
          activeTopics.map(async (topicLabel) => {
            try {
              const topicParams = { ...params, topic: topicLabel };
              const queryString = new URLSearchParams();
              Object.entries(topicParams).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                  value.forEach(v => queryString.append(key, v));
                } else {
                  queryString.append(key, value);
                }
              });
              const res = await fetch(`${API_BASE}/topics/breakdown/?${queryString.toString()}`, {
                signal: controller.signal
              });
              if (!res.ok) {
                console.warn(`Failed to fetch breakdown for topic ${topicLabel}:`, res.status);
                return null;
              }
              const data = await res.json();
              return data;
            } catch (err) {
              if (err.name === 'AbortError') return null; // Ignore aborted requests
              console.error(`Error loading breakdown for topic ${topicLabel}:`, err);
              return null;
            }
          })
        );

        // Skip state update if aborted
        if (controller.signal.aborted) return;

        // Filter out nulls and transform to treemap format
        const topics = topicBreakdowns
          .filter(t => t !== null && t !== undefined)
          .map(topic => {
            const partyBreakdown = topic.party_breakdown || {};
            const democratic = parseInt(partyBreakdown['Democratic'] || 0);
            const republican = parseInt(partyBreakdown['Republican'] || 0);
            const total = democratic + republican;
            
            // Calculate party ratio (0 = 100% Republican, 0.5 = 50/50, 1 = 100% Democratic)
            let ratio = 0.5; // Default to purple (50/50) if no party data
            if (total > 0) {
              ratio = democratic / total;
            }

            // Use post count as the value (size) for the treemap
            const postCount = Object.values(partyBreakdown).reduce((sum, count) => sum + parseInt(count || 0), 0);

            return {
              name: topic.name || topic.topic_label || topic.topic,
              topicLabel: topic.name || topic.topic_label || topic.topic,
              displayName: topicNames[topic.name] || formatTopicLabel(topic.name || topic.topic_label || topic.topic) || topic.name || topic.topic,
              value: postCount, // Use post count for size
              count: postCount,
              topic: topic.topic,
              partyRatio: ratio,
              democratic: democratic,
              republican: republican,
              partyBreakdown: partyBreakdown,
              stateBreakdown: topic.state_breakdown || {},
              statePartyBreakdown: topic.state_party_breakdown || {}
            };
          })
          .filter(d => d.value > 0); // Only show topics with posts

        setTopicsData(topics);
        setError(null);
      } catch (err) {
        if (err.name === 'AbortError') return; // Ignore aborted requests
        console.error('Error loading treemap data:', err);
        setError(err.message);
        setTopicsData([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadData();
    
    return () => controller.abort();
  }, [activeTopics, startDate, endDate, selectedParty, legislator, keyword]);

  // Update dimensions on resize and when container becomes available
  useEffect(() => {
    if (!containerRef.current) {
      // Retry if container isn't ready yet
      const timeout = setTimeout(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setDimensions({ width: rect.width, height: rect.height });
          }
        }
      }, 100);
      return () => clearTimeout(timeout);
    }

    const updateDimensions = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    // Initial measurement with multiple attempts (React timing issue)
    updateDimensions();
    
    // Retry after a short delay to ensure DOM is ready
    const retryTimeout = setTimeout(updateDimensions, 100);
    const retryTimeout2 = setTimeout(updateDimensions, 300);
    
    // Use ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(() => {
      // Debounce dimension updates
      setTimeout(updateDimensions, 50);
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      clearTimeout(retryTimeout);
      clearTimeout(retryTimeout2);
      resizeObserver.disconnect();
    };
  }, [topicsData.length]); // Re-run when data changes to ensure dimensions are set

  // Render treemap
  useEffect(() => {
    if (viewMode !== 'treemap') {
      if (containerRef.current) {
        d3.select(containerRef.current).selectAll('*').remove();
      }
      return;
    }
    // Early returns
    if (loading) {
      if (containerRef.current) {
        d3.select(containerRef.current).selectAll('*').remove();
      }
      return;
    }
    
    if (!topicsData || topicsData.length === 0) {
      if (containerRef.current) {
        d3.select(containerRef.current).selectAll('*').remove();
      }
      return;
    }

    // If dimensions aren't set, try to get them from the container
    if (!dimensions.width || !dimensions.height) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({ width: rect.width, height: rect.height });
          // Return here - will re-run when dimensions are set
          return;
        }
      }
      // If still no dimensions, wait a bit and retry
      const timeout = setTimeout(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setDimensions({ width: rect.width, height: rect.height });
          }
        }
      }, 100);
      return () => clearTimeout(timeout);
    }

    // Clear previous content
    d3.select(containerRef.current).selectAll('*').remove();

    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const width = Math.max(100, dimensions.width - margin.left - margin.right);
    const height = Math.max(100, dimensions.height - margin.top - margin.bottom);

    // Create hierarchy
    const root = d3.hierarchy({ name: 'topics', children: topicsData })
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    d3.treemap()
      .size([width, height])
      .padding(2)
      .round(true)(root);

    // Create SVG
    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Color scale: hue by party mix, centered at partisanMidpoint (baseline Dem share)
    const colorScale = d3.scaleLinear()
      .domain([0, partisanMidpoint, 1])
      .range(['#dc3545', '#764ba2', '#2196F3'])
      .clamp(true);

    // Get leaves (actual topic nodes)
    const leaves = root.leaves();

    // Add rectangles
    const cells = svg.selectAll('g.cell')
      .data(leaves)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    cells.append('rect')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => colorScale(d.data.partyRatio ?? partisanMidpoint))
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        const demPct = (d.data.partyRatio * 100).toFixed(1);
        const repPct = ((1 - d.data.partyRatio) * 100).toFixed(1);
        
        // Create attractive tooltip content
        const content = `
          <div style="padding: 12px; min-width: 200px;">
            <div style="font-weight: 600; font-size: 15px; color: #fff; margin-bottom: 10px; line-height: 1.3;">
              ${d.data.displayName}
            </div>
            <div style="font-size: 13px; color: #e5e7eb; margin-bottom: 8px;">
              <span style="font-weight: 500;">Posts:</span> 
              <span style="color: #fff; font-weight: 600;">${d.data.count.toLocaleString()}</span>
            </div>
            ${d.data.democratic > 0 || d.data.republican > 0 ? `
              <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">
                <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 12px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; margin-right: 8px;"></div>
                  <span style="color: #d1d5db;">Democratic:</span>
                  <span style="color: #fff; font-weight: 600; margin-left: auto;">${d.data.democratic.toLocaleString()}</span>
                  <span style="color: #9ca3af; margin-left: 6px;">(${demPct}%)</span>
                </div>
                <div style="display: flex; align-items: center; font-size: 12px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; margin-right: 8px;"></div>
                  <span style="color: #d1d5db;">Republican:</span>
                  <span style="color: #fff; font-weight: 600; margin-left: auto;">${d.data.republican.toLocaleString()}</span>
                  <span style="color: #9ca3af; margin-left: 6px;">(${repPct}%)</span>
                </div>
              </div>
            ` : ''}
          </div>
        `;
        
        setTooltipContent(content);
        setTooltipVisible(true);
        
        d3.select(this)
          .attr('stroke-width', 3)
          .attr('opacity', 0.9);
      })
      .on('mousemove', function(event) {
        // Update tooltip position to follow cursor
        if (tippyInstanceRef.current) {
          tippyInstanceRef.current.setProps({
            getReferenceClientRect: () => ({
              width: 0,
              height: 0,
              top: event.clientY,
              bottom: event.clientY,
              left: event.clientX,
              right: event.clientX,
            }),
          });
        }
      })
      .on('mouseout', function() {
        setTooltipVisible(false);
        setTooltipContent(null);
        d3.select(this)
          .attr('stroke-width', 2)
          .attr('opacity', 1);
      });

    // Add text labels (only if rectangle is large enough)
    cells.filter(d => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      return w > 60 && h > 30;
    })
      .append('text')
      .attr('x', 5)
      .attr('y', 15)
      .attr('fill', 'white')
      .attr('font-size', d => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        const area = w * h;
        if (area > 10000) return 14;
        if (area > 5000) return 12;
        if (area > 2000) return 10;
        return 8;
      })
      .attr('font-weight', 'bold')
      .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
      .text(d => {
        const name = d.data.displayName;
        const maxLength = Math.floor((d.x1 - d.x0) / 6);
        return name.length > maxLength ? name.substring(0, maxLength - 3) + '...' : name;
      });

    // Cleanup function - capture ref value to avoid stale closure
    const container = containerRef.current;
    return () => {
      if (container) {
        d3.select(container).selectAll('*').remove();
      }
    };
  }, [dimensions.width, dimensions.height, topicsData, loading, viewMode, partisanMidpoint]);

  const gridCellSize = useRef(0);
  const computedCellSize = (() => {
    const w = dimensions.width || 0;
    const h = dimensions.height || 0;
    if (!w || !h) return 0;
    // Leave a little padding around the grid
    const padding = 16;
    const maxW = Math.max(0, w - padding * 2);
    const maxH = Math.max(0, h - padding * 2);
    const cell = Math.floor(Math.min(maxW / GRID_W, maxH / GRID_H));
    return Math.max(10, cell);
  })();
  gridCellSize.current = computedCellSize;

  // Loading state
  if (loading) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-2 z-10">
          <HelpTooltip
            content={
              <div className="text-left">
                <p>Visualization of selected topics by engagement and party distribution.</p>
                <p className="mt-2"><strong>Size:</strong> Proportional to number of posts</p>
                <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
              </div>
            }
            placement="left"
          />
        </div>
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-lg">Loading topic data...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-2 z-10">
          <HelpTooltip
            content={
              <div className="text-left">
                <p>Visualization of selected topics by engagement and party distribution.</p>
                <p className="mt-2"><strong>Size:</strong> Proportional to number of posts</p>
                <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
              </div>
            }
            placement="left"
          />
        </div>
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-center">
            <div className="text-red-500 mb-2">Error loading data</div>
            <div className="text-sm text-gray-500">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // No topics selected
  if (!activeTopics || activeTopics.length === 0) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-2 z-10">
          <HelpTooltip
            content={
              <div className="text-left">
                <p>Visualization of selected topics by engagement and party distribution.</p>
                <p className="mt-2"><strong>Size:</strong> Proportional to number of posts</p>
                <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
              </div>
            }
            placement="left"
          />
        </div>
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-lg text-gray-500">Select topics in the sidebar to view treemap</div>
        </div>
      </div>
    );
  }

  // No data available
  if (topicsData.length === 0) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-2 z-10">
          <HelpTooltip
            content={
              <div className="text-left">
                <p>Visualization of selected topics by engagement and party distribution.</p>
                <p className="mt-2"><strong>Size:</strong> Proportional to number of posts</p>
                <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
              </div>
            }
            placement="left"
          />
        </div>
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-lg text-gray-500">No data available for selected topics</div>
        </div>
      </div>
    );
  }

  // Render treemap
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* View toggle (discrete) */}
      <div className="absolute top-3 left-3 z-30">
        <div className="join shadow-sm border border-base-300 bg-base-100/80 backdrop-blur rounded-full overflow-hidden">
          <button
            className={`join-item btn btn-xs ${viewMode === 'treemap' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('treemap')}
            type="button"
          >
            Treemap
          </button>
          <button
            className={`join-item btn btn-xs ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('grid')}
            type="button"
          >
            Map
          </button>
        </div>
      </div>

      {/* Help icon - floating top right */}
      <div className="absolute top-3 right-3 z-30">
        <HelpTooltip
          content={
            <div className="text-left">
              <p>Treemap: size = post count, hue = party mix (midpoint normalized).</p>
              <p className="mt-2">Map: grid heatmap by state; hue = party mix, intensity = volume.</p>
              <div className="mt-3 pt-3 border-t border-gray-300">
                <p className="font-semibold mb-2">Legend:</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-4 rounded overflow-hidden shadow-sm border border-gray-300">
                      <div className="w-3" style={{ backgroundColor: '#dc3545' }}></div>
                      <div className="w-3" style={{ backgroundColor: '#764ba2' }}></div>
                      <div className="w-3" style={{ backgroundColor: '#2196F3' }}></div>
                    </div>
                    <span className="text-sm">Hue: Red = Republican, Blue = Democratic, Purple = midpoint</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded"></div>
                      <div className="w-3 h-3 bg-gray-400 rounded"></div>
                      <div className="w-4 h-4 bg-gray-400 rounded"></div>
                    </div>
                    <span className="text-sm">Size = Number of posts</span>
                  </div>
                </div>
              </div>
            </div>
          }
          placement="left"
        />
      </div>

      {viewMode === 'treemap' ? (
        <>
          {/* Tippy tooltip that follows cursor */}
          <Tippy
            content={<div dangerouslySetInnerHTML={{ __html: tooltipContent || '' }} />}
            visible={tooltipVisible && !!tooltipContent}
            followCursor="initial"
            placement="top"
            animation="scale-subtle"
            duration={[150, 100]}
            delay={[0, 0]}
            arrow={true}
            interactive={false}
            appendTo={() => document.body}
            onMount={(instance) => {
              tippyInstanceRef.current = instance;
            }}
            popperOptions={{
              modifiers: [
                {
                  name: 'offset',
                  options: {
                    offset: [0, 10],
                  },
                },
              ],
            }}
            theme="custom-treemap"
          >
            <div style={{ position: 'absolute', pointerEvents: 'none', width: 0, height: 0, top: 0, left: 0 }} />
          </Tippy>

          {/* Treemap container - full space */}
          <div ref={containerRef} className="w-full h-full" />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div
            className="relative"
            style={{
              width: gridCellSize.current ? gridCellSize.current * GRID_W : 0,
              height: gridCellSize.current ? gridCellSize.current * GRID_H : 0,
            }}
          >
            {Object.entries(STATE_GRID).map(([st, [x, y]]) => {
              const dem = aggregatedStateParty[st]?.dem || 0;
              const rep = aggregatedStateParty[st]?.rep || 0;
              const total = dem + rep;
              const ratio = total > 0 ? dem / total : null;
              const v = aggregatedStateTotals[st] || 0;

              const base = ratio === null ? 'rgba(255,255,255,0.10)' : partyHue(ratio);
              const bg =
                ratio === null
                  ? 'rgba(255,255,255,0.06)'
                  : d3.color(base).copy({ opacity: intensity(v) }).toString();
              const border = v > 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)';
              return (
                <Tippy
                  key={st}
                  content={
                    <div className="text-sm">
                      <div className="font-semibold">{st}</div>
                      <div>
                        Posts: <span className="font-semibold">{v.toLocaleString()}</span>
                      </div>
                      {total > 0 ? (
                        <div className="mt-1 text-xs text-base-content/70">
                          <div>
                            Dem: <span className="font-semibold">{dem.toLocaleString()}</span>
                          </div>
                          <div>
                            Rep: <span className="font-semibold">{rep.toLocaleString()}</span>
                          </div>
                          <div>
                            Dem share:{' '}
                            <span className="font-semibold">{((dem / total) * 100).toFixed(1)}%</span>
                            <span className="opacity-70"> (mid: {(partisanMidpoint * 100).toFixed(1)}%)</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-base-content/60">No party-coded data</div>
                      )}
                    </div>
                  }
                  placement="top"
                  delay={[80, 0]}
                >
                  <div
                    className="absolute rounded-md flex items-center justify-center text-[10px] font-semibold select-none"
                    style={{
                      left: x * gridCellSize.current,
                      top: y * gridCellSize.current,
                      width: gridCellSize.current,
                      height: gridCellSize.current,
                      background: bg,
                      border: `1px solid ${border}`,
                      color: v > 0 ? '#fff' : 'rgba(255,255,255,0.55)',
                      boxShadow: v > 0 ? '0 1px 6px rgba(0,0,0,0.18)' : 'none',
                    }}
                  >
                    {st}
                  </div>
                </Tippy>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

TopVisualization.propTypes = {
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  legislator: PropTypes.object,
  keyword: PropTypes.string,
  selectedParty: PropTypes.string
};
