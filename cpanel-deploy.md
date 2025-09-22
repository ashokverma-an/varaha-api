# Deploy Varaha API to cPanel

## 📋 Prerequisites

### 1. cPanel MySQL Database Setup
- Database Name: `varaosrc_hospital_management`
- Database User: `varaosrc_prc`
- Database Password: `PRC!@#456&*(`
- Host: `localhost` (internal cPanel access)

### 2. Node.js Setup in cPanel
1. Go to cPanel → Software → Node.js
2. Create Node.js App:
   - Node.js Version: 18.x or higher
   - Application Mode: Production
   - Application Root: `/public_html/api`
   - Application URL: `varahasdc.co.in/api`

## 🚀 Deployment Steps

### Step 1: Upload Files
Upload all API files to `/public_html/api/` directory:
```
/public_html/api/
├── server.js
├── package.json
├── .env
├── swagger.js
├── routes/
│   ├── auth.js
│   ├── admin.js
│   ├── doctor.js
│   ├── console.js
│   ├── accounts.js
│   ├── superadmin.js
│   ├── dashboard.js
│   ├── patients.js
│   └── reports.js
└── docs/
```

### Step 2: Install Dependencies
In cPanel Terminal or File Manager:
```bash
cd /public_html/api
npm install
```

### Step 3: Test Database Connection
```bash
node test-db.js
```

### Step 4: Start Application
In cPanel Node.js interface:
- Click "Start App"
- Or manually: `node server.js`

## 🔧 Environment Configuration

### Production .env file:
```env
# cPanel MySQL Configuration
DB_HOST=localhost
DB_USER=varaosrc_prc
DB_PASSWORD=PRC!@#456&*(
DB_NAME=varaosrc_hospital_management
DB_PORT=3306

# API Configuration
PORT=3001
NODE_ENV=production
```

## 🌐 Access Points

After deployment:
- **API Base**: `https://varahasdc.co.in/api`
- **Documentation**: `https://varahasdc.co.in/api/api-docs`
- **Health Check**: `https://varahasdc.co.in/api/health`

## 🔐 Test Authentication

### Test Login:
```bash
curl -X POST https://varahasdc.co.in/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Super@321"}'
```

### Test Dashboard:
```bash
curl https://varahasdc.co.in/api/dashboard/stats
```

## 📊 Available Endpoints

### All Roles:
- `POST /api/auth/login` - Authentication
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/patients/cro/:cro` - Patient by CRO
- `GET /api/reports/patient-report` - Patient reports

### Role-Specific:
- **Admin**: `/api/admin/*` - Hospital/Doctor management
- **Doctor**: `/api/doctor/*` - Patient reports
- **Console**: `/api/console/*` - Queue management
- **Accounts**: `/api/accounts/*` - Financial management
- **Superadmin**: `/api/superadmin/*` - System-wide access

## 🔍 Troubleshooting

### Common Issues:

1. **Database Connection Failed**
   - Check MySQL credentials in cPanel
   - Verify database exists and user has permissions
   - Test with `node test-db.js`

2. **Port Already in Use**
   - Change PORT in .env file
   - Restart Node.js app in cPanel

3. **Module Not Found**
   - Run `npm install` in application directory
   - Check Node.js version compatibility

### Debug Commands:
```bash
# Test database connection
node test-db.js

# Check API syntax
node -c server.js

# View logs
tail -f logs/nodejs.log
```

## 🎯 Integration with Frontend

Update your Next.js/React frontend to use the live API:

```javascript
// Replace local API calls with:
const API_BASE = 'https://varahasdc.co.in/api';

// Login
const response = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});

// Dashboard stats
const stats = await fetch(`${API_BASE}/dashboard/stats`);
```

## ✅ Verification Checklist

- [ ] Database connection successful
- [ ] All routes accessible
- [ ] Swagger documentation loads
- [ ] Authentication working
- [ ] Sample data queries return results
- [ ] Error handling functional
- [ ] CORS configured for frontend access

## 📞 Support

- **API Documentation**: `/api-docs`
- **Health Check**: `/health`
- **Database Test**: `node test-db.js`