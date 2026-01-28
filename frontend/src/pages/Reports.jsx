import { useState } from 'react';
import api from '../utils/api';

function Reports({ user }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchReport = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get(`/reports/daily-summary?date=${date}`);
            if (response.data.success) {
                setReport(response.data.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Daily Summary Report</h2>

            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex gap-4 items-end">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                    >
                        {loading ? 'Loading...' : 'Generate Report'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {report && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-500">Total Employees</p>
                            <p className="text-2xl font-bold text-blue-600">{report.team_summary.total_employees}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-500">Checked In</p>
                            <p className="text-2xl font-bold text-green-600">{report.team_summary.employees_checked_in}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-500">Total Check-ins</p>
                            <p className="text-2xl font-bold text-purple-600">{report.team_summary.total_checkins}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-500">Total Hours</p>
                            <p className="text-2xl font-bold text-orange-600">{report.team_summary.total_hours_worked}h</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow">
                        <h3 className="text-lg font-semibold p-4 border-b">Employee Breakdown</h3>
                        {report.employee_breakdown.length > 0 ? (
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Check-ins</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Clients Visited</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Hours Worked</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.employee_breakdown.map((emp) => (
                                        <tr key={emp.employee_id} className="border-t hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div>{emp.employee_name}</div>
                                                <div className="text-xs text-gray-500">{emp.employee_email}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs ${emp.total_checkins > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                                    {emp.total_checkins}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">{emp.clients_visited}</td>
                                            <td className="px-4 py-3">{emp.hours_worked}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                No employee data for this date
                            </div>
                        )}
                    </div>
                </>
            )}

            {!report && !loading && !error && (
                <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                    Select a date and click Generate Report to view the daily summary
                </div>
            )}
        </div>
    );
}

export default Reports;
