# PropertyPilot - Real Estate Competitive Analysis Platform

AI-powered property analysis platform that helps property managers optimize rental pricing through competitive analysis, market data scraping, and intelligent recommendations.

## Features

- 🏢 **Property Analysis**: AI-powered initial property assessment
- 🔍 **Competitor Discovery**: Automated scraping of competitor properties from apartments.com
- 📊 **Market Insights**: Comprehensive rent comparisons and vacancy analysis
- 🎯 **Subject Property Matching**: Intelligent matching with manual override capability
- 💰 **Pricing Optimization**: AI-generated pricing recommendations
- 📈 **Data Visualization**: Interactive charts and detailed unit comparisons
- 📥 **Excel Export**: Professional optimization reports

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- TanStack Query (React Query)
- shadcn/ui + Radix UI
- Tailwind CSS
- Framer Motion
- Chart.js & Recharts

### Backend
- Node.js + Express
- TypeScript
- PostgreSQL + Drizzle ORM
- OpenAI API (GPT-4)
- Firecrawl API (web scraping)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or use Neon Database)
- OpenAI API key
- Firecrawl API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/dallyp22/RentAI_CompSet.git
cd RentAI_CompSet
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Run database migrations (if using PostgreSQL):
```bash
npm run db:push
```

5. Start development server:
```bash
npm run dev
```

Visit http://localhost:5000 (or configured PORT)

## Deployment

### Option 1: Vercel (Frontend) + Railway (Backend) - Recommended

#### Deploy Backend to Railway:

1. Go to [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select `RentAI_CompSet` repository
4. Add environment variables:
   - `FIRECRAWL_API_KEY`
   - `OPENAI_API_KEY`
   - `DATABASE_URL` (or provision PostgreSQL plugin)
   - `NODE_ENV=production`
5. Railway will auto-detect and deploy using `railway.json`
6. Note your backend URL (e.g., `https://your-app.up.railway.app`)

#### Deploy Frontend to Vercel:

1. Go to [Vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import `RentAI_CompSet` from GitHub
4. Framework Preset: **Other**
5. Build Command: `npm run build`
6. Output Directory: `dist/public`
7. Add environment variables:
   - `VITE_API_URL` = Your Railway backend URL
8. Deploy!

### Option 2: Single Deployment (Railway Full-Stack)

1. Deploy to Railway as above
2. Railway serves both frontend and backend from single instance
3. More cost-effective for MVP/testing

### Option 3: All-in-One (Render, Heroku, etc.)

The app is designed to run as a single Node.js process serving both frontend and backend.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FIRECRAWL_API_KEY` | API key from firecrawl.dev | Yes |
| `OPENAI_API_KEY` | API key from OpenAI | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Optional* |
| `PORT` | Server port (default: 5000) | No |
| `NODE_ENV` | production or development | No |

\* Uses in-memory storage if DATABASE_URL not provided (not recommended for production)

## Architecture

### 4-Stage Workflow

1. **Property Input**: User enters property details → AI analysis
2. **Summarize**: Firecrawl scrapes competitors → User selects → Units scraped
3. **Analyze**: Interactive filtering and competitive analysis
4. **Optimize**: AI-powered pricing recommendations → Excel export

### Firecrawl Integration

PropertyPilot uses Firecrawl Extract API for:
- Property discovery from apartments.com search pages
- Detailed unit extraction (bedrooms, bathrooms, rent, sqft)
- Initial property details lookup during creation

### AI Integration

- **OpenAI GPT-4**: Initial property analysis, market insights
- **OpenAI GPT-3.5-turbo**: Dynamic analysis insights based on filters

## Development

### Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Run production build
npm run check    # TypeScript type checking
npm run db:push  # Push database schema changes
```

### Project Structure

```
PropertyPilot/
├── client/               # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities
│   └── index.html
├── server/              # Express backend
│   ├── index.ts        # Server entry point
│   ├── routes.ts       # API endpoints
│   ├── storage.ts      # Data layer
│   └── vite.ts         # Vite integration
├── shared/              # Shared types/schemas
│   └── schema.ts       # Database schema (Drizzle)
└── package.json
```

## Recent Updates

### Firecrawl Migration (Dec 2025)
- Migrated from Scrapezy to Firecrawl Extract API
- 200+ lines of code simplified
- Better reliability and anti-scraping handling
- Improved address extraction

### UX Improvements
- Manual subject property selection UI
- Enhanced keyword-based property matching
- State persistence with localStorage backup
- Better error messages with actionable steps
- Tooltips and inline help
- Enhanced progress indicator
- Navigation guards

## API Endpoints

### Properties
- `POST /api/properties` - Create property and get AI analysis
- `GET /api/properties/:id` - Get property details
- `GET /api/properties/latest` - Get most recent property
- `POST /api/properties/:id/scrape` - Start competitor scraping
- `POST /api/properties/:id/set-subject` - Manually set subject property
- `POST /api/properties/:id/sync-units` - Sync scraped units to property
- `POST /api/properties/:id/units` - Create/update property units
- `POST /api/properties/:id/optimize` - Generate pricing optimization
- `POST /api/properties/:id/apply-pricing` - Apply pricing changes

### Analysis
- `POST /api/filtered-analysis` - Get filtered competitive analysis
- `GET /api/vacancy/summary` - Get vacancy and rent comparison data

### Competitors
- `GET /api/competitors` - Get all scraped competitor properties
- `POST /api/competitors/scrape-units` - Scrape unit details for selected competitors

### Workflow
- `GET /api/workflow/:propertyId` - Get workflow state
- `PUT /api/workflow/:propertyId` - Update workflow state

## Contributing

This is a private project. For issues or questions, contact the repository owner.

## License

MIT

## Support

For technical support or questions:
- Create an issue on GitHub
- Email: [Your support email]

---

**Built with ❤️ for property managers**

