const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/reports/daily-summary
 * Get daily summary report for manager's team
 * Query params:
 *   - date (required): YYYY-MM-DD format
 *   - employee_id (optional): Filter by specific employee
 */
router.get('/daily-summary', authenticateToken, requireManager, async (req, res) => {
    try {
        const { date, employee_id } = req.query;

        // Validate date parameter
        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date parameter is required (YYYY-MM-DD format)'
            });
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        // Build query for employee breakdown
        let employeeQuery = `
            SELECT 
                u.id as employee_id,
                u.name as employee_name,
                u.email as employee_email,
                COUNT(ch.id) as total_checkins,
                COUNT(DISTINCT ch.client_id) as clients_visited,
                COALESCE(SUM(
                    CASE 
                        WHEN ch.checkout_time IS NOT NULL 
                        THEN (julianday(ch.checkout_time) - julianday(ch.checkin_time)) * 24
                        ELSE 0 
                    END
                ), 0) as hours_worked
            FROM users u
            LEFT JOIN checkins ch ON u.id = ch.employee_id 
                AND DATE(ch.checkin_time) = ?
            WHERE u.manager_id = ? AND u.role = 'employee'
        `;
        const params = [date, req.user.id];

        if (employee_id) {
            employeeQuery += ' AND u.id = ?';
            params.push(employee_id);
        }

        employeeQuery += ' GROUP BY u.id, u.name, u.email ORDER BY u.name';

        const [employees] = await pool.execute(employeeQuery, params);

        // Calculate team-level aggregates
        const teamSummary = {
            total_employees: employees.length,
            employees_checked_in: employees.filter(e => e.total_checkins > 0).length,
            total_checkins: employees.reduce((sum, e) => sum + e.total_checkins, 0),
            total_hours_worked: Math.round(employees.reduce((sum, e) => sum + e.hours_worked, 0) * 10) / 10,
            unique_clients_visited: 0
        };

        // Get unique clients count for the day (separate query for accuracy)
        const [uniqueClients] = await pool.execute(`
            SELECT COUNT(DISTINCT ch.client_id) as unique_clients
            FROM checkins ch
            INNER JOIN users u ON ch.employee_id = u.id
            WHERE u.manager_id = ? AND DATE(ch.checkin_time) = ?
        `, [req.user.id, date]);

        teamSummary.unique_clients_visited = uniqueClients[0]?.unique_clients || 0;

        // Format employee breakdown
        const employeeBreakdown = employees.map(emp => ({
            employee_id: emp.employee_id,
            employee_name: emp.employee_name,
            employee_email: emp.employee_email,
            total_checkins: emp.total_checkins,
            clients_visited: emp.clients_visited,
            hours_worked: Math.round(emp.hours_worked * 10) / 10
        }));

        res.json({
            success: true,
            data: {
                date: date,
                team_summary: teamSummary,
                employee_breakdown: employeeBreakdown
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate daily summary report'
        });
    }
});

module.exports = router;
