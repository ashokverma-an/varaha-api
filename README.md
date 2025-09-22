# Varaha SDC API

Node.js API for Varaha SDC Hospital Management System - migrated from PHP sdc_admin.

## Features

- **Authentication**: Login with same credentials as sdc_admin
- **Dashboard Stats**: Monthly totals, today's scans, revenue (same logic as blank.php)
- **Patient Reports**: Date-filtered patient data with CSV export capability
- **Console Reports**: Lab bench status and queue management
- **Superadmin Reports**: Complete patient queue with all details
- **Master Data**: Doctors, Hospitals, Scans lists

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password

### Dashboard (General)
- `GET /api/dashboard/stats` - Dashboard statistics (same as blank.php)

### Admin Role
- `GET /api/admin/stats` - Admin dashboard stats
- `GET /api/admin/hospitals` - Hospital management
- `GET /api/admin/doctors` - Doctor management
- `GET /api/admin/patients?status=pending` - Patient management
- `GET /api/admin/daily-revenue?date=DD-MM-YYYY` - Daily revenue

### Doctor Role
- `GET /api/doctor/stats` - Doctor dashboard stats
- `GET /api/doctor/pending-patients` - Pending patient reports
- `GET /api/doctor/patient/:cro` - Patient detail view
- `POST /api/doctor/add-report` - Add patient report
- `GET /api/doctor/daily-report?date=DD-MM-YYYY` - Daily report

### Console Role
- `GET /api/console/stats` - Console queue stats
- `GET /api/console/queue?status=pending` - Console queue management
- `POST /api/console/update-status` - Update patient status
- `GET /api/console/daily-report?date=YYYY-MM-DD` - Console daily report
- `POST /api/console/add-to-queue` - Add patient to queue

### Accounts Role
- `GET /api/accounts/stats` - Accounts dashboard stats
- `GET /api/accounts/transactions?from_date=DD-MM-YYYY&to_date=DD-MM-YYYY` - Payment transactions
- `POST /api/accounts/update-payment` - Update payment status
- `GET /api/accounts/revenue-report?group_by=monthly` - Revenue reports
- `GET /api/accounts/vouchers` - Voucher management

### Superadmin Role
- `GET /api/superadmin/stats` - Superadmin stats
- `GET /api/superadmin/patient-report?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD` - Patient reports

### Reports (General)
- `GET /api/reports/patient-report?from_date=DD-MM-YYYY&to_date=DD-MM-YYYY`
- `GET /api/reports/daily-revenue?date=DD-MM-YYYY`
- `GET /api/reports/console-report?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD`

### Patients (General)
- `GET /api/patients` - All patients (paginated)
- `GET /api/patients/cro/:cro` - Patient by CRO number
- `GET /api/patients/doctors` - All doctors
- `GET /api/patients/hospitals` - All hospitals
- `GET /api/patients/scans` - All scan types

## Deployment to cPanel

1. Upload all files to `/public_html/api/` directory
2. Install Node.js in cPanel
3. Set environment variables in `.env`
4. Start with `node server.js`

## 📚 API Documentation

### Swagger UI
Access interactive API documentation at `/api-docs`

### Features
- **Interactive Testing**: Test all endpoints directly
- **Request/Response Examples**: See sample data
- **Schema Documentation**: Complete data models
- **Role-Based Organization**: Endpoints grouped by user roles

### Quick Links
- **Health Check**: `GET /health`
- **API Status**: `GET /`
- **Documentation**: `GET /api-docs`
- **Usage Guide**: `/docs/api-guide.md`

## Environment Variables

```
DB_HOST=localhost
DB_USER=varaosrc_prc
DB_PASSWORD=PRC!@#456&*(
DB_NAME=varaosrc_hospital_management
DB_PORT=3306
PORT=3001
```

## Usage with Vercel Frontend

Update your Next.js API calls to use this API:

```javascript
// Instead of direct database calls
const response = await fetch('https://varahasdc.co.in/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
```

## Database Queries

All queries are identical to sdc_admin PHP files:
- Dashboard stats from `blank.php`
- Patient reports from `patient_list.php`
- Superadmin reports from `superadmin/patient_report.php`
- Console reports from lab bench queries

## Testing

```bash
npm install
npm run dev

# Test endpoints
curl http://localhost:3001/health
curl -X POST http://localhost:3001/api/auth/login -d '{"username":"superadmin","password":"Super@321"}' -H "Content-Type: application/json"
```