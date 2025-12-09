# 🚀 Deploy Your Football Prediction System

## Quick Deployment Options

### Option 1: Render.com (Recommended - Free)

**Easiest deployment with full-stack support**

1. **Go to**: https://render.com
2. **Sign up** (free account)
3. **Click "New +" → "Web Service"**
4. **Connect your GitHub repository** (or upload the files)
5. **Configure**:
   - **Name**: football-predictions
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

6. **Add Environment Variables** (in Render dashboard):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ogpntvwwwgnpldempahv.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncG50dnd3d2ducGxkZW1wYWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNDk3MDcsImV4cCI6MjA4MDgyNTcwN30.kaHI9qTuh911CsEASDb3zfTHgLKJ93NWxEl-9lVl4M0
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncG50dnd3d2ducGxkZW1wYWh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI0OTcwNywiZXhwIjoyMDgwODI1NzA3fQ.xXiLSd-WWAaCKLkoYbcMIcxPUCZvTayzW1kcCboeMbE
   PRIVATE_USERNAME=admin
   PRIVATE_PASSWORD=dummy_password_123
   JWT_SECRET=dummy_jwt_secret_key_for_development
   NODE_ENV=production
   ```

7. **Deploy!** Your app will be live at: `https://football-predictions.onrender.com`

### Option 2: Vercel (Free)

**Perfect for Next.js apps**

1. **Go to**: https://vercel.com
2. **Sign up** with GitHub
3. **Import your repository**
4. **Add Environment Variables** (same as above)
5. **Deploy!**

### Option 3: Netlify (Free)

**Static deployment with serverless functions**

1. **Go to**: https://netlify.com
2. **Drag and drop your build folder**
3. **Configure environment variables**
4. **Deploy!**

## 🔑 Login Credentials

Once deployed, use these credentials:
- **Username**: `admin`
- **Password**: `dummy_password_123`

## 📱 What You'll Get

- ✅ Live football prediction dashboard
- ✅ Real-time match data and analysis
- ✅ Team performance statistics
- ✅ Authentication system
- ✅ Database-powered predictions
- ✅ Mobile-responsive design

## 🛠️ Features

- **Match Predictions**: Statistical analysis with confidence scores
- **Team Analytics**: Form guides, head-to-head records
- **Real-time Updates**: Live score tracking
- **Data Sync**: Multi-source data aggregation
- **User Authentication**: Secure login system

## 🚀 Production Optimizations

- Built with Next.js 16 for maximum performance
- TypeScript for type safety
- Tailwind CSS for responsive design
- Supabase for scalable database
- Optimized build for fast loading

**Your football prediction system will be live and accessible worldwide in minutes!**