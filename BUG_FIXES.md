# Bug Fixes

## Bug 1: Login Sometimes Fails With Correct Credentials

**What was wrong:**
The bcrypt.compare() function is asynchronous but was being called without await. This meant the variable isValidPassword contained a Promise object instead of true/false. Since Promise objects are truthy, password validation was unreliable.

**Where I found it:**
backend/routes/auth.js, line 28

**How I fixed it:**
```javascript
// Before
const isValidPassword = bcrypt.compare(password, user.password);

// After
const isValidPassword = await bcrypt.compare(password, user.password);
```

**Why this fix is correct:**
Adding await makes the code wait for the actual comparison result. Now isValidPassword contains the real boolean value and password checks work every time.


## Bug 2: Check in Form Doesnt Submit Properly

**What was wrong:**
The handleCheckIn function was missing e.preventDefault(). When the form submitted, the browser did a full page reload which interrupted the API call and reset all React state.

**Where I found it:**
frontend/src/pages/CheckIn.jsx, line 58

**How I fixed it:**
```javascript
// Before
const handleCheckIn = async (e) => {
    setError('');

// After
const handleCheckIn = async (e) => {
    e.preventDefault();
    setError('');
```

**Why this fix is correct:**
preventDefault stops the browser from doing its default form submission. The React code can now handle the submit properly through the API without losing state.


## Bug 3: Dashboard Shows Incorrect Data For Some Users

**What was wrong:**
The code checked if user.id === 1 to decide whether to show manager data. This meant only the user with ID 1 saw the manager dashboard, regardless of their actual role.

**Where I found it:**
frontend/src/pages/Dashboard.jsx, line 15

**How I fixed it:**
```javascript
// Before
const endpoint = user.id === 1 ? '/dashboard/stats' : '/dashboard/employee';

// After
const endpoint = user.role === 'manager' ? '/dashboard/stats' : '/dashboard/employee';
```

**Why this fix is correct:**
Checking user.role instead of user.id means all managers see manager data and all employees see employee data, which is how it should work.


## Bug 4: Attendance History Page Crashes On Load

**What was wrong:**
The totalHours calculation called .reduce() on the checkins array, but checkins is null when the component first loads. Calling reduce on null throws an error.

**Where I found it:**
frontend/src/pages/History.jsx, line 45

**How I fixed it:**
```javascript
// Before
const totalHours = checkins.reduce((total, checkin) => {

// After
const totalHours = (checkins || []).reduce((total, checkin) => {
```

**Why this fix is correct:**
Using (checkins || []) means if checkins is null, we use an empty array instead. The reduce works fine on an empty array and returns 0.


## Bug 5: API Returns Wrong Status Codes

**What was wrong:**
When a required field (client_id) was missing, the API returned HTTP 200 with success: false. HTTP 200 means success, so this was misleading.

**Where I found it:**
backend/routes/checkin.js, line 30

**How I fixed it:**
```javascript
// Before
return res.status(200).json({ success: false, message: 'Client ID is required' });

// After
return res.status(400).json({ success: false, message: 'Client ID is required' });
```

**Why this fix is correct:**
HTTP 400 Bad Request is the right code for validation errors. The frontend can properly detect and handle errors based on status code.


## Bug 6: Location Data Not Saved Correctly

**What was wrong:**
The INSERT statement used wrong column names (lat, lng instead of latitude, longitude). Also found SQL injection vulnerability where dates were concatenated directly into the query string.

**Where I found it:**
backend/routes/checkin.js, lines 56 to 60 (column names), lines 113 to 116 (SQL injection)

**How I fixed it:**
```javascript
// Fixed column names
INSERT INTO checkins (employee_id, client_id, latitude, longitude, distance_from_client, notes, status)

// Fixed SQL injection
query += ` AND DATE(ch.checkin_time) >= ?`;
params.push(start_date);
```

**Why this fix is correct:**
The column names now match the database schema. Using parameterized queries prevents attackers from injecting malicious SQL through the date fields.


## Bug 7: React Components Have Performance Issues

**What was wrong:**
Counter.jsx had three problems:
1. Stale closure: setInterval callback used count directly which gets captured once and never updates
2. Conditional hook: useEffect was inside an if statement which breaks React rules
3. Stale ref: countRef was never updated after initialization

**Where I found it:**
frontend/src/components/Counter.jsx, lines 8 to 21

**How I fixed it:**
```javascript
// Fixed stale closure
setCount(c => c + 1);  // functional update instead of count + 1

// Fixed conditional hook
useEffect(() => {
    if (showDouble) {
        console.log('Double value:', count * 2);
    }
}, [count, showDouble]);  // condition inside, not outside

// Fixed stale ref
useEffect(() => {
    countRef.current = count;
}, [count]);  // keep ref in sync
```

**Why this fix is correct:**
Functional updates always use the latest state value. Hooks must be called unconditionally every render. The ref now stays synchronized with the actual count.
