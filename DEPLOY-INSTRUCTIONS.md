# 🚀 Deploy to Namecheap cPanel - varahasdc.co.in/api

## 📦 Quick Deploy Steps

### 1. Upload Files to cPanel
1. **Login to cPanel**: https://cpanel.varahasdc.co.in
2. **File Manager** → Navigate to `/public_html/`
3. **Create folder**: `api`
4. **Upload**: `varaha-api-deploy.zip` to `/public_html/api/`
5. **Extract**: Right-click zip → Extract

### 2. Setup Node.js Application
1. **cPanel** → **Software** → **Node.js**
2. **Create App**:
   - **Node.js Version**: 18.x or 20.x
   - **Application Mode**: Production
   - **Application Root**: `/public_html/api`
   - **Application URL**: `varahasdc.co.in/api`
   - **Startup File**: `server.js`

### 3. Install Dependencies
In **Terminal** (cPanel):
```bash
cd /public_html/api
npm install
```

### 4. Configure Environment
Edit `.env` file in `/public_html/api/`:
```env
DB_HOST=localhost
DB_USER=varaosrc_prc
DB_PASSWORD=PRC!@#456&*(
DB_NAME=varaosrc_hospital_management
DB_PORT=3306
PORT=3001
NODE_ENV=production
```

### 5. Start Application
In **cPanel Node.js**:
- Click **"Start App"**
- Status should show **"Running"**

## 🔗 Access URLs

After deployment:
- **API Base**: https://varahasdc.co.in/api
- **Documentation**: https://varahasdc.co.in/api/api-docs
- **Health Check**: https://varahasdc.co.in/api/health

## 🧪 Test Deployment

### Test 1: Health Check
```bash
curl https://varahasdc.co.in/api/health
```

### Test 2: Login
```bash
curl -X POST https://varahasdc.co.in/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Super@321"}'
```

### Test 3: Dashboard Stats
```bash
curl https://varahasdc.co.in/api/dashboard/stats
```

## 📋 Verification Checklist

- [ ] Files uploaded to `/public_html/api/`
- [ ] Node.js app created and running
- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables configured
- [ ] Database connection working
- [ ] API endpoints responding
- [ ] Swagger documentation accessible
- [ ] CORS headers working for frontend

## 🔧 Troubleshooting

### Issue: "Cannot GET /api"
**Solution**: Check Node.js app is running in cPanel

### Issue: "Database connection failed"
**Solution**: Verify MySQL credentials in `.env`

### Issue: "Module not found"
**Solution**: Run `npm install` in `/public_html/api/`

### Issue: "Port already in use"
**Solution**: Change PORT in `.env` or restart app

## 📱 Frontend Integration

Update your Vercel frontend to use live API:

```javascript
// In your Next.js app
const API_BASE = 'https://varahasdc.co.in/api';

// Replace all API calls:
fetch('/api/auth/login') → fetch(`${API_BASE}/auth/login`)
fetch('/api/dashboard/stats') → fetch(`${API_BASE}/dashboard/stats`)
```

## 🎯 All Endpoints Available

### Authentication
- `POST /api/auth/login`

### Role-Based Access
- **Superadmin**: `/api/superadmin/*`
- **Admin**: `/api/admin/*`
- **Doctor**: `/api/doctor/*`
- **Console**: `/api/console/*`
- **Accounts**: `/api/accounts/*`

### General
- **Reports**: `/api/reports/*`
- **Patients**: `/api/patients/*`
- **Dashboard**: `/api/dashboard/*`

## ✅ Success Indicators

1. **API Status**: https://varahasdc.co.in/api returns JSON
2. **Documentation**: https://varahasdc.co.in/api/api-docs loads Swagger UI
3. **Login Works**: Authentication returns user object
4. **Database Connected**: Dashboard stats return real data

## 📞 Support

- **Swagger Docs**: `/api-docs`
- **Health Check**: `/health`
- **All endpoints documented with examples**

**🎉 Your API is now live at varahasdc.co.in/api with full sdc_admin functionality!**