import React, { useState, useEffect } from 'react';
import API from '../services/api';
import StatsCard from '../components/StatsCard';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import StudentDocumentImportModal from '../components/StudentDocumentImportModal';
import { 
  Clock, 
  X, 
  Search, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Filter,
  Upload
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalQuizzes: number;
  activeExams: number;
  violationsToday: number;
  generatedQuestions: number;
  totalQuestions: number;
  totalAttempts: number;
  scoreDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

interface RecentAttempt {
  _id: string;
  user: {
    name: string;
    email: string;
  };
  quiz: {
    title: string;
    isAdaptive: boolean;
  };
  score: number;
  totalQuestions: number;
  percentage: number;
  createdAt: string;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Drill-down modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMetric, setModalMetric] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Modal Table States
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterValue, setFilterValue] = useState<string>('ALL');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await API.get('/attempts/stats');
        setStats(response.data.stats);
        setRecentAttempts(response.data.recentAttempts || []);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading dashboard statistics');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const openDrillDown = async (metric: string, title: string) => {
    setModalMetric(metric);
    setModalTitle(title);
    setModalOpen(true);
    setModalLoading(true);
    setSearchQuery('');
    setCurrentPage(1);
    setSortField('');
    setSortOrder('asc');
    setFilterValue('ALL');
    try {
      const response = await API.get(`/analytics/dashboard-drilldown?metric=${metric}`);
      setModalData(response.data.list || []);
    } catch (err: any) {
      console.error('Error loading drilldown details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Memoized filtered & sorted data
  const processedData = React.useMemo(() => {
    let result = [...modalData];

    // 1. Search Query Filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => {
        if (modalMetric === 'students') {
          return (
            item.name?.toLowerCase().includes(query) ||
            item.email?.toLowerCase().includes(query)
          );
        } else if (modalMetric === 'quizzes') {
          return (
            item.title?.toLowerCase().includes(query) ||
            item.topic?.toLowerCase().includes(query) ||
            item.createdBy?.toLowerCase().includes(query)
          );
        } else if (modalMetric === 'active-exams') {
          return (
            item.studentName?.toLowerCase().includes(query) ||
            item.studentEmail?.toLowerCase().includes(query) ||
            item.quizTitle?.toLowerCase().includes(query)
          );
        } else if (modalMetric === 'violations') {
          return (
            item.studentName?.toLowerCase().includes(query) ||
            item.studentEmail?.toLowerCase().includes(query) ||
            item.quizTitle?.toLowerCase().includes(query) ||
            item.eventType?.toLowerCase().includes(query)
          );
        } else if (modalMetric === 'ai-questions') {
          return (
            item.questionText?.toLowerCase().includes(query) ||
            item.topic?.toLowerCase().includes(query) ||
            item.explanation?.toLowerCase().includes(query)
          );
        }
        return false;
      });
    }

    // 2. Dropdown Status Filter
    if (filterValue !== 'ALL') {
      result = result.filter((item) => {
        if (modalMetric === 'students') {
          return item.role === filterValue;
        } else if (modalMetric === 'quizzes') {
          return item.isAdaptive === (filterValue === 'Adaptive');
        } else if (modalMetric === 'violations') {
          return item.eventType === filterValue;
        } else if (modalMetric === 'ai-questions') {
          return item.difficulty === filterValue;
        }
        return true;
      });
    }

    // 3. Header Sorting
    if (sortField !== '') {
      result.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = (valB || '').toLowerCase();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [modalData, modalMetric, searchQuery, filterValue, sortField, sortOrder]);

  // Paginated Data
  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedData.slice(startIndex, startIndex + itemsPerPage);
  }, [processedData, currentPage]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage) || 1;

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Admin Overview</h2>
          <p className="text-sm text-gray-400 font-medium mt-1">
            Monitor platforms stats, users, quizzes, and learning attempts. Click on any metric card for a detailed drill-down report.
          </p>
        </div>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/25 shrink-0 self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Import Student Document</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatsCard
          title="Total Students"
          value={stats?.totalUsers || 0}
          iconName="Users"
          color="indigo"
          description="Registered student profiles"
          onClick={() => openDrillDown('students', 'Registered Students')}
        />
        <StatsCard
          title="Total Quizzes"
          value={stats?.totalQuizzes || 0}
          iconName="GraduationCap"
          color="emerald"
          description="Static and adaptive quizzes"
          onClick={() => openDrillDown('quizzes', 'Quiz Bank Overview')}
        />
        <StatsCard
          title="Active Exams"
          value={stats?.activeExams || 0}
          iconName="Activity"
          color="purple"
          description="Currently active sessions"
          onClick={() => openDrillDown('active-exams', 'Active Proctored Exams')}
        />
        <StatsCard
          title="Violations Today"
          value={stats?.violationsToday || 0}
          iconName="AlertTriangle"
          color="pink"
          description="Exam security incidents"
          onClick={() => openDrillDown('violations', 'Violation Incidents Logs')}
        />
        <StatsCard
          title="AI Questions"
          value={stats?.generatedQuestions || 0}
          iconName="FileText"
          color="amber"
          description="AI-generated bank"
          onClick={() => openDrillDown('ai-questions', 'AI Generated Questions')}
        />
      </div>

      {/* Split Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Attempts */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <span>Recent Quiz Attempts</span>
          </h3>

          <GlassCard className="border border-white/5 p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/3 text-gray-400 border-b border-white/5 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Quiz Name</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Result</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                  {recentAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                        No quiz attempts recorded yet
                      </td>
                    </tr>
                  ) : (
                    recentAttempts.map((attempt) => (
                      <tr key={attempt._id} className="hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-white">{attempt.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{attempt.user?.email}</p>
                        </td>
                        <td className="px-6 py-4 font-medium">{attempt.quiz?.title || 'Removed Quiz'}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                              attempt.quiz?.isAdaptive
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                            }`}
                          >
                            {attempt.quiz?.isAdaptive ? 'Adaptive' : 'Static'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-right sm:text-left">
                          <span
                            className={
                              attempt.percentage >= 80
                                ? 'text-emerald-400'
                                : attempt.percentage >= 50
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }
                          >
                            {attempt.score}/{attempt.totalQuestions} ({attempt.percentage}%)
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {new Date(attempt.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        {/* Score Distribution Summary */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white tracking-tight">Score Distribution</h3>
          <GlassCard className="border border-white/5 space-y-6">
            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                <span>Pass with Honors (&ge;80%)</span>
                <span className="text-emerald-400 font-bold">{stats?.scoreDistribution.high || 0} attempts</span>
              </div>
              <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full"
                  style={{
                    width: `${
                      stats?.totalAttempts
                        ? (stats.scoreDistribution.high / stats.totalAttempts) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                <span>Passed (&ge;50% &amp; &lt;80%)</span>
                <span className="text-amber-400 font-bold">{stats?.scoreDistribution.medium || 0} attempts</span>
              </div>
              <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-2.5 rounded-full"
                  style={{
                    width: `${
                      stats?.totalAttempts
                        ? (stats.scoreDistribution.medium / stats.totalAttempts) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                <span>Needs Improvement (&lt;50%)</span>
                <span className="text-red-400 font-bold">{stats?.scoreDistribution.low || 0} attempts</span>
              </div>
              <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-red-500 h-2.5 rounded-full"
                  style={{
                    width: `${
                      stats?.totalAttempts
                        ? (stats.scoreDistribution.low / stats.totalAttempts) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 text-center">
              <p className="text-xs text-gray-500 font-medium">
                Distribution metrics based on total completed student records.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Drill-down Detail Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <GlassCard className="w-full max-w-5xl border border-white/10 max-h-[85vh] flex flex-col shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white">{modalTitle}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Displaying {processedData.length} records found in database
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filters Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 px-6 py-4 border-b border-white/5 bg-white/1 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search current records..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-[#0a0f18] border border-white/10 rounded-lg text-xs text-white pl-10 pr-4 py-2.5 outline-none focus:border-indigo-500 transition-all font-semibold"
                />
              </div>

              {/* Metric-specific Filters */}
              {modalMetric === 'students' && (
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-indigo-400" />
                  <select
                    value={filterValue}
                    onChange={(e) => {
                      setFilterValue(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[#0a0f18] border border-white/10 rounded-lg text-xs text-gray-300 px-3 py-2 outline-none font-semibold"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}

              {modalMetric === 'quizzes' && (
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-indigo-400" />
                  <select
                    value={filterValue}
                    onChange={(e) => {
                      setFilterValue(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[#0a0f18] border border-white/10 rounded-lg text-xs text-gray-300 px-3 py-2 outline-none font-semibold"
                  >
                    <option value="ALL">All Quiz Types</option>
                    <option value="Static">Static</option>
                    <option value="Adaptive">Adaptive</option>
                  </select>
                </div>
              )}

              {modalMetric === 'violations' && (
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-indigo-400" />
                  <select
                    value={filterValue}
                    onChange={(e) => {
                      setFilterValue(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[#0a0f18] border border-white/10 rounded-lg text-xs text-gray-300 px-3 py-2 outline-none font-semibold"
                  >
                    <option value="ALL">All Incidents</option>
                    <option value="TAB_SWITCH">Tab Switches</option>
                    <option value="FOCUS_LOSS">Focus Loss</option>
                    <option value="COPY_ATTEMPT">Copy Attempts</option>
                    <option value="PASTE_ATTEMPT">Paste Attempts</option>
                    <option value="SCREENSHOT_ATTEMPT">Screenshots</option>
                    <option value="FULLSCREEN_EXIT">Fullscreen Exits</option>
                    <option value="FACE_NOT_DETECTED">Face Lost</option>
                    <option value="MULTIPLE_FACES_DETECTED">Multiple Faces</option>
                  </select>
                </div>
              )}

              {modalMetric === 'ai-questions' && (
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-indigo-400" />
                  <select
                    value={filterValue}
                    onChange={(e) => {
                      setFilterValue(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[#0a0f18] border border-white/10 rounded-lg text-xs text-gray-300 px-3 py-2 outline-none font-semibold"
                  >
                    <option value="ALL">All Difficulties</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              )}
            </div>

            {/* Modal Content Table */}
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              {modalLoading ? (
                <div className="h-full flex items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#0e1420] border-b border-white/10 text-gray-400 font-bold uppercase tracking-wider z-10">
                    {modalMetric === 'students' && (
                      <tr>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('name')} className="flex items-center gap-1">Name <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('email')} className="flex items-center gap-1">Email <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1">Registration Date <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('role')} className="flex items-center gap-1">Role <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('lastActive')} className="flex items-center gap-1">Last Active <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('quizzesAttempted')} className="flex items-center gap-1">Quizzes Attempted <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('averageScore')} className="flex items-center gap-1">Average Score <ArrowUpDown className="w-3 h-3" /></button></th>
                      </tr>
                    )}
                    {modalMetric === 'quizzes' && (
                      <tr>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('title')} className="flex items-center gap-1">Quiz Title <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('topic')} className="flex items-center gap-1">Topic <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('isAdaptive')} className="flex items-center gap-1">Type <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('totalQuestions')} className="flex items-center gap-1">Total Questions <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('attemptsCount')} className="flex items-center gap-1">Attempts Count <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('createdBy')} className="flex items-center gap-1">Created By <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1">Creation Date <ArrowUpDown className="w-3 h-3" /></button></th>
                      </tr>
                    )}
                    {modalMetric === 'active-exams' && (
                      <tr>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('studentName')} className="flex items-center gap-1">Student <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('quizTitle')} className="flex items-center gap-1">Exam <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('loginTime')} className="flex items-center gap-1">Login Time <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('lastActive')} className="flex items-center gap-1">Last Active <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5">Allowed Tab Switches</th>
                        <th className="px-6 py-3.5">Auto Submit Threshold</th>
                      </tr>
                    )}
                    {modalMetric === 'violations' && (
                      <tr>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('studentName')} className="flex items-center gap-1">Student <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('quizTitle')} className="flex items-center gap-1">Quiz <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('eventType')} className="flex items-center gap-1">Violation Event <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('timestamp')} className="flex items-center gap-1">Timestamp <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5">Details</th>
                      </tr>
                    )}
                    {modalMetric === 'ai-questions' && (
                      <tr>
                        <th className="px-6 py-3.5">Question Text</th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('topic')} className="flex items-center gap-1">Topic <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('difficulty')} className="flex items-center gap-1">Difficulty <ArrowUpDown className="w-3 h-3" /></button></th>
                        <th className="px-6 py-3.5">Options</th>
                        <th className="px-6 py-3.5">Explanation</th>
                        <th className="px-6 py-3.5"><button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1">Created At <ArrowUpDown className="w-3 h-3" /></button></th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                          No matching records found
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((item, idx) => {
                        if (modalMetric === 'students') {
                          return (
                            <tr key={item._id || idx} className="hover:bg-white/2 transition-colors">
                              <td className="px-6 py-4 text-white font-bold">{item.name}</td>
                              <td className="px-6 py-4 font-mono">{item.email}</td>
                              <td className="px-6 py-4 text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                                  item.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                }`}>
                                  {item.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-400">{new Date(item.lastActive).toLocaleString()}</td>
                              <td className="px-6 py-4 font-mono font-bold text-center sm:text-left">{item.quizzesAttempted}</td>
                              <td className="px-6 py-4 font-bold font-mono" style={{ color: item.averageScore >= 80 ? '#10b981' : item.averageScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                                {item.averageScore}%
                              </td>
                            </tr>
                          );
                        } else if (modalMetric === 'quizzes') {
                          return (
                            <tr key={item._id || idx} className="hover:bg-white/2 transition-colors">
                              <td className="px-6 py-4 text-white font-bold">{item.title}</td>
                              <td className="px-6 py-4 capitalize font-semibold text-indigo-400">{item.topic}</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                                  item.isAdaptive ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                }`}>
                                  {item.isAdaptive ? 'Adaptive' : 'Static'}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono">{item.totalQuestions}</td>
                              <td className="px-6 py-4 font-mono font-bold text-white">{item.attemptsCount}</td>
                              <td className="px-6 py-4 font-medium text-gray-400">{item.createdBy}</td>
                              <td className="px-6 py-4 text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</td>
                            </tr>
                          );
                        } else if (modalMetric === 'active-exams') {
                          return (
                            <tr key={item._id || idx} className="hover:bg-white/2 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-bold text-white">{item.studentName}</p>
                                <p className="text-[10px] text-gray-500">{item.studentEmail}</p>
                              </td>
                              <td className="px-6 py-4 text-white font-semibold">{item.quizTitle}</td>
                              <td className="px-6 py-4 text-gray-400">{new Date(item.loginTime).toLocaleTimeString()}</td>
                              <td className="px-6 py-4 text-gray-400">{new Date(item.lastActive).toLocaleTimeString()}</td>
                              <td className="px-6 py-4 text-center sm:text-left">{item.allowedTabSwitches}</td>
                              <td className="px-6 py-4 text-center sm:text-left">{item.autoSubmitThreshold}</td>
                            </tr>
                          );
                        } else if (modalMetric === 'violations') {
                          return (
                            <tr key={item._id || idx} className="hover:bg-white/2 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-bold text-white">{item.studentName}</p>
                                <p className="text-[10px] text-gray-500 font-mono">{item.studentEmail}</p>
                              </td>
                              <td className="px-6 py-4 text-white font-medium">{item.quizTitle}</td>
                              <td className="px-6 py-4">
                                <span className="text-[9px] font-extrabold uppercase bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded">
                                  {item.eventType.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono text-gray-400">{new Date(item.timestamp).toLocaleString()}</td>
                              <td className="px-6 py-4 text-gray-500 font-mono text-[10px]">
                                {item.metadata?.notes || JSON.stringify(item.metadata || {})}
                              </td>
                            </tr>
                          );
                        } else if (modalMetric === 'ai-questions') {
                          return (
                            <tr key={item._id || idx} className="hover:bg-white/2 transition-colors">
                              <td className="px-6 py-4 text-white font-semibold max-w-xs break-words">{item.questionText}</td>
                              <td className="px-6 py-4 capitalize font-bold text-indigo-400">{item.topic}</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                                  item.difficulty === 'expert' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  item.difficulty === 'hard' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                  item.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                  {item.difficulty}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-gray-400">
                                  {item.options.map((opt: string, oIdx: number) => (
                                    <li key={oIdx} className={oIdx === item.correctAnswer ? 'text-emerald-400 font-bold' : ''}>
                                      {opt}
                                    </li>
                                  ))}
                                </ol>
                              </td>
                              <td className="px-6 py-4 text-gray-400 max-w-xs break-words">{item.explanation}</td>
                              <td className="px-6 py-4 text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</td>
                            </tr>
                          );
                        }
                        return null;
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer Pagination Controls */}
            <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 bg-white/2 flex-shrink-0">
              <span className="text-xs text-gray-400">
                Showing Page <strong className="text-white font-bold">{currentPage}</strong> of <strong className="text-white font-bold">{totalPages}</strong>
              </span>

              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || modalLoading}
                  className="p-2 rounded-lg bg-[#0a0f18] text-gray-400 hover:text-white border border-white/10 disabled:opacity-30 disabled:hover:text-gray-400 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || modalLoading}
                  className="p-2 rounded-lg bg-[#0a0f18] text-gray-400 hover:text-white border border-white/10 disabled:opacity-30 disabled:hover:text-gray-400 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </GlassCard>
        </div>
      )}

      {/* Bulk Student Document Import Modal */}
      <StudentDocumentImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          // Refresh dashboard metrics
          API.get('/attempts/stats').then((res) => {
            setStats(res.data.stats);
          }).catch(() => {});
        }}
      />
    </div>
  );
};

export default AdminDashboard;
