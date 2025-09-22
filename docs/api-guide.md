# Varaha SDC API Usage Guide

## 🚀 Quick Start

### Base URL
- **Production**: `https://varahasdc.co.in/api`
- **Development**: `http://localhost:3001`

### Documentation
- **Swagger UI**: `/api-docs`
- **Interactive API Testing**: Available at `/api-docs`

## 🔐 Authentication

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "superadmin",
  "password": "Super@321"
}
```

### Available Users
| Username | Password | Role | Access Level |
|----------|----------|------|--------------|
| superadmin | Super@321 | superadmin | Full system access |
| admin | Admin@Varaha | admin | Hospital/Doctor management |
| reception | Admin@321 | reception | Patient registration |
| doctor | Admin@321 | doctor | Patient reports |
| console | Admin@321 | console | Queue management |
| accounts | Admin@321 | accounts | Financial management |

## 📊 Role-Based Endpoints

### 👑 Superadmin (`/api/superadmin/`)
```bash
# Dashboard stats
GET /api/superadmin/stats

# Patient reports with date filter
GET /api/superadmin/patient-report?from_date=2024-01-01&to_date=2024-01-31
```

### 🏥 Admin (`/api/admin/`)
```bash
# Admin dashboard
GET /api/admin/stats

# Hospital management
GET /api/admin/hospitals

# Doctor management  
GET /api/admin/doctors

# Patient management
GET /api/admin/patients?status=pending

# Daily revenue
GET /api/admin/daily-revenue?date=15-01-2024
```

### 👨⚕️ Doctor (`/api/doctor/`)
```bash
# Doctor dashboard
GET /api/doctor/stats

# Pending patients
GET /api/doctor/pending-patients

# Patient details
GET /api/doctor/patient/CRO001

# Add patient report
POST /api/doctor/add-report
{
  "cro": "CRO001",
  "report_detail": "CT scan completed",
  "remark": "Normal findings"
}

# Daily report
GET /api/doctor/daily-report?date=15-01-2024
```

### 🖥️ Console (`/api/console/`)
```bash
# Console stats
GET /api/console/stats

# Queue management
GET /api/console/queue?status=pending

# Update patient status
POST /api/console/update-status
{
  "cro": "CRO001",
  "status": 1,
  "remark": "Scan completed"
}

# Daily report
GET /api/console/daily-report?date=2024-01-15

# Add to queue
POST /api/console/add-to-queue
{
  "cro": "CRO001"
}
```

### 💰 Accounts (`/api/accounts/`)
```bash
# Accounts dashboard
GET /api/accounts/stats

# Payment transactions
GET /api/accounts/transactions?from_date=01-01-2024&to_date=31-01-2024

# Update payment
POST /api/accounts/update-payment
{
  "cro": "CRO001",
  "received_amount": 1500,
  "due_amount": 0,
  "payment_method": "cash",
  "remark": "Full payment"
}

# Revenue report
GET /api/accounts/revenue-report?group_by=monthly

# Vouchers
GET /api/accounts/vouchers
```

## 💡 Usage Examples

### JavaScript/Fetch
```javascript
// Login
const login = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'superadmin', password: 'Super@321' })
});

// Get patient report
const report = await fetch('/api/reports/patient-report?from_date=01-01-2024&to_date=31-01-2024');
const data = await report.json();
```

### cURL
```bash
# Login
curl -X POST https://varahasdc.co.in/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Super@321"}'

# Get dashboard stats
curl https://varahasdc.co.in/api/dashboard/stats
```

## 🔍 Interactive Testing

Visit `/api-docs` for interactive API testing with Swagger UI.