import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { FaUser, FaMapMarkerAlt, FaTimes, FaSearch, FaCalendarAlt, FaGlobe } from 'react-icons/fa';
import { FaDemocrat, FaRepublican, FaArrowsAltH } from 'react-icons/fa';
import { FaTwitter, FaFacebook } from 'react-icons/fa';
import { topicIcons, getTopicColor, formatTopicLabel, topicNames } from '../utils/utils';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { API_BASE } from '../utils/api';

// Constants
const FLASHPOINTS = [
  { label: 'January 6th Insurrection', range: ['2021-01-05', '2021-01-31'] },
  { label: '2020 BLM Protests', range: ['2020-05-24', '2020-07-31'] },
];
// TOPICS will be loaded from engagement_timeline.json data, not hardcoded
const STATES = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' }
];

const PARTY_OPTIONS = [
  { value: 'D', label: 'Democrats', icon: FaDemocrat, color: '#1f77b4' },
  { value: 'both', label: 'Both', icon: FaArrowsAltH, color: '#605DFF' },
  { value: 'R', label: 'Republicans', icon: FaRepublican, color: '#fb2c36' }
];

const PLATFORM_OPTIONS = [
  { value: 'twitter', label: 'Twitter', icon: FaTwitter, color: '#1DA1F2' },
  { value: 'both', label: 'Both', icon: FaArrowsAltH, color: '#605DFF' },
  { value: 'facebook', label: 'Facebook', icon: FaFacebook, color: '#1877F2' }
];

export default function Sidebar({
  activeTopics,
  setActiveTopics,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  keyword,
  setKeyword,
  legislator,
  setLegislator,
  selectedState,
  setSelectedState,
  selectedParty,
  setSelectedParty,
  selectedPlatform,
  setSelectedPlatform,
}) {
  const [legislators, setLegislators] = useState([]);
  const [flashpoint, setFlashpoint] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stateSearchTerm, setStateSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [keywordDropdownOpen, setKeywordDropdownOpen] = useState(false);
  const dropdownRef = useRef();
  const stateDropdownRef = useRef();
  const dateDropdownRef = useRef();
  const keywordDropdownRef = useRef();
  const [inputValue, setInputValue] = useState('');
  const [topicsByEngagement, setTopicsByEngagement] = useState([]);

  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState('');

  // Load topics sorted by engagement from API
  // Always order by overall engagement (not filtered by date range) for consistent ordering
  useEffect(() => {
    const controller = new AbortController();
    
    const loadData = async () => {
      setTopicsLoading(true);
      setTopicsError('');
      try {
        const params = {};
        // Don't filter by date range - always use overall engagement for consistent ordering
        // Only filter by party if specified
        if (selectedParty && selectedParty !== 'both') {
          params.party = selectedParty;
        }
        if (legislator?.legislator_id) {
          params.legislator = legislator.legislator_id;
        }
        params.limit = 500; // Get top 500 topics

        const queryString = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/engagement/topics/?${queryString}`, {
          signal: controller.signal
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP error! status: ${res.status} - ${errorText.substring(0, 100)}`);
        }
        const topicsArray = await res.json();
        
        if (controller.signal.aborted) return;
        
        if (Array.isArray(topicsArray)) {
          // Ensure topics are always sorted by engagement (API should return them sorted, but double-check)
          setTopicsByEngagement(topicsArray);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        if (err.name === 'AbortError') return; // Ignore aborted requests
        console.error('Error loading topics in Sidebar:', err);
        setTopicsError(err.message || 'Failed to load topics');
        setTopicsByEngagement([]);
      } finally {
        if (!controller.signal.aborted) {
          setTopicsLoading(false);
        }
      }
    };

    loadData();
    
    return () => controller.abort();
  }, [selectedParty, legislator]); // Removed startDate and endDate from dependencies - topics always ordered by overall engagement

  // Unknown topic identifier - always shown at bottom, unselected by default
  const UNKNOWN_TOPIC = 'Unknown Topic (999)';

  // Initialize default topics (top 3 by engagement, excluding unknown) if none are selected
  useEffect(() => {
    // Only set defaults if we have topics loaded and no topics are currently selected
    if (topicsByEngagement.length > 0 && (!activeTopics || activeTopics.length === 0)) {
      const defaultTopics = topicsByEngagement
        .filter(t => t !== UNKNOWN_TOPIC)
        .slice(0, 3);
      setActiveTopics(defaultTopics);
    }
  }, [topicsByEngagement, activeTopics, setActiveTopics]);

  // Check if current date range is the default
  const isDefaultDateRange = () => {
    const defaultStart = dayjs('2020-01-01');
    const defaultEnd = dayjs('2023-12-31');
    return startDate.isSame(defaultStart, 'day') && endDate.isSame(defaultEnd, 'day');
  };

  // Debounce keyword input
  useEffect(() => {
    const id = setTimeout(() => setKeyword(inputValue), 2000);
    return () => clearTimeout(id);
  }, [inputValue, setKeyword]);

  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target)) {
        setStateDropdownOpen(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target)) {
        setDateDropdownOpen(false);
      }
      if (keywordDropdownRef.current && !keywordDropdownRef.current.contains(e.target)) {
        setKeywordDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Load legislators from API
  useEffect(() => {
    const fetchLegislators = async () => {
      try {
        const params = {};
        if (selectedParty && selectedParty !== 'both') {
          params.party = selectedParty;
        }
        if (selectedState) {
          params.state = selectedState;
        }
        const queryString = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/legislators/?${queryString}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setLegislators(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch legislators:', err);
        setLegislators([]);
      }
    };
    fetchLegislators();
  }, [selectedParty, selectedState]);

  // Keep searchTerm in sync
  useEffect(() => {
    if (legislator) {
      const { name, party, state } = legislator;
      setSearchTerm(`${name} (${party.charAt(0)} - ${state})`);
    }
  }, [legislator]);

  const handleSelect = leg => {
    setLegislator(leg);
    setSearchTerm(`${leg.name} (${leg.party.charAt(0)} - ${leg.state})`);
    setDropdownOpen(false);
  };

  const handleStateSelect = state => {
    setSelectedState(state.abbr);
    setStateDropdownOpen(false);
  };

  const filteredStates = STATES.filter(state =>
    state.abbr.toLowerCase().includes(stateSearchTerm.toLowerCase()) ||
    state.name.toLowerCase().includes(stateSearchTerm.toLowerCase())
  );

  const filtered = legislators.filter(l =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Clear all filters
  const clearAllFilters = () => {
    setActiveTopics([]);
    setStartDate(dayjs('2020-01-01'));
    setEndDate(dayjs('2023-12-31'));
    setKeyword(null);
    setLegislator(null);
    setSelectedState('');
    setSelectedParty('both');
    setSelectedPlatform('both');
    setSearchTerm('');
    setInputValue('');
    setFlashpoint('');
  };

  // Get active filters for display
  const getActiveFilters = () => {
    const filters = [];
    
    if (activeTopics.length > 0) {
      const topicLabels = activeTopics.map(topic => 
        topicNames[topic] || formatTopicLabel(topic) || topic.charAt(0).toUpperCase() + topic.slice(1)
      );
      filters.push({ type: 'topics', label: `Topics: ${topicLabels.join(', ')}`, value: activeTopics });
    }
    if (keyword) {
      filters.push({ type: 'keyword', label: `Keyword: "${keyword}"`, value: keyword });
    }
    if (legislator) {
      filters.push({ type: 'legislator', label: `Legislator: ${legislator.name}`, value: legislator });
    }
    if (selectedState) {
      const stateName = STATES.find(s => s.abbr === selectedState)?.name || selectedState;
      filters.push({ type: 'state', label: `State: ${stateName}`, value: selectedState });
    }
    if (selectedParty !== 'both') {
      const partyOption = PARTY_OPTIONS.find(p => p.value === selectedParty);
      filters.push({ type: 'party', label: `Party: ${partyOption?.label || selectedParty}`, value: selectedParty });
    }
    if (selectedPlatform !== 'both') {
      const platformOption = PLATFORM_OPTIONS.find(p => p.value === selectedPlatform);
      filters.push({ type: 'platform', label: `Platform: ${platformOption?.label || selectedPlatform}`, value: selectedPlatform });
    }
    if (startDate && endDate && !isDefaultDateRange()) {
      const startStr = dayjs(startDate).format('MM/DD/YYYY');
      const endStr = dayjs(endDate).format('MM/DD/YYYY');
      filters.push({ type: 'date', label: `Date: ${startStr} to ${endStr}`, value: { startDate, endDate } });
    }
    
    return filters;
  };

  const activeFilters = getActiveFilters();

  return (
    <aside className="w-64 h-full bg-base-200 shadow-xl p-4 relative flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col gap-6 min-h-0">
        {/* Party Toggle */}
        <div className="space-y-3">
          <div className="flex bg-base-300 rounded-lg p-1">
            {PARTY_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = selectedParty === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedParty(option.value)}
                  className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md transition-all duration-300 ${
                    isActive 
                      ? 'bg-base-100 shadow-sm' 
                      : 'hover:bg-base-200'
                  }`}
                  style={{
                    backgroundColor: isActive ? option.color + '33' : 'transparent',
                    color: isActive ? option.color : option.color + '66'
                  }}
                >
                  <div className={`flex items-center transition-all duration-300 ${
                    isActive ? 'space-x-2' : 'justify-center'
                  }`}>
                    <Icon 
                      size={isActive ? 16 : 14} 
                      className="transition-all duration-300"
                    />
                    {isActive && (
                      <span className="text-xs font-medium whitespace-nowrap">
                        {option.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Platform Toggle */}
        <div className="space-y-3">
          <div className="flex bg-base-300 rounded-lg p-1">
            {PLATFORM_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = selectedPlatform === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedPlatform(option.value)}
                  className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md transition-all duration-300 ${
                    isActive 
                      ? 'bg-base-100 shadow-sm' 
                      : 'hover:bg-base-200'
                  }`}
                  style={{
                    backgroundColor: isActive ? option.color + '33' : 'transparent',
                    color: isActive ? option.color : option.color + '66'
                  }}
                >
                  <div className={`flex items-center transition-all duration-300 ${
                    isActive ? 'space-x-2' : 'justify-center'
                  }`}>
                    <Icon 
                      size={isActive ? 16 : 14} 
                      className="transition-all duration-300"
                    />
                    {isActive && (
                      <span className="text-xs font-medium whitespace-nowrap">
                        {option.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Range and Keyword Search Bubbles */}
        <div className="space-y-3">
          <div className="flex justify-center space-x-4">
            {/* Date Range Bubble */}
            <div className="relative" ref={dateDropdownRef}>
              <Tippy
                content={
                  <div className="text-center px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md" style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))',
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    {!isDefaultDateRange() ? (
                      <>
                        <div className="font-bold text-base mb-2 text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>📅 Date Range</div>
                        <div className="text-sm mb-2 text-white opacity-95" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                          {dayjs(startDate).format('MMM D, YYYY')} to {dayjs(endDate).format('MMM D, YYYY')}
                        </div>
                        <div className="text-xs text-white opacity-80" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Click to Clear Selection</div>
                      </>
                    ) : (
                      <>
                        <div className="font-bold text-base mb-2 text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>📅 Date Range</div>
                        <div className="text-sm mb-2 text-white opacity-95" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Full dataset range</div>
                        <div className="text-xs text-white opacity-80" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Click to Select Date Range</div>
                      </>
                    )}
                  </div>
                }
                placement="bottom"
                arrow
                animation="scale-subtle"
                duration={[200, 150]}
                delay={[100, 0]}
              >
                <button
                  onClick={() => {
                    if (!isDefaultDateRange()) {
                      // Clear date back to default
                      setStartDate(dayjs('2020-01-01'));
                      setEndDate(dayjs('2023-12-31'));
                      setFlashpoint('');
                    } else {
                      setDateDropdownOpen(!dateDropdownOpen);
                    }
                  }}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    !isDefaultDateRange()
                      ? 'border-primary bg-primary text-primary-content hover:border-error hover:bg-error' 
                      : 'border-gray-300 bg-base-100 hover:border-primary hover:bg-primary hover:text-primary-content'
                  }`}
                >
                                  {!isDefaultDateRange() ? (
                  <div className="relative group">
                    <div className="text-xs text-center leading-tight px-1 transition-opacity duration-300 group-hover:opacity-0">
                      <div className="font-bold">{dayjs(startDate).format('MM/DD')}</div>
                      <div>{dayjs(endDate).format('MM/DD')}</div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <FaTimes size={20} />
                    </div>
                  </div>
                  ) : (
                    <FaCalendarAlt size={20} />
                  )}
                </button>
              </Tippy>
              {dateDropdownOpen && (
                <div className="absolute z-50 w-80 bg-base-200 border rounded mt-2 p-4" style={{ left: '-80px' }}>
                  <div className="text-xs text-gray-500 mb-3">Date Range</div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="input input-bordered input-sm flex-1 text-xs"
                        value={dayjs(startDate).format('YYYY-MM-DD')}
                        onChange={e => {
                          const newStartDate = dayjs(e.target.value);
                          // Ensure at least 2 days difference
                          if (newStartDate.isSameOrAfter(endDate)) {
                            const newEndDate = newStartDate.add(2, 'day');
                            setEndDate(newEndDate);
                          }
                          setStartDate(newStartDate);
                        }}
                      />
                      <span className="text-xs text-gray-500">to</span>
                      <input
                        type="date"
                        className="input input-bordered input-sm flex-1 text-xs"
                        value={dayjs(endDate).format('YYYY-MM-DD')}
                        onChange={e => {
                          const newEndDate = dayjs(e.target.value);
                          // Ensure at least 2 days difference
                          if (newEndDate.isSameOrBefore(startDate)) {
                            const newStartDate = newEndDate.subtract(2, 'day');
                            setStartDate(newStartDate);
                          }
                          setEndDate(newEndDate);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Keyword Search Bubble */}
            <div className="relative" ref={keywordDropdownRef}>
              <Tippy
                content={
                  keyword ? (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">Keyword Search</div>
                      <div className="text-xs mb-2">&ldquo;{keyword}&rdquo;</div>
                      <div className="text-xs text-gray-400">Click to Clear Selection</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">Keyword Search</div>
                      <div className="text-xs mb-2">Search for specific terms</div>
                      <div className="text-xs text-gray-400">Click to Select Keywords</div>
                    </div>
                  )
                }
                placement="bottom"
                arrow
                animation="scale-subtle"
              >
                <button
                  onClick={() => setKeywordDropdownOpen(!keywordDropdownOpen)}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    keyword 
                      ? 'border-primary bg-primary text-primary-content hover:border-error hover:bg-error' 
                      : 'border-gray-300 bg-base-100 hover:border-primary hover:bg-primary hover:text-primary-content'
                  }`}
                >
                  {keyword ? (
                    <div className="relative group">
                      <div className="text-xs text-center leading-tight px-1 transition-opacity duration-300 group-hover:opacity-0">
                        <div className="truncate">{keyword.length > 8 ? keyword.substring(0, 8) + '...' : keyword}</div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <FaTimes size={20} />
                      </div>
                    </div>
                  ) : (
                    <FaSearch size={20} />
                  )}
                </button>
              </Tippy>
              {keywordDropdownOpen && (
                <div 
                  className="absolute z-50 bg-base-200 border rounded mt-2 p-2"
                  style={{
                    left: '50%',              
                    transform: 'translateX(-50%)',
                    minWidth: '150px',        
                    maxWidth: '220px',       
                    width: '100%'             
                  }}>
                  <div className="text-xs text-gray-500 mb-1">Keyword Search</div>
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      className="input input-bordered w-full pl-8 text-xs"
                      placeholder="Enter keywords..."
                      value={inputValue}
                      onChange={e => {
                        const v = e.target.value;
                        setInputValue(v);
                        if (v.trim() === '') setKeyword(null);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* State and Legislator Selection */}
        <div className="space-y-3">
          <div className="flex justify-center space-x-4">
            {/* State Bubble */}
            <div className="relative" ref={stateDropdownRef}>
              <Tippy
                content={
                  selectedState ? (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">State Filter</div>
                      <div className="text-xs mb-2">{STATES.find(s => s.abbr === selectedState)?.name || selectedState}</div>
                      <div className="text-xs text-gray-400">Click to Clear Selection</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">State Filter</div>
                      <div className="text-xs mb-2">Filter by state</div>
                      <div className="text-xs text-gray-400">Click to Select State</div>
                    </div>
                  )
                }
                placement="bottom"
                arrow
                animation="scale-subtle"
              >
                <button
                  onClick={() => {
                    if (selectedState) {
                      setSelectedState('');
                    } else {
                      setStateDropdownOpen(!stateDropdownOpen);
                    }
                  }}
                  onMouseEnter={() => {
                    if (selectedState) {
                      // Show hover state for deselection
                    }
                  }}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    selectedState 
                      ? 'border-primary bg-primary text-primary-content hover:border-error hover:bg-error' 
                      : 'border-gray-300 bg-base-100 hover:border-primary hover:bg-primary hover:text-primary-content'
                  }`}
                >
                  {selectedState ? (
                    <div className="relative group">
                      <span className="text-sm font-bold transition-opacity duration-300 group-hover:opacity-0">{selectedState}</span>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <FaTimes size={20} />
                      </div>
                    </div>
                  ) : (
                    <FaMapMarkerAlt size={20} />
                  )}
                </button>
              </Tippy>    
              {stateDropdownOpen && (
                  <div
                    className="absolute z-50 bg-base-200 border rounded mt-2 p-2 max-h-60 overflow-y-auto"
                    style={{
                      left: '50%',
                      transform: 'translateX(-50%)',
                      minWidth: '150px',
                      maxWidth: '220px',
                      width: '100%',
                    }}
                  >
                    <div className="text-xs text-gray-500 mb-1">Select State</div>
                    <div className="relative">
                      <input
                        type="text"
                        className="input input-bordered w-full input-sm text-xs"
                        placeholder="Search states..."
                        value={stateSearchTerm}
                        onChange={e => setStateSearchTerm(e.target.value)}
                      />
                    </div>

                    {filteredStates.length === 0 ? (
                      <div className="p-2 text-center text-sm text-gray-500">
                        No states found
                      </div>
                    ) : (
                      filteredStates.map(state => (
                        <div
                          key={state.abbr}
                          className="p-2 hover:bg-base-300 cursor-pointer text-sm rounded"
                          onClick={() => handleStateSelect(state)}
                        >
                          {state.abbr} - {state.name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

            {/* Legislator Bubble */}
            <div className="relative" ref={dropdownRef}>
              <Tippy
                content={
                  legislator ? (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">Legislator Filter</div>
                      <div className="text-xs mb-2">{legislator.name}</div>
                      <div className="text-xs text-gray-400">Click to Clear Selection</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">Legislator Filter</div>
                      <div className="text-xs mb-2">Filter by specific legislator</div>
                      <div className="text-xs text-gray-400">Click to Select Legislator</div>
                    </div>
                  )
                }
                placement="bottom"
                arrow
                animation="scale-subtle"
              >
                <button
                  onClick={() => {
                    if (legislator) {
                      setLegislator(null);
                      setSearchTerm('');
                    } else {
                      setDropdownOpen(!dropdownOpen);
                    }
                  }}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    legislator 
                      ? 'border-primary bg-primary text-primary-content hover:border-error hover:bg-error' 
                      : 'border-gray-300 bg-base-100 hover:border-primary hover:bg-primary hover:text-primary-content'
                  }`}
                >
                  {legislator ? (
                    <div className="relative group">
                      <div className="text-xs text-center leading-tight px-1 transition-opacity duration-300 group-hover:opacity-0">
                        <div className="font-bold leading-tight">{legislator.name.split(' ')[0]}</div>
                        <div className="leading-tight">{legislator.name.split(' ').slice(1).join(' ')}</div>
                        <div className="text-[10px] leading-tight">({legislator.party.charAt(0)} - {legislator.state})</div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <FaTimes size={20} />
                      </div>
                    </div>
                  ) : (
                    <FaUser size={20} />
                  )}
                </button>
              </Tippy>
              {dropdownOpen && (
                <div 
                  className="absolute z-50 w-80 bg-base-200 border rounded-lg shadow-xl mt-2 max-h-60 overflow-y-auto"
                  style={{ 
                    left: '50%',
                    transform: 'translateX(-50%)',
                    minWidth: '150px',
                    maxWidth: '220px',
                    width: '100%'   
                  }}>
                  <div className="p-2">
                    <div className="text-xs text-gray-500 mb-2">Search Legislator</div>
                    <input
                      type="text"
                      className="input input-bordered input-sm w-full mb-2"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    {filtered.length === 0 ? (
                      <div className="p-2 text-center text-sm text-gray-500">
                        {legislators.length === 0 ? 'Loading legislators...' : 'No legislators found'}
                      </div>
                    ) : (
                      filtered.map(leg => (
                        <div
                          key={leg.legislator_id}
                          className="p-2 hover:bg-base-300 cursor-pointer text-sm"
                          onClick={() => handleSelect(leg)}
                        >
                          {leg.name} ({leg.party?.charAt(0) || '?'} - {leg.state || 'N/A'})
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* OR Key Events Section */}
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-2">OR</div>
            <select
              className="select select-bordered select-sm w-full text-xs bg-base-100"
              value={flashpoint}
              onChange={e => {
                const fp = FLASHPOINTS.find(f => f.label === e.target.value);
                if (fp) {
                  setStartDate(dayjs(fp.range[0]));
                  setEndDate(dayjs(fp.range[1]));
                }
                setFlashpoint(e.target.value);
              }}
            >
              <option value="">Select a key event</option>
              {FLASHPOINTS.map(fp => (
                <option key={fp.label} value={fp.label}>
                  {fp.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Topic Selection - Redesigned */}
        {/* Only this section should scroll */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="text-xs text-gray-500 font-medium mb-3 shrink-0">Topics</div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
            {topicsLoading ? (
              <div className="text-xs text-gray-400 text-center py-4">
                <div className="flex items-center justify-center space-x-2">
                  <div className="loading loading-spinner loading-xs"></div>
                  <span>Loading topics...</span>
                </div>
              </div>
            ) : topicsError ? (
              <div className="text-xs text-red-400 text-center py-4">
                <div>Error: {topicsError}</div>
                <button 
                  className="btn btn-xs btn-ghost mt-2"
                  onClick={() => {
                    setTopicsError('');
                    setTopicsLoading(true);
                    // Trigger reload by updating a dependency
                    const loadData = async () => {
                      try {
                        const params = {};
                        // Don't filter by date range - always use overall engagement
                        if (selectedParty && selectedParty !== 'both') {
                          params.party = selectedParty;
                        }
                        if (legislator?.legislator_id) {
                          params.legislator = legislator.legislator_id;
                        }
                        params.limit = 500;
                        const queryString = new URLSearchParams(params).toString();
                        const res = await fetch(`${API_BASE}/engagement/topics/?${queryString}`);
                        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                        const topicsArray = await res.json();
                        if (Array.isArray(topicsArray)) {
                          setTopicsByEngagement(topicsArray);
                          setTopicsError('');
                        }
                      } catch (err) {
                        setTopicsError(err.message);
                      } finally {
                        setTopicsLoading(false);
                      }
                    };
                    loadData();
                  }}
                >
                  Retry
                </button>
              </div>
            ) : topicsByEngagement.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">
                No topics available. The database may still be importing data.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 pb-2">
                {/* Regular topics (excluding unknown) */}
                {topicsByEngagement
                  .filter(topic => topic !== UNKNOWN_TOPIC)
                  .map(topic => {
                    // Use FaGlobe as fallback icon if topic not in topicIcons
                    const Icon = topicIcons[topic] || topicIcons.all || FaGlobe;
                    const isActive = activeTopics.includes(topic);
                    const color = getTopicColor(topic);
                    const displayName = topicNames[topic] || formatTopicLabel(topic) || topic.charAt(0).toUpperCase() + topic.slice(1);
                    
                    return (
                      <button
                        key={topic}
                        onClick={() => {
                          const next = isActive
                            ? activeTopics.filter(t => t !== topic)
                            : [...activeTopics, topic];
                          setActiveTopics(next);
                        }}
                        className={`relative p-2.5 rounded-lg border-2 transition-all duration-300 flex flex-row items-center justify-start space-x-2.5 ${
                          isActive 
                            ? 'shadow-md' 
                            : 'border-gray-200 hover:border-gray-300 bg-base-100 hover:bg-base-200'
                        }`}
                        style={{
                          borderColor: isActive ? color : undefined,
                          background: isActive 
                            ? `linear-gradient(135deg, ${color}dd, ${color}aa)` 
                            : undefined,
                          color: isActive ? 'white' : '#6B7280'
                        }}
                      >
                        {Icon && (
                          <Icon 
                            size={16} 
                            className="flex-shrink-0"
                            style={{
                              color: isActive ? 'white' : color,
                              filter: isActive ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' : 'none'
                            }}
                          />
                        )}
                        <span 
                          className="text-xs font-medium flex-1 text-left break-words"
                          style={{
                            textShadow: isActive ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                            fontWeight: isActive ? 'bold' : 'medium',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                          }}
                        >
                          {displayName}
                        </span>
                        {isActive && (
                          <div 
                            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full border border-white flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                        )}
                      </button>
                    );
                  })}
                
                {/* Unknown Topic - always at bottom */}
                {topicsByEngagement.includes(UNKNOWN_TOPIC) && (() => {
                  const topic = UNKNOWN_TOPIC;
                  const Icon = topicIcons[topic] || FaGlobe;
                  const isActive = activeTopics.includes(topic);
                  const color = getTopicColor(topic) || '#9CA3AF';
                  const displayName = 'Unknown Topic';
                  
                  return (
                    <button
                      key={topic}
                      onClick={() => {
                        const next = isActive
                          ? activeTopics.filter(t => t !== topic)
                          : [...activeTopics, topic];
                        setActiveTopics(next);
                      }}
                      className={`relative p-2.5 rounded-lg border-2 transition-all duration-300 flex flex-row items-center justify-start space-x-2.5 mt-2 border-dashed ${
                        isActive 
                          ? 'shadow-md' 
                          : 'border-gray-300 hover:border-gray-400 bg-base-100 hover:bg-base-200'
                      }`}
                      style={{
                        borderColor: isActive ? color : undefined,
                        background: isActive 
                          ? `linear-gradient(135deg, ${color}dd, ${color}aa)` 
                          : undefined,
                        color: isActive ? 'white' : '#9CA3AF'
                      }}
                    >
                      {Icon && (
                        <Icon 
                          size={16} 
                          className="flex-shrink-0"
                          style={{
                            color: isActive ? 'white' : color,
                            filter: isActive ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' : 'none'
                          }}
                        />
                      )}
                      <span 
                        className="text-xs font-medium flex-1 text-left break-words"
                        style={{
                          textShadow: isActive ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                          fontWeight: isActive ? 'bold' : 'medium',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word'
                        }}
                      >
                        {displayName}
                      </span>
                      {isActive && (
                        <div 
                          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full border border-white flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                      )}
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Filters Section - Fixed to bottom */}
      {activeFilters.length > 0 && (
        <div className="mt-auto pt-4 border-t border-gray-300">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Active Filters</h3>
              <button
                onClick={clearAllFilters}
                className="text-xs text-primary hover:text-primary-focus"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-2">
              {activeFilters.map((filter, index) => (
                <div key={index} className="flex items-center justify-between bg-base-300 rounded px-3 py-2">
                  <span className="text-xs truncate">{filter.label}</span>
                  <button
                    onClick={() => {
                      switch (filter.type) {
                        case 'topics':
                          setActiveTopics([]);
                          break;
                        case 'keyword':
                          setKeyword(null);
                          setInputValue('');
                          break;
                        case 'legislator':
                          setLegislator(null);
                          setSearchTerm('');
                          break;
                        case 'state':
                          setSelectedState('');
                          break;
                        case 'party':
                          setSelectedParty('both');
                          break;
                        case 'platform':
                          setSelectedPlatform('both');
                          break;
                        case 'date':
                          setStartDate(dayjs('2020-01-01'));
                          setEndDate(dayjs('2023-12-31'));
                          setFlashpoint('');
                          break;
                      }
                    }}
                    className="ml-2 text-gray-500 hover:text-gray-700"
                  >
                    <FaTimes size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

Sidebar.propTypes = {
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  setActiveTopics: PropTypes.func.isRequired,
  startDate: PropTypes.object.isRequired,
  setStartDate: PropTypes.func.isRequired,
  endDate: PropTypes.object.isRequired,
  setEndDate: PropTypes.func.isRequired,
  keyword: PropTypes.string,
  setKeyword: PropTypes.func.isRequired,
  legislator: PropTypes.shape({
    name: PropTypes.string,
    party: PropTypes.string,
    state: PropTypes.string,
    legislator_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }),
  setLegislator: PropTypes.func.isRequired,
  selectedState: PropTypes.string.isRequired,
  setSelectedState: PropTypes.func.isRequired,
  selectedParty: PropTypes.string.isRequired,
  setSelectedParty: PropTypes.func.isRequired,
  selectedPlatform: PropTypes.string.isRequired,
  setSelectedPlatform: PropTypes.func.isRequired
};