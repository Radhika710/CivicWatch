import { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import dayjs from 'dayjs';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SidebarAbout from './components/SidebarAbout';
import SidebarInfo from './components/SidebarInfo';
import EngagementTimeline from './components/EngagementTimeline';
import TopVisualization from './components/TopVisualization';
import ContextPanel from './components/ContextPanel';
import './App.css';

export default function App() {
  // State from HEAD (Current Change)
  const [panel, setPanel] = useState('sidebar'); // Manages which panel is open
  // Start with empty array - Sidebar will set top 10 by engagement as default
  const [topics, setTopics] = useState([]);
  const [startDate, setStartDate] = useState(dayjs('2020-01-01'));
  const [endDate, setEndDate] = useState(dayjs('2021-12-31'));
  const [keyword, setKeyword] = useState('');
  const [legislator, setLegislator] = useState(null);
  const [selectedState, setSelectedState] = useState('');
  const [selectedParty, setSelectedParty] = useState('both');
  const [selectedPlatform, setSelectedPlatform] = useState('both');


  // Sync initial theme (from HEAD, slightly adapted variable name from Incoming)
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Panel toggle logic from HEAD
  const toggle = panelKey => setPanel(prev => (prev === panelKey ? null : panelKey));

  const sidebarOpen = panel === 'sidebar';
  const aboutOpen = panel === 'about';
  const infoOpen = panel === 'info';

  // Date change handler from HEAD
  const handleDateChange = (s, e) => {
    setStartDate(s);
    setEndDate(e);
  };

  return (
    <div className="flex flex-col h-screen">
      <Navbar
        toggleSidebar={() => toggle('sidebar')}
        toggleAbout={() => toggle('about')}
        toggleInfo={() => toggle('info')}
        startDate={startDate}
        endDate={endDate}
        topics={topics}
        keyword={keyword}
        legislator={legislator}
      />
      <BrowserRouter>
        <div className="flex flex-grow mt-16 relative">
          {/* Sidebar rendering and animation from HEAD */}
          <aside
            className={`fixed top-16 left-0 h-[calc(100vh-4rem)] z-30 transform transition-transform duration-300 ease-in-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full' // Ensuring it's fully off-screen
            }`}
          >
            <Sidebar
              activeTopics={topics}
              setActiveTopics={setTopics}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              keyword={keyword}
              setKeyword={setKeyword}
              legislator={legislator}
              setLegislator={setLegislator}
              selectedState={selectedState}
              setSelectedState={setSelectedState}
              selectedParty={selectedParty}
              setSelectedParty={setSelectedParty}
              selectedPlatform={selectedPlatform}
              setSelectedPlatform={setSelectedPlatform}
            />
          </aside>

          {/* SidebarAbout and SidebarInfo from HEAD's structure */}
          <SidebarAbout aboutOpen={aboutOpen} toggleAbout={() => toggle('about')} />
          <SidebarInfo infoOpen={infoOpen} toggleInfo={() => toggle('info')} />

          <main
            className={`flex-grow transition-margin duration-300 ease-in-out ${
              sidebarOpen || aboutOpen || infoOpen ? 'ml-64' : 'ml-0'
            }`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 px-4 pb-4 h-[calc(100vh-4rem)] overflow-auto">
              {/* Middle section - TopVisualization and EngagementTimeline */}
              <div className="lg:col-span-3 flex flex-col h-full">
                {/* COMPASS Visualization - fills available space */}
                <div className="bg-base-200 rounded-lg shadow-lg overflow-hidden flex-1 min-h-0 flex flex-col">
                  {/* Visualization content */}
                  <div className="flex-1 min-h-0">
                    <TopVisualization
                      activeTopics={topics}
                      startDate={startDate}
                      endDate={endDate}
                      legislator={legislator}
                      keyword={keyword}
                      selectedParty={selectedParty}
                    />
                  </div>
                </div>

                {/* EngagementTimeline - fixed height at bottom */}
                <div className="bg-base-200 rounded-lg shadow-lg overflow-hidden mt-4" style={{ height: "300px" }}>
                  <EngagementTimeline
                    activeTopics={topics}
                    startDate={startDate}
                    endDate={endDate}
                    onDateChange={handleDateChange}
                    selectedParty={selectedParty}
                    legislator={legislator}
                    keyword={keyword}
                  />
                </div>
              </div>

              {/* Right side - ContextPanel */}
              <div className="lg:col-span-2 bg-base-200 rounded-lg shadow-lg overflow-hidden">
                <ContextPanel
                  startDate={startDate}
                  endDate={endDate}
                  selectedTopics={topics}
                  keyword={keyword}
                  legislator={legislator}
                  setLegislator={setLegislator}
                  activeTopics={topics}
                  selectedParty={selectedParty}
                />
              </div>
            </div>
          </main>
        </div>
      </BrowserRouter>
    </div>
  );
}