# 🚀 Namecheap cPanel Deployment Guide

## 📦 File Ready for Upload
**File**: `varaha-api-namecheap-deploy.zip` (79KB)
**Location**: `/Users/ashokverma/Documents/TechRover/securevraha/varaha-api/`

## 🎯 Step-by-Step Deployment

### Step 1: Access cPanel
1. Go to: **https://cpanel.varahasdc.co.in**
2. Login with your Namecheap credentials

### Step 2: Upload API Files
1. **File Manager** → Navigate to `/public_html/`
2. **Create New Folder**: `api`
3. **Enter folder**: `/public_html/api/`
4. **Upload File**: Click "Upload" → Select `varaha-api-namecheap-deploy.zip`
5. **Extract**: Right-click zip file → "Extract"
6. **Delete zip**: Remove the zip file after extraction

### Step 3: Setup Node.js Application
1. **cPanel Dashboard** → **Software** → **Node.js**
2. **Create Application**:
   - **Node.js Version**: 18.x or 20.x (latest available)
   - **Application Mode**: Production
   - **Application Root**: `/public_html/api`
   - **Application URL**: `varahasdc.co.in/api`
   - **Startup File**: `server.js`
   - **Environment Variables**: Leave empty (uses .env file)

### Step 4: Install Dependencies
1. **Terminal** (in cPanel) or **Node.js App Terminal**:
```bash
cd /public_html/api
npm install
```

### Step 5: Start Application
1. In **Node.js App Management**:
   - Click **"Start App"**
   - Status should show **"Running"**
   - Note the assigned port (usually 3001)

## ✅ Verification Steps

### Test 1: API Status
Visit: **https://varahasdc.co.in/api**
Expected: JSON response with API info

### Test 2: Documentation
Visit: **https://varahasdc.co.in/api/api-docs**
Expected: Swagger UI interface

### Test 3: Health Check
Visit: **https://varahasdc.co.in/api/health**
Expected: Database connection status

### Test 4: Authentication
```bash
curl -X POST https://varahasdc.co.in/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Super@321"}'
```
Expected: User object with success: true

## 🔧 Configuration Details

### Database Connection (Already Configured)
```env
DB_HOST=localhost
DB_USER=varaosrc_prc
DB_PASSWORD=PRC!@#456&*(
DB_NAME=varaosrc_hospital_management
DB_PORT=3306
```

### API Endpoints Available
- **Authentication**: `/api/auth/login`
- **Dashboard**: `/api/dashboard/stats`
- **Superadmin**: `/api/superadmin/*`
- **Admin**: `/api/admin/*`
- **Doctor**: `/api/doctor/*`
- **Console**: `/api/console/*`
- **Accounts**: `/api/accounts/*`
- **Reports**: `/api/reports/*`
- **Patients**: `/api/patients/*`

## 🚨 Troubleshooting

### Issue: "Application failed to start"
**Solution**: 
1. Check Node.js version (use 18.x or 20.x)
2. Verify `server.js` exists in `/public_html/api/`
3. Run `npm install` again

### Issue: "Cannot connect to database"
**Solution**:
1. Verify MySQL database exists: `varaosrc_hospital_management`
2. Check user permissions: `varaosrc_prc`
3. Test connection in cPanel → MySQL Databases

### Issue: "Module not found"
**Solution**:
```bash
cd /public_html/api
rm -rf node_modules
npm install
```

### Issue: "Port already in use"
**Solution**:
1. Stop the application in Node.js management
2. Wait 30 seconds
3. Start again

## 📱 Frontend Integration

Update your Vercel frontend to use the live API:

```javascript
// Replace in your Next.js app
const API_BASE = 'https://varahasdc.co.in/api';

// Update all fetch calls
const response = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
```

## 🎉 Success Checklist

- [ ] Files uploaded to `/public_html/api/`
- [ ] Node.js app created and running
- [ ] `npm install` completed successfully
- [ ] API responds at `https://varahasdc.co.in/api`
- [ ] Swagger docs load at `/api-docs`
- [ ] Authentication works with test credentials
- [ ] Database queries return real data
- [ ] All role endpoints accessible

## 🔗 Final URLs

- **API Base**: https://varahasdc.co.in/api
- **Documentation**: https://varahasdc.co.in/api/api-docs
- **Health Check**: https://varahasdc.co.in/api/health

**🎯 Your API is now live with full sdc_admin functionality!**