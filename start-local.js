// Start server locally for testing
process.env.PORT = '3002';
process.env.NODE_ENV = 'development';

const app = require('./server');

console.log('🌐 Local API Server Started');
console.log('📍 Base URL: http://localhost:3002');
console.log('📚 Documentation: http://localhost:3002/api-docs');
console.log('🔍 Health Check: http://localhost:3002/health');
console.log('');
console.log('🔗 Test Commands:');
console.log('curl http://localhost:3002/');
console.log('curl http://localhost:3002/health');
console.log('curl -X POST http://localhost:3002/api/auth/login -H "Content-Type: application/json" -d \'{"username":"superadmin","password":"Super@321"}\'');
console.log('');
console.log('✅ Ready for local testing or deployment to varahasdc.co.in/api');