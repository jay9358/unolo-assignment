# Technical Questions & Answers

## Question 1: Scaling to 10,000 Simultaneous Check-ins

**If this app had 10,000 employees checking in simultaneously, what would break first? How would you fix it?**

### What would break first: SQLite Database

SQLite uses a single-writer lock, meaning only one write operation can occur at a time. With 10,000 concurrent check-ins:
- Write operations would queue up causing massive latency (seconds to minutes per request)
- Connection pool would exhaust
- Request timeouts would cascade into failures

### Fixes (in order of priority)

1. **Replace SQLite with PostgreSQL/MySQL** - These support concurrent writes with row-level locking. Immediate gain: hundreds of simultaneous writes.

2. **Add connection pooling** - Use a pool of ~20-50 connections shared across requests instead of creating new connections per request.

3. **Implement a write queue** - Use Redis or RabbitMQ to queue check-in requests. Workers process them asynchronously, returning immediate acknowledgment to clients.

4. **Horizontal scaling** - Run multiple API server instances behind a load balancer (nginx/AWS ALB). Database becomes the shared state layer.

5. **Read replicas** - For dashboard/stats queries, use read replicas to offload the primary database.

In this codebase, I'd start by swapping `better-sqlite3` for `pg` (PostgreSQL) in `backend/config/database.js` and updating the SQL syntax (e.g., `NOW()` → `CURRENT_TIMESTAMP`, parameterized queries stay the same).

---

## Question 2: JWT Security Issue

**The current JWT implementation has a security issue. What is it and how would you improve it?**

### Security Issues Identified

1. **No token invalidation mechanism** - Once issued, a JWT is valid for 24 hours. If a user logs out, their token still works. If credentials are compromised, there's no way to revoke access.

2. **Token stored in localStorage** - Vulnerable to XSS attacks. Any malicious script can steal the token.

3. **Fixed secret in middleware** - `middleware/auth.js` line 3 has a hardcoded fallback secret (`'default-secret-key'`). If `.env` is missing, all tokens use the same weak secret.

### Improvements

1. **Token blacklist for logout** - Store invalidated tokens in Redis with TTL matching expiry. Check blacklist on each request.

2. **Short-lived access tokens + refresh tokens** - Issue access tokens with 15-minute expiry and refresh tokens with 7-day expiry. Store refresh tokens securely (httpOnly cookie).

3. **Use httpOnly cookies** - Move token from localStorage to an httpOnly cookie. XSS attacks cannot access httpOnly cookies via JavaScript.

4. **Remove the default secret fallback** - Fail loudly if `JWT_SECRET` is not set rather than using a weak default.

```javascript
// middleware/auth.js - improved
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
```

---

## Question 3: Offline Check-in Support

**How would you implement offline check-in support? (Employee has no internet, checks in, syncs later)**

### Implementation Strategy

1. **Client-side storage (IndexedDB)**
   ```javascript
   // Use IndexedDB to store pending check-ins
   const pendingCheckin = {
       id: crypto.randomUUID(),
       client_id: selectedClient,
       latitude: location.latitude,
       longitude: location.longitude,
       timestamp: Date.now(),
       synced: false
   };
   await db.pendingCheckins.add(pendingCheckin);
   ```

2. **Service Worker for background sync**
   ```javascript
   // Register for background sync when online
   self.addEventListener('sync', (event) => {
       if (event.tag === 'sync-checkins') {
           event.waitUntil(syncPendingCheckins());
       }
   });
   ```

3. **Conflict resolution** - Use the client-side timestamp as the canonical check-in time. Server validates but accepts historic timestamps within a reasonable window (e.g., 24 hours).

4. **API changes**
   - Accept `checkin_time` parameter in POST /api/checkin
   - Return `local_id` matching client's UUID for confirmation
   - Add endpoint `POST /api/checkin/batch` for bulk sync

5. **UI feedback** - Show pending check-ins with a "not synced" indicator. When online, show sync progress.

---

## Question 4: SQL vs NoSQL for This Application

**Explain the difference between SQL and NoSQL databases. For this Field Force Tracker application, which would you recommend and why?**

### Key Differences

| Aspect | SQL (PostgreSQL, MySQL) | NoSQL (MongoDB, DynamoDB) |
|--------|------------------------|---------------------------|
| Schema | Fixed, predefined schema | Flexible, dynamic schema |
| Relationships | Strong foreign keys, JOINs | Embedded documents or references |
| Scaling | Vertical primarily, read replicas | Horizontal sharding built-in |
| Transactions | Full ACID support | Varies (MongoDB has multi-doc transactions) |
| Query power | Complex aggregations, subqueries | Simpler queries, aggregation pipelines |

### Recommendation: SQL (PostgreSQL)

**Reasons specific to this codebase:**

1. **Relational data model** - Users → Managers, Employees → Clients, Check-ins. These are naturally relational with foreign keys. The current schema uses `manager_id`, `employee_id`, `client_id` references.

2. **Complex queries needed** - The daily summary report (`/api/reports/daily-summary`) requires JOINs across users, check-ins, and clients with GROUP BY and date filtering. SQL handles this in a single query.

3. **Aggregations for reporting** - COUNT, SUM, AVG for hours worked, clients visited. SQL's aggregation functions are mature and efficient.

4. **Data integrity** - ACID transactions ensure a check-in is either fully recorded or not at all. Critical for attendance tracking.

5. **Current codebase** - Already uses SQL patterns. Migration to PostgreSQL from SQLite requires minimal changes (mostly driver and syntax adjustments).

**When NoSQL would make sense:** If check-in data became semi-structured (varying metadata per client), or if we needed extreme write throughput with less complex queries, MongoDB could work. But for core transactional data with reporting needs, SQL is the better fit.

---

## Question 5: Authentication vs Authorization

**What is the difference between authentication and authorization? Identify where each is implemented in this codebase.**

### Definitions

- **Authentication**: Verifying WHO you are (identity). "Are you who you claim to be?"
- **Authorization**: Verifying WHAT you can do (permissions). "Are you allowed to access this resource?"

### Implementation in This Codebase

**Authentication:**
- `backend/routes/auth.js` `/login` - Verifies email/password, issues JWT
- `backend/middleware/auth.js` `authenticateToken()` - Validates JWT signature and extracts user identity from token

```javascript
// Authentication - verifying identity
jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;  // Identity established
    next();
});
```

**Authorization:**
- `backend/middleware/auth.js` `requireManager()` - Checks if authenticated user has manager role
- `backend/routes/checkin.js` line 34-41 - Checks if employee is assigned to the client they're checking into

```javascript
// Authorization - checking permissions
const requireManager = (req, res, next) => {
    if (req.user.role !== 'manager') {  // User already authenticated
        return res.status(403).json({ message: 'Manager access required' });
    }
    next();
};
```

**Key distinction in this app:** 
- The `/api/dashboard/stats` endpoint uses both: `authenticateToken` (authentication) then `requireManager` (authorization)
- The `/api/checkin` endpoint uses `authenticateToken` (authentication) then checks `employee_clients` table (data-level authorization)

---

## Question 6: Race Conditions

**Explain what a race condition is. Can you identify any potential race conditions in this codebase? How would you prevent them?**

### What is a Race Condition?

A race condition occurs when multiple operations access shared data concurrently, and the result depends on the order/timing of execution. This leads to unpredictable behavior where the "wrong" operation might win the race.

### Potential Race Condition in This Codebase

**Location:** `backend/routes/checkin.js` lines 43-54

```javascript
// Check for existing active check-in
const [activeCheckins] = await pool.execute(
    'SELECT * FROM checkins WHERE employee_id = ? AND status = "checked_in"',
    [req.user.id]
);

if (activeCheckins.length > 0) {
    return res.status(400).json({ message: 'You already have an active check-in...' });
}

// Time gap here where another request could check the same thing

const [result] = await pool.execute(
    `INSERT INTO checkins (employee_id, ...) VALUES (?, ...)`,
    [req.user.id, ...]
);
```

**The race:** If an employee double-clicks the check-in button (or has a script), two requests could:
1. Both check for active check-ins simultaneously → both see none
2. Both proceed to INSERT → employee ends up with two active check-ins

### Prevention Strategies

1. **Database constraint (preferred)**
   ```sql
   CREATE UNIQUE INDEX idx_active_checkin 
   ON checkins (employee_id) 
   WHERE status = 'checked_in';
   ```
   The database enforces only one active check-in per employee.

2. **Transaction with row locking**
   ```javascript
   await pool.execute('BEGIN TRANSACTION');
   const [active] = await pool.execute(
       'SELECT * FROM checkins WHERE employee_id = ? AND status = "checked_in" FOR UPDATE',
       [req.user.id]
   );
   // ... insert if none found
   await pool.execute('COMMIT');
   ```

3. **Optimistic locking** - Use a version number on records. If the version changed between read and write, retry or fail.

4. **Frontend debouncing** - Disable the submit button after click and use a loading state (already partially implemented in `CheckIn.jsx`).

For this codebase, I'd add a partial unique index (option 1) since it's the simplest and pushes enforcement to the database layer.
