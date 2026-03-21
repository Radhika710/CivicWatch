import { useRef, useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-dayjs-4';
import { Line } from 'react-chartjs-2';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { FaSpinner, FaChartLine } from 'react-icons/fa';
import { formatNumber, getTopicColor, topicNames, formatTopicLabel } from '../utils/utils';
import detectEvents from './detectEvents';
import SectionTitle from './SectionTitle';
import { API_BASE } from '../utils/api';

// Extend dayjs with comparison plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

// Loading indicator
const Loading = () => (
  <div className="flex flex-col items-center justify-center h-full">
    <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
    <p className="text-lg">Loading engagement timeline data...</p>
  </div>
);

// Error banner
const ErrorBanner = ({ message }) => (
  <div className="alert alert-error shadow-lg">
    <div className="flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="ml-2">{message}</span>
    </div>
  </div>
);

ErrorBanner.propTypes = {
  message: PropTypes.string.isRequired
};

// Removed variable line width plugin - using uniform thickness for simplicity and performance

// Plugin to draw vertical lines - will access state via closure
let getVerticalLinesState = () => ({});
const setVerticalLinesStateGetter = (getter) => {
  getVerticalLinesState = getter;
};

// Plugin to force crosshair cursor and prevent context menu
const cursorAndContextMenuPlugin = {
  id: 'cursorAndContextMenu',
  beforeInit: (chart) => {
    const canvas = chart.canvas;
    if (canvas) {
      canvas.style.cursor = 'crosshair';
      canvas.style.setProperty('cursor', 'crosshair', 'important');
    }
  },
  afterInit: (chart) => {
    const canvas = chart.canvas;
    const container = canvas?.parentElement;
    
    if (canvas) {
      canvas.style.cursor = 'crosshair';
      canvas.style.setProperty('cursor', 'crosshair', 'important');
      
      // Prevent context menu
      const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      };
      canvas.addEventListener('contextmenu', handleContextMenu, { capture: true, passive: false });
    }
    
    if (container) {
      container.style.cursor = 'crosshair';
      container.style.setProperty('cursor', 'crosshair', 'important');
    }
  },
  afterUpdate: (chart) => {
    const canvas = chart.canvas;
    const container = canvas?.parentElement;
    
    if (canvas) {
      canvas.style.setProperty('cursor', 'crosshair', 'important');
    }
    if (container) {
      container.style.setProperty('cursor', 'crosshair', 'important');
    }
  }
};

const verticalLinesPlugin = {
  id: 'verticalLines',
  afterDraw: (chart) => {
    const ctx = chart.ctx;
    const xScale = chart.scales.x;
    const chartArea = chart.chartArea;
    
    if (!xScale || !chartArea) return;
    
    const state = getVerticalLinesState();
    if (!state) {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.01) {
        console.log('[PLUGIN] No state available');
      }
      return;
    }
    
    // Log state when dragging (throttled to avoid spam)
    if (state.isDragging && Math.random() < 0.05) {
      console.log('[PLUGIN] Drawing with drag state', {
        isDragging: state.isDragging,
        dragStartDate: state.dragStartDate,
        dragEndDate: state.dragEndDate,
        hasStartDate: !!state.dragStartDate,
        hasEndDate: !!state.dragEndDate
      });
    }
    
    ctx.save();
    
    // Draw selected date range background (highlight between green and red lines when dragging)
    if (state.isDragging && state.dragStartDate && state.dragEndDate) {
      const startX = xScale.getPixelForValue(state.dragStartDate);
      const endX = xScale.getPixelForValue(state.dragEndDate);
      
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      
      if (maxX >= chartArea.left && minX <= chartArea.right) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(
          Math.max(minX, chartArea.left),
          chartArea.top,
          Math.min(maxX, chartArea.right) - Math.max(minX, chartArea.left),
          chartArea.bottom - chartArea.top
        );
      }
    }
    
    // Also highlight selected range after drag completes
    if (state.selectedStart && state.selectedEnd) {
      const startX = xScale.getPixelForValue(state.selectedStart);
      const endX = xScale.getPixelForValue(state.selectedEnd);
      
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      
      if (maxX >= chartArea.left && minX <= chartArea.right) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(
          Math.max(minX, chartArea.left),
          chartArea.top,
          Math.min(maxX, chartArea.right) - Math.max(minX, chartArea.left),
          chartArea.bottom - chartArea.top
        );
      }
    }
    
    // Draw vertical lines
    // Priority: If dragging, show green (click point) and red (current position)
    // Otherwise, show blue dashed (hover)
    const lines = [];
    
    if (state.isDragging) {
      // While dragging: green line at click point, red line at current position
      if (state.dragStartDate) {
        lines.push({ date: state.dragStartDate, color: 'rgba(34, 197, 94, 1)', width: 2, dash: [] });
      } else if (Math.random() < 0.01) {
        console.warn('[PLUGIN] WARNING: isDragging=true but no dragStartDate!');
      }
      if (state.dragEndDate) {
        lines.push({ date: state.dragEndDate, color: 'rgba(239, 68, 68, 1)', width: 2, dash: [] });
      }
    } else {
      // Not dragging: show blue dashed hover line
      if (state.hoverDate) {
        lines.push({ date: state.hoverDate, color: 'rgba(59, 130, 246, 0.8)', width: 2, dash: [5, 5] });
      }
    }
    
    // Always show start/end date lines from props
    if (state.startDate) {
      lines.push({ date: state.startDate, color: 'rgba(34, 197, 94, 0.5)', width: 1, dash: [] });
    }
    if (state.endDate) {
      lines.push({ date: state.endDate, color: 'rgba(239, 68, 68, 0.5)', width: 1, dash: [] });
    }
    
    lines.forEach(line => {
      if (!line.date) return;
      
      try {
        const x = xScale.getPixelForValue(line.date);
        if (isNaN(x) || x < chartArea.left || x > chartArea.right) return;
        
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.width;
        ctx.setLineDash(line.dash);
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      } catch {
        // Skip invalid dates
      }
    });
    
    ctx.setLineDash([]);
    ctx.restore();
  }
};

export default function EngagementTimeline({ 
  activeTopics, 
  startDate, 
  endDate, 
  onDateChange,
  selectedParty = 'both',
  legislator,
  keyword
}) {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoverDate, setHoverDate] = useState(null);
  const [dragStartDate, setDragStartDate] = useState(null);
  const [dragEndDate, setDragEndDate] = useState(null);
  const [, setEvents] = useState([]); // Reserved for future event detection
  const [selectedDateRange, setSelectedDateRange] = useState({ start: null, end: null });
  const [zoomState, setZoomState] = useState(null); // Track zoom state for reset
  
  // Store vertical lines state in a ref to avoid re-renders
  const verticalLinesStateRef = useRef({
    hoverDate: null,
    startDate: null,
    endDate: null,
    isDragging: false,
    dragStartDate: null,
    dragEndDate: null,
    selectedStart: null,
    selectedEnd: null
  });
  
  // Track last hover date to prevent unnecessary updates
  const lastHoverDateRef = useRef(null);
  
  // Track if we're in scrubbing mode (to prevent zoom during drag)
  const isScrubbingRef = useRef(false);
  
  // Refs to capture drag dates for mouseup handler
  const dragStartDateRef = useRef(null);
  const dragEndDateRef = useRef(null);
  
  // Ref to track pending animation frame for mouse move throttling
  const mouseMoveRafRef = useRef(null);
  
  // Ref to track if event listeners are already set up
  const listenersSetupRef = useRef(false);
  
  // Ref to track if component is unmounting
  const isUnmountingRef = useRef(false);
  
  // Ref to store cleanup function
  const listenersCleanupRef = useRef(null);
  
  // Store onDateChange in a ref to prevent effect re-runs
  const onDateChangeRef = useRef(onDateChange);
  
  // Update ref when onDateChange changes
  useEffect(() => {
    onDateChangeRef.current = onDateChange;
  }, [onDateChange]);
  
  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (listenersCleanupRef.current) {
        console.log('[UNMOUNT] Cleaning up event listeners');
        listenersCleanupRef.current();
        listenersCleanupRef.current = null;
      }
    };
  }, []);

  // Load engagement timeline data from API
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Build query params
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
        if (selectedParty && selectedParty !== 'both') {
          params.party = selectedParty;
        }
        if (legislator?.legislator_id) {
          params.legislator = legislator.legislator_id;
        }
        if (keyword && keyword.trim()) {
          params.keyword = keyword.trim();
        }

        const queryString = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach(v => queryString.append(key, v));
          } else {
            queryString.append(key, value);
          }
        });

        const res = await fetch(`${API_BASE}/engagement/timeline/?${queryString.toString()}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const allData = await res.json();
        setData(allData);
        setError('');
      } catch (err) {
        console.error('Error loading engagement timeline data:', err);
        setError('Failed to load engagement timeline data. Please try again.');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [startDate, endDate, activeTopics, selectedParty, legislator, keyword]);

  // Use only the activeTopics that exist in the data
  const effectiveTopics = useMemo(() => {
    if (!data.length) return [];
    
    if (!activeTopics || activeTopics.length === 0) {
      return [];
    }
    
    const matchingTopics = activeTopics.filter(topic => {
      return data.some(day => Object.prototype.hasOwnProperty.call(day, topic));
    });
    
    return matchingTopics;
  }, [activeTopics, data]);

  // Sort topics by total engagement
  const sortedTopics = useMemo(() => {
    if (!data.length || !effectiveTopics.length) return [];
    
    return [...effectiveTopics]
      .map(topic => {
        const total = data.reduce((sum, item) => sum + (item[topic] || 0), 0);
        return { topic, total };
      })
      .filter(t => t.total > 0)
      .sort((a, b) => a.total - b.total)
      .map(t => t.topic);
  }, [effectiveTopics, data]);

  // Filter data by date range (client-side filtering)
  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data) || !data.length) return [];
    
    const start = startDate ? dayjs(startDate).format('YYYY-MM-DD') : null;
    const end = endDate ? dayjs(endDate).format('YYYY-MM-DD') : null;
    
    return data.filter(item => {
      if (!item || !item.date) return false;
      const itemDate = item.date;
      if (start && itemDate < start) return false;
      if (end && itemDate > end) return false;
      return true;
    });
  }, [data, startDate, endDate]);

  // Compute dynamic spike events asynchronously for performance
  useEffect(() => {
    if (!filteredData.length || !effectiveTopics || effectiveTopics.length === 0) {
      setEvents([]);
      return;
    }

    const computeAsync = () => {
      const result = detectEvents({ filteredData, activeTopics: effectiveTopics });
      setEvents(result);
    };

    const id = setTimeout(computeAsync, 0);
    return () => clearTimeout(id);
  }, [filteredData, effectiveTopics]);

  // Set up vertical lines state getter
  useEffect(() => {
    setVerticalLinesStateGetter(() => verticalLinesStateRef.current);
  }, []);

  // Track if we're currently dragging
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  
  // Use ref for hover date to avoid infinite loops
  const hoverDateRef = useRef(null);
  
  // Update vertical lines state when props/state change (but don't update during active dragging)
  useEffect(() => {
    // Don't update state ref during active dragging - let handlers manage it directly
    if (isDraggingRef.current) {
      console.log('[STATE EFFECT] Skipping update - currently dragging');
      return;
    }
    
    const newState = {
      hoverDate: (!isDragging && hoverDateRef.current) ? hoverDateRef.current.toDate() : null,
      startDate: startDate ? dayjs(startDate).toDate() : null,
      endDate: endDate ? dayjs(endDate).toDate() : null,
      isDragging: isDragging,
      dragStartDate: (isDragging && dragStartDate) ? dragStartDate.toDate() : null,
      dragEndDate: (isDragging && dragEndDate) ? dragEndDate.toDate() : null,
      selectedStart: selectedDateRange.start ? selectedDateRange.start.toDate() : null,
      selectedEnd: selectedDateRange.end ? selectedDateRange.end.toDate() : null
    };
    
    // Only update if state actually changed
    const currentState = verticalLinesStateRef.current;
    const stateChanged = 
      (newState.hoverDate?.getTime() !== currentState.hoverDate?.getTime()) ||
      (newState.startDate?.getTime() !== currentState.startDate?.getTime()) ||
      (newState.endDate?.getTime() !== currentState.endDate?.getTime()) ||
      (newState.isDragging !== currentState.isDragging) ||
      (newState.dragStartDate?.getTime() !== currentState.dragStartDate?.getTime()) ||
      (newState.dragEndDate?.getTime() !== currentState.dragEndDate?.getTime()) ||
      (newState.selectedStart?.getTime() !== currentState.selectedStart?.getTime()) ||
      (newState.selectedEnd?.getTime() !== currentState.selectedEnd?.getTime());
    
    if (stateChanged) {
      console.log('[STATE EFFECT] Updating state', { isDragging: newState.isDragging, hasDragStart: !!newState.dragStartDate });
      verticalLinesStateRef.current = newState;
      
      // Only update chart if not dragging (handlers will update during drag)
      // Also check that chart is still mounted and has a valid canvas
      if (!isDragging && chartInstanceRef.current && chartInstanceRef.current.canvas) {
        requestAnimationFrame(() => {
          // Double-check chart is still valid before updating
          if (chartInstanceRef.current && chartInstanceRef.current.canvas && !isDraggingRef.current) {
            try {
              chartInstanceRef.current.update('none');
            } catch (err) {
              console.warn('[STATE EFFECT] Chart update failed (chart may be unmounting):', err);
            }
          }
        });
      }
    }
  }, [startDate, endDate, isDragging, dragStartDate, dragEndDate, selectedDateRange]);
  
  // Update isDragging ref when state changes (no chart update - handlers manage that)
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);
  
  // Separate effect to update hover date ref (doesn't trigger chart updates)
  useEffect(() => {
    hoverDateRef.current = hoverDate;
    // Update vertical lines state ref directly without triggering chart update
    if (verticalLinesStateRef.current) {
      verticalLinesStateRef.current.hoverDate = (!isDraggingRef.current && hoverDate) ? hoverDate.toDate() : null;
      // Only update chart if not dragging (to avoid loops) and chart is valid
      if (!isDraggingRef.current && chartInstanceRef.current && chartInstanceRef.current.canvas && chartInstanceRef.current.canvas.ownerDocument) {
        try {
          chartInstanceRef.current.update('none');
        } catch (err) {
          console.warn('[HOVER EFFECT] Chart update failed:', err);
        }
      }
    }
  }, [hoverDate]);

  // Effect to set cursor when chart is ready (runs after chart renders)
  useEffect(() => {
    if (!filteredData.length) return;
    
    const updateCursor = () => {
      if (!chartInstanceRef.current) return;
      
      const canvas = chartInstanceRef.current.canvas;
      const container = canvas?.parentElement;
      
      if (canvas) {
        // Force override any Chart.js cursor styles
        canvas.style.setProperty('cursor', 'crosshair', 'important');
        canvas.style.pointerEvents = 'auto';
      }
      if (container) {
        container.style.setProperty('cursor', 'crosshair', 'important');
      }
    };
    
    // Run immediately and also after delays to catch Chart.js updates
    updateCursor();
    const timeoutId = setTimeout(updateCursor, 50);
    const timeoutId2 = setTimeout(updateCursor, 200);
    const timeoutId3 = setTimeout(updateCursor, 500);
    
    // Also set up an interval to keep checking (Chart.js might override it)
    const intervalId = setInterval(updateCursor, 1000);
    
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      clearInterval(intervalId);
    };
  }, [filteredData]);

  // Scrubbing (drag to select date range) - set up event listeners when chart is ready
  useEffect(() => {
    // If listeners are already set up, skip
    if (listenersSetupRef.current) {
      return;
    }
    
    const container = chartRef.current?.canvas?.parentElement;
    const canvas = chartRef.current?.canvas;
    if (!container || !canvas || !chartInstanceRef.current) {
      // Chart not ready yet - will retry when effect runs again
      return;
    }
    
    console.log('[SCRUBBING EFFECT] Setting up event listeners');
    const chart = chartInstanceRef.current;
    
    // Set crosshair cursor on the container and canvas (force it)
    container.style.cursor = 'crosshair';
    canvas.style.cursor = 'crosshair';
    canvas.style.pointerEvents = 'auto';
    
    const handleMouseDown = (e) => {
      console.log('[MOUSE DOWN] Event received', { button: e.button, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey });
      
      // Only start scrubbing on left click, no modifier keys
      if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) {
        console.log('[MOUSE DOWN] Rejected - wrong button or modifier keys');
        return;
      }
      
      // Get mouse position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Check if click is within chart area
      const chartArea = chart.chartArea;
      console.log('[MOUSE DOWN] Position check', { x, y, chartArea });
      if (x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) {
        console.log('[MOUSE DOWN] Rejected - outside chart area');
        return;
      }
      
      // Prevent default
      e.preventDefault();
      e.stopPropagation();
      
      // Get date at mouse position
      const xScale = chart.scales.x;
      let dateValue = xScale.getValueForPixel(x);
      console.log('[MOUSE DOWN] Date value', { dateValue, type: typeof dateValue });
      
      // Handle both Date objects and timestamps (numbers)
      if (typeof dateValue === 'number') {
        dateValue = new Date(dateValue);
      }
      
      if (dateValue && dateValue instanceof Date && !isNaN(dateValue.getTime())) {
        const clickedDate = dayjs(dateValue);
        console.log('[MOUSE DOWN] Starting drag at', clickedDate.format('YYYY-MM-DD'));
        
        // Clear hover date when starting drag (so blue line disappears)
        setHoverDate(null);
        hoverDateRef.current = null;
        
        // Start dragging
        setIsDragging(true);
        setDragStartDate(clickedDate);
        setDragEndDate(clickedDate);
        dragStartDateRef.current = clickedDate;
        dragEndDateRef.current = clickedDate;
        isScrubbingRef.current = true;
        isDraggingRef.current = true;
        
        console.log('[MOUSE DOWN] State set', { 
          isDragging: true, 
          dragStartDate: clickedDate.format('YYYY-MM-DD'),
          hasVerticalLinesRef: !!verticalLinesStateRef.current
        });
        
        // Immediately update vertical lines state ref so plugin can read it
        if (verticalLinesStateRef.current) {
          verticalLinesStateRef.current.isDragging = true;
          verticalLinesStateRef.current.dragStartDate = clickedDate.toDate();
          verticalLinesStateRef.current.dragEndDate = clickedDate.toDate();
          verticalLinesStateRef.current.hoverDate = null;
          console.log('[MOUSE DOWN] Vertical lines state updated', {
            isDragging: verticalLinesStateRef.current.isDragging,
            dragStartDate: verticalLinesStateRef.current.dragStartDate,
            dragEndDate: verticalLinesStateRef.current.dragEndDate
          });
        } else {
          console.error('[MOUSE DOWN] ERROR: verticalLinesStateRef.current is null!');
        }
        
        // Force chart update to show green line
        if (chartInstanceRef.current && chartInstanceRef.current.canvas) {
          console.log('[MOUSE DOWN] Updating chart');
          try {
            // Update immediately, then also in next frame to ensure it renders
            chartInstanceRef.current.update('none');
            requestAnimationFrame(() => {
              if (chartInstanceRef.current && chartInstanceRef.current.canvas && isDraggingRef.current) {
                console.log('[MOUSE DOWN] Second chart update in RAF');
                try {
                  chartInstanceRef.current.update('none');
                } catch (err) {
                  console.warn('[MOUSE DOWN] RAF chart update failed:', err);
                }
              }
            });
          } catch (err) {
            console.warn('[MOUSE DOWN] Chart update failed:', err);
          }
        } else {
          console.error('[MOUSE DOWN] ERROR: chartInstanceRef.current is null or invalid!');
        }
      } else {
        console.log('[MOUSE DOWN] Rejected - invalid date value');
      }
    };
    
    // Throttle mouse move updates to prevent lag
    const handleMouseMove = (e) => {
      // Use ref to check current dragging state (avoid stale closure)
      if (!isDraggingRef.current) {
        // Only log occasionally to avoid spam
        if (Math.random() < 0.01) {
          console.log('[MOUSE MOVE] Not dragging, skipping');
        }
        return;
      }
      
      if (!chartInstanceRef.current) {
        console.error('[MOUSE MOVE] ERROR: chartInstanceRef.current is null!');
        return;
      }
      
      // Prevent default
      e.preventDefault();
      e.stopPropagation();
      
      // Cancel any pending animation frame
      if (mouseMoveRafRef.current !== null) {
        cancelAnimationFrame(mouseMoveRafRef.current);
      }
      
      // Get mouse position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      
      // Get date at mouse position
      const xScale = chartInstanceRef.current.scales.x;
      let dateValue = xScale.getValueForPixel(x);
      
      // Handle both Date objects and timestamps (numbers)
      if (typeof dateValue === 'number') {
        dateValue = new Date(dateValue);
      }
      
      if (dateValue && dateValue instanceof Date && !isNaN(dateValue.getTime())) {
        const currentDate = dayjs(dateValue);
        dragEndDateRef.current = currentDate;
        
        // Immediately update vertical lines state ref so plugin can read it
        if (verticalLinesStateRef.current) {
          verticalLinesStateRef.current.dragEndDate = currentDate.toDate();
          // Log occasionally during drag
          if (Math.random() < 0.1) {
            console.log('[MOUSE MOVE] Dragging - updated end date', {
              dragEndDate: currentDate.format('YYYY-MM-DD'),
              isDragging: verticalLinesStateRef.current.isDragging
            });
          }
        } else {
          console.error('[MOUSE MOVE] ERROR: verticalLinesStateRef.current is null!');
        }
        
        // Throttle state update and chart update to one per frame
        mouseMoveRafRef.current = requestAnimationFrame(() => {
          mouseMoveRafRef.current = null;
          if (!isDraggingRef.current || !chartInstanceRef.current) return;
          
          setDragEndDate(dragEndDateRef.current);
          
          // Force chart update to show red line and highlight
          if (chartInstanceRef.current && chartInstanceRef.current.canvas) {
            try {
              chartInstanceRef.current.update('none');
            } catch (err) {
              console.warn('[MOUSE MOVE] Chart update failed:', err);
            }
          }
        });
      }
    };
    
    const handleMouseUp = (e) => {
      console.log('[MOUSE UP] Event received', { button: e.button, isDragging: isDraggingRef.current });
      // Use ref to check current dragging state (avoid stale closure)
      if (!isDraggingRef.current) {
        console.log('[MOUSE UP] Not dragging, skipping');
        return;
      }
      
      // Only complete on left click
      if (e.button !== 0) {
        setIsDragging(false);
        setDragStartDate(null);
        setDragEndDate(null);
        dragStartDateRef.current = null;
        dragEndDateRef.current = null;
        isScrubbingRef.current = false;
        isDraggingRef.current = false; // Ensure ref is updated immediately
        // Clear vertical lines state ref immediately
        if (verticalLinesStateRef.current) {
          verticalLinesStateRef.current.isDragging = false;
          verticalLinesStateRef.current.dragStartDate = null;
          verticalLinesStateRef.current.dragEndDate = null;
        }
        if (chartInstanceRef.current && chartInstanceRef.current.canvas) {
          try {
            chartInstanceRef.current.update('none');
          } catch (err) {
            console.warn('[MOUSE UP] Chart update failed (non-left button):', err);
          }
        }
        return;
      }
      
      // Get current drag dates from refs (always up-to-date)
      const start = dragStartDateRef.current;
      const end = dragEndDateRef.current;
      
      if (start && end) {
        const finalStart = start.isBefore(end) ? start : end;
        const finalEnd = start.isBefore(end) ? end : start;
        
        // Set selected range
        setSelectedDateRange({ start: finalStart, end: finalEnd });
        
        // Call onDateChange to update Sidebar and rest of interface
        if (onDateChangeRef.current) {
          onDateChangeRef.current(finalStart, finalEnd);
        }
      }
      
      // Reset drag state
      setIsDragging(false);
      setDragStartDate(null);
      setDragEndDate(null);
      dragStartDateRef.current = null;
      dragEndDateRef.current = null;
      isScrubbingRef.current = false;
      isDraggingRef.current = false; // Ensure ref is updated immediately
      
      // Clear vertical lines state ref immediately
      if (verticalLinesStateRef.current) {
        verticalLinesStateRef.current.isDragging = false;
        verticalLinesStateRef.current.dragStartDate = null;
        verticalLinesStateRef.current.dragEndDate = null;
      }
      
      console.log('[MOUSE UP] Drag state reset', { isDragging: isDraggingRef.current });
      
      // Update chart (with safety checks)
      if (chartInstanceRef.current && chartInstanceRef.current.canvas) {
        try {
          chartInstanceRef.current.update('none');
        } catch (err) {
          console.warn('[MOUSE UP] Chart update failed:', err);
        }
      }
    };
    
    const handleMouseLeave = () => {
      // Use ref to check current dragging state (avoid stale closure)
      if (isDraggingRef.current) {
        setIsDragging(false);
        setDragStartDate(null);
        setDragEndDate(null);
        dragStartDateRef.current = null;
        dragEndDateRef.current = null;
        isScrubbingRef.current = false;
        isDraggingRef.current = false; // Ensure ref is updated immediately
        // Clear vertical lines state ref immediately
        if (verticalLinesStateRef.current) {
          verticalLinesStateRef.current.isDragging = false;
          verticalLinesStateRef.current.dragStartDate = null;
          verticalLinesStateRef.current.dragEndDate = null;
        }
        if (chartInstanceRef.current && chartInstanceRef.current.canvas) {
          try {
            chartInstanceRef.current.update('none');
          } catch (err) {
            console.warn('[MOUSE LEAVE] Chart update failed:', err);
          }
        }
      }
    };
    
    const handleContextMenu = (e) => {
      // Prevent context menu
      e.preventDefault();
      e.stopPropagation();
      
      // Reset everything
      setIsDragging(false);
      setDragStartDate(null);
      setDragEndDate(null);
      dragStartDateRef.current = null;
      dragEndDateRef.current = null;
      setSelectedDateRange({ start: null, end: null });
      isScrubbingRef.current = false;
      isDraggingRef.current = false; // Ensure ref is updated immediately
      
      // Clear vertical lines state ref immediately
      if (verticalLinesStateRef.current) {
        verticalLinesStateRef.current.isDragging = false;
        verticalLinesStateRef.current.dragStartDate = null;
        verticalLinesStateRef.current.dragEndDate = null;
        verticalLinesStateRef.current.selectedStart = null;
        verticalLinesStateRef.current.selectedEnd = null;
      }
      
      // Reset zoom
      if (chartInstanceRef.current && chartInstanceRef.current.canvas) {
        try {
          chartInstanceRef.current.resetZoom();
          setZoomState(null);
          chartInstanceRef.current.update('none');
        } catch (err) {
          console.warn('[CONTEXT MENU] Chart reset/update failed:', err);
        }
      }
      
      // Reset dates to defaults (same as Reset button)
      if (onDateChangeRef.current) {
        const defaultStart = dayjs('2020-01-01');
        const defaultEnd = dayjs('2021-12-31');
        onDateChangeRef.current(defaultStart, defaultEnd);
      }
      
      console.log('[CONTEXT MENU] Everything reset', { isDragging: isDraggingRef.current });
      
      return false;
    };
    
    // Add event listeners - use capture phase for mousedown to intercept before Chart.js
    console.log('[SCRUBBING EFFECT] Attaching event listeners');
    canvas.addEventListener('mousedown', handleMouseDown, { passive: false, capture: true });
    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp, { passive: false });
    container.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('contextmenu', handleContextMenu, { passive: false, capture: true });
    container.addEventListener('contextmenu', handleContextMenu, { passive: false, capture: true });
    
    // Also prevent context menu on document level when clicking on chart area
    const handleDocumentContextMenu = (e) => {
      if (container && container.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        handleContextMenu(e);
        return false;
      }
    };
    document.addEventListener('contextmenu', handleDocumentContextMenu, { passive: false, capture: true });
    
    console.log('[SCRUBBING EFFECT] Event listeners attached successfully');
    listenersSetupRef.current = true; // Mark as set up
    
    // Store cleanup function in ref so it can be called on unmount
    listenersCleanupRef.current = () => {
      console.log('[SCRUBBING EFFECT] Cleaning up event listeners');
      listenersSetupRef.current = false;
      // Cancel any pending animation frame
      if (mouseMoveRafRef.current !== null) {
        cancelAnimationFrame(mouseMoveRafRef.current);
        mouseMoveRafRef.current = null;
      }
      
      canvas.removeEventListener('mousedown', handleMouseDown, { capture: true });
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      container.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('contextmenu', handleDocumentContextMenu, { capture: true });
      if (container) container.style.cursor = '';
      if (canvas) canvas.style.cursor = '';
    };
    
    // Don't return cleanup - cleanup is handled by unmount effect
    // This prevents listeners from being removed when filteredData changes
  }, [filteredData]); // Run when filteredData changes (chart should be rendered)

  // Prepare Chart.js data
  const chartData = useMemo(() => {
    if (!filteredData.length || !sortedTopics.length) {
      return { labels: [], datasets: [] };
    }

    // Sort data by date
    const sortedData = [...filteredData].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });

    // Get all unique dates
    const labels = sortedData.map(d => d.date);

    // Find max engagement for y-axis scaling
    let maxEngagement = 0;
    sortedTopics.forEach(topic => {
      const topicMax = Math.max(...sortedData.map(d => d[topic] || 0));
      if (topicMax > maxEngagement) maxEngagement = topicMax;
    });

    // Find post count ranges for line width scaling (with reasonable bounds)
    const allPostCounts = [];
    sortedTopics.forEach(topic => {
      sortedData.forEach(d => {
        const postCount = d[`${topic}_posts`] || 0;
        if (postCount > 0) allPostCounts.push(postCount);
      });
    });

    // Use percentiles for reasonable min/max bounds (avoid outliers)
    allPostCounts.sort((a, b) => a - b);
    const minPostCount = allPostCounts.length > 0 
      ? allPostCounts[Math.floor(allPostCounts.length * 0.1)] || 1  // 10th percentile
      : 1;
    const maxPostCount = allPostCounts.length > 0
      ? allPostCounts[Math.floor(allPostCounts.length * 0.9)] || 100  // 90th percentile
      : 100;

    // Create datasets for each topic
    const datasets = sortedTopics.map(topic => {
      const topicData = sortedData.map(d => d[topic] || 0);
      const postCounts = sortedData.map(d => d[`${topic}_posts`] || 0);
      const color = getTopicColor(topic);
      
      // Convert hex to rgba for better opacity control
      const hexToRgba = (hex, alpha = 1) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };

      return {
        label: topicNames?.[topic] || formatTopicLabel?.(topic) || topic,
        data: topicData,
        borderColor: color,
        backgroundColor: hexToRgba(color, 0.1),
        borderWidth: 2, // Uniform thickness
        pointRadius: 0, // Hide default points
        pointHoverRadius: 4,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        fill: false,
        tension: 0.4,
        postCounts: postCounts,
        minLineWidth: 1.5,
        maxLineWidth: 6,
        minPostCount: minPostCount,
        maxPostCount: maxPostCount,
        topic: topic
      };
    });

    return {
      labels: labels,
      datasets: datasets
    };
  }, [filteredData, sortedTopics]);

  // Chart options with scrubbing and improved tooltips
  const chartOptions = useMemo(() => {
    if (!chartData.labels.length) return null;

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
        axis: 'x', // Only snap to x-axis (date), not y-axis
      },
      elements: {
        point: {
          hoverRadius: 4
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          mode: 'index', // Use index mode to get all topics at a date
          intersect: false,
          position: 'nearest',
          filter: (tooltipItem) => {
            // Filter out topics with 0 engagement or 0 posts
            const value = tooltipItem.parsed.y;
            const dataset = tooltipItem.dataset;
            const postCount = dataset.postCounts?.[tooltipItem.dataIndex] || 0;
            return value > 0 && postCount > 0;
          },
          callbacks: {
            title: (items) => {
              if (items.length > 0) {
                const date = items[0].label;
                const dateObj = dayjs(date);
                // Update ref directly to avoid triggering state updates in tooltip
                const dateStr = dateObj.format('YYYY-MM-DD');
                if (lastHoverDateRef.current !== dateStr) {
                  lastHoverDateRef.current = dateStr;
                  hoverDateRef.current = dateObj;
                  // Only update state if not dragging (to avoid loops)
                  if (!isDraggingRef.current) {
                    setHoverDate(dateObj);
                  }
                }
                
                return dateObj.format('MMM D, YYYY');
              }
              return '';
            },
            label: (context) => {
              const value = context.parsed.y;
              if (value === null || value === undefined || value === 0) return null;
              
              const postCount = context.dataset.postCounts?.[context.dataIndex] || 0;
              if (postCount === 0) return null;
              
              const displayName = context.dataset.label;
              return `${displayName}: ${formatNumber(value)} engagements (${formatNumber(postCount)} posts)`;
            },
            labelColor: (context) => {
              return {
                borderColor: context.dataset.borderColor,
                backgroundColor: context.dataset.borderColor,
                borderWidth: 2
              };
            },
            afterLabel: (context) => {
              // Add visual separator after the top topic
              const items = context.chart.tooltip.dataPoints || [];
              const sortedItems = [...items]
                .filter(item => {
                  const val = item.parsed.y;
                  const postCount = item.dataset.postCounts?.[item.dataIndex] || 0;
                  return val > 0 && postCount > 0;
                })
                .sort((a, b) => b.parsed.y - a.parsed.y);
              
              // If this is the top topic and there are others, add a separator
              if (sortedItems.length > 1 && sortedItems[0] === context) {
                return '─────────────';
              }
              return '';
            },
            afterBody: (items) => {
              // Add helpful hint
              if (items.length > 0) {
                return ['\nClick and drag to select date range'];
              }
              return [];
            }
          },
          itemSort: (a, b) => {
            // Sort by engagement (descending) - highest first
            return b.parsed.y - a.parsed.y;
          },
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          footerFont: { size: 11, style: 'italic' },
          cornerRadius: 8,
          titleSpacing: 4,
          bodySpacing: 4
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            modifierKey: 'ctrl', // Require Ctrl key for panning to avoid conflict with scrubbing
            onPanStart: () => {
              // Disable pan if scrubbing
              if (isScrubbingRef.current) {
                return false; // Cancel pan if scrubbing
              }
            },
            onPan: ({ chart }) => {
              // Only pan if not scrubbing
              if (isScrubbingRef.current) return;
              
              // Track zoom state
              const xScale = chart.scales.x;
              setZoomState({
                min: xScale.min,
                max: xScale.max
              });
            }
          },
          zoom: {
            wheel: {
              enabled: true,
              speed: 0.1,
              modifierKey: null // Allow scroll zoom without modifier
            },
            pinch: {
              enabled: true
            },
            drag: {
              enabled: false // Disable drag zoom to avoid conflict with scrubbing
            },
            mode: 'x',
            onZoomStart: () => {
              // Disable zoom if scrubbing
              if (isScrubbingRef.current) {
                return false; // Cancel zoom if scrubbing
              }
            },
            onZoom: ({ chart }) => {
              // Only zoom if not scrubbing
              if (isScrubbingRef.current) return;
              
              // Track zoom state
              const xScale = chart.scales.x;
              setZoomState({
                min: xScale.min,
                max: xScale.max
              });
            }
          },
          limits: {
            x: {
              min: 'original',
              max: 'original'
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            displayFormats: {
              day: 'MMM D'
            }
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          type: 'linear',
          beginAtZero: true,
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            callback: function(value) {
              return formatNumber(value);
            }
          }
        }
      },
      onHover: (event, activeElements) => {
        // Force crosshair cursor (Chart.js might try to change it)
        if (chartInstanceRef.current?.canvas) {
          chartInstanceRef.current.canvas.style.setProperty('cursor', 'crosshair', 'important');
        }
        
        // Only update hover if not dragging (use ref to avoid closure issues)
        if (isDraggingRef.current) return;
        
        // Update hover date for vertical line based on mouse position directly
        // This gives smoother, less "clingy" behavior - follows cursor exactly
        if (chartInstanceRef.current && event) {
          try {
            const canvasPosition = ChartJS.helpers.getRelativePosition(event, chartInstanceRef.current);
            const xScale = chartInstanceRef.current.scales.x;
            
            // Get the date at the mouse position directly (not snapped to data points)
            const date = xScale.getValueForPixel(canvasPosition.x);
            
            if (date && !isNaN(date.getTime())) {
              const dateObj = dayjs(date);
              const dateStr = dateObj.format('YYYY-MM-DD');
              const lastDateStr = lastHoverDateRef.current;
              
              // Only update if date actually changed
              if (dateStr !== lastDateStr) {
                lastHoverDateRef.current = dateStr;
                hoverDateRef.current = dateObj;
                // Update vertical lines state ref directly
                if (verticalLinesStateRef.current && !isDraggingRef.current) {
                  verticalLinesStateRef.current.hoverDate = dateObj.toDate();
                }
                // Update state only if value changed (prevents loops)
                setHoverDate(dateObj);
              }
            }
          } catch {
            // Fallback to active elements if direct position fails
            if (activeElements.length > 0) {
              const element = activeElements[0];
              const date = chartInstanceRef.current.data.labels[element.index];
              const dateObj = dayjs(date);
              
              const dateStr = dateObj.format('YYYY-MM-DD');
              const lastDateStr = lastHoverDateRef.current;
              
              if (dateStr !== lastDateStr) {
                lastHoverDateRef.current = dateStr;
                hoverDateRef.current = dateObj;
                setHoverDate(dateObj);
              }
            }
          }
        } else {
          // Only clear if not already null
          if (lastHoverDateRef.current !== null) {
            lastHoverDateRef.current = null;
            hoverDateRef.current = null;
      setHoverDate(null);
          }
        }
      },
      onResize: (chart) => {
        // Re-apply crosshair cursor after resize
        const canvas = chart.canvas;
        const container = canvas?.parentElement;
        if (canvas) {
          canvas.style.setProperty('cursor', 'crosshair', 'important');
          canvas.style.pointerEvents = 'auto';
        }
        if (container) {
          container.style.setProperty('cursor', 'crosshair', 'important');
        }
      }
    };
  }, [chartData]); // isDragging is accessed via ref, so not needed in dependencies

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 pb-1">
        <SectionTitle
          icon={<FaChartLine />}
          text="Topic Engagement Timeline"
          helpContent={
            <div className="text-left">
              <ul className="list-disc list-inside space-y-1">
                <li>This visualization shows topic activity over time.</li>
                <li>Each colored line represents a topic&apos;s engagement.</li>
                <li>Line thickness indicates post volume (thicker = more posts).</li>
                <li>Hover to see all topics at that date, sorted by engagement.</li>
                <li>Left-click and drag to select a date range.</li>
                <li>Scroll to zoom in/out on the timeline.</li>
                <li>Ctrl+drag to pan the timeline.</li>
                <li>Right-click or click Reset to clear selection and reset zoom.</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-gray-300">
                <p className="font-semibold mb-2">Vertical Line Legend:</p>
                <ul className="list-none space-y-1.5">
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-blue-500/60 border-dashed border-t-2 border-blue-500"></div>
                    <span>Blue dashed = Hovered date</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-green-500/70"></div>
                    <span>Green = Start date</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-red-500/70"></div>
                    <span>Red = End date</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-orange-500/80 border-dashed border-t-2 border-orange-500"></div>
                    <span>Orange dashed = Selected range</span>
                  </li>
                </ul>
              </div>
            </div>
          }
        />
      </div>
      
      <div className="flex-1 relative min-h-0">
        {chartData.labels.length > 0 && chartOptions ? (
          <div className="w-full h-full relative engagement-timeline-container" style={{ cursor: 'crosshair' }}>
            <Line
              ref={(ref) => {
                console.log('[CHART REF] Chart ref callback called', { hasRef: !!ref, hasCanvas: !!ref?.canvas });
                chartRef.current = ref;
                if (ref && ref.canvas) {
                  chartInstanceRef.current = ref;
                  console.log('[CHART REF] Chart instance set', { 
                    hasCanvas: !!ref.canvas,
                    hasContainer: !!ref.canvas?.parentElement
                  });
                  // Set cursor immediately when chart is ready
                  const canvas = ref.canvas;
                  const container = canvas?.parentElement;
                  if (canvas) {
                    canvas.style.cursor = 'crosshair';
                    canvas.style.pointerEvents = 'auto';
                  }
                  if (container) {
                    container.style.cursor = 'crosshair';
                  }
                  
                  // If listeners aren't set up yet, trigger setup (effect will retry)
                  if (!listenersSetupRef.current) {
                    // The effect's retry mechanism will pick this up
                    console.log('[CHART REF] Chart ready, listeners should be set up by retry mechanism');
                  }
                } else {
                  console.log('[CHART REF] Chart ref is null or has no canvas');
                  // Don't set chartInstanceRef to null - keep the previous instance
                  // This prevents errors when chart is temporarily null during updates
                }
              }}
              data={chartData}
              options={chartOptions}
              plugins={[verticalLinesPlugin, cursorAndContextMenuPlugin]}
            />
            
            {/* Controls */}
            <div className="absolute top-2 right-2 flex flex-col gap-2">
              {/* Reset Zoom Button */}
              {(zoomState || selectedDateRange.start) && (
                <button
                  onClick={() => {
                    console.log('[RESET BUTTON] Resetting everything');
                    // Reset drag state
                    setIsDragging(false);
                    setDragStartDate(null);
                    setDragEndDate(null);
                    dragStartDateRef.current = null;
                    dragEndDateRef.current = null;
                    isScrubbingRef.current = false;
                    isDraggingRef.current = false;
                    
                    // Reset selected range
                    setSelectedDateRange({ start: null, end: null });
                    
                    // Clear vertical lines state ref
                    if (verticalLinesStateRef.current) {
                      verticalLinesStateRef.current.isDragging = false;
                      verticalLinesStateRef.current.dragStartDate = null;
                      verticalLinesStateRef.current.dragEndDate = null;
                      verticalLinesStateRef.current.selectedStart = null;
                      verticalLinesStateRef.current.selectedEnd = null;
                    }
                    
                    // Reset zoom
                    if (chartInstanceRef.current && chartInstanceRef.current.canvas) {
                      try {
                        chartInstanceRef.current.resetZoom();
                        setZoomState(null);
                        chartInstanceRef.current.update('none');
                      } catch (err) {
                        console.warn('[RESET BUTTON] Chart reset/update failed:', err);
                      }
                    }
                    
                    // Also call onDateChange with default dates to reset parent state
                    // Use the same defaults as App.jsx to avoid null date errors
                    if (onDateChangeRef.current) {
                      const defaultStart = dayjs('2020-01-01');
                      const defaultEnd = dayjs('2021-12-31');
                      onDateChangeRef.current(defaultStart, defaultEnd);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-lg transition-colors"
                  title="Reset zoom and selection (or right-click)"
                >
                  Reset
                </button>
              )}
                </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No data available for the selected filters
          </div>
        )}
      </div>
    </div>
  );
}

EngagementTimeline.propTypes = {
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  onDateChange: PropTypes.func,
  selectedParty: PropTypes.string,
  legislator: PropTypes.shape({
    legislator_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  })
};
